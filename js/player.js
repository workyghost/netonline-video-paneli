// js/player.js
import {
  playerAuth as auth, playerDb as db,
  signInAnonymously,
  collection, doc, addDoc, getDoc, getDocs, updateDoc,
  query, where, onSnapshot,
  serverTimestamp, enableNetwork, disableNetwork
} from "./firebase-config.js";

// ========== DOM REFS ==========
const setupScreen         = document.getElementById("setupScreen");
const playerScreen        = document.getElementById("playerScreen");
const firmSelect          = document.getElementById("firmSelect");
const screenNameInput     = document.getElementById("screenName");
const screenLocationInput = document.getElementById("screenLocation");
const saveScreenButton    = document.getElementById("saveScreenButton");
const setupError          = document.getElementById("setupError");
const resetButton         = document.getElementById("resetButton");
const bgVideo             = document.getElementById("bgVideo");
const mainVideo           = document.getElementById("mainVideo");
const linkOverlay         = document.getElementById("linkOverlay");
const controlBar          = document.getElementById("controlBar");
const ctrlPlayPause       = document.getElementById("ctrlPlayPause");
const ctrlMute            = document.getElementById("ctrlMute");
const ctrlFullscreen      = document.getElementById("ctrlFullscreen");
const iconPlay            = document.getElementById("iconPlay");
const iconPause           = document.getElementById("iconPause");
const iconUnmuted         = document.getElementById("iconUnmuted");
const iconMuted           = document.getElementById("iconMuted");
const iconFullscreenEnter = document.getElementById("iconFullscreenEnter");
const iconFullscreenExit  = document.getElementById("iconFullscreenExit");

// ========== STATE ==========
let currentScreenId    = null;
let currentVideo       = null;   // { id, title, fileUrl }
let videoQueue         = [];
let currentVideoIndex  = 0;
let consecutiveErrors  = 0;
let heartbeatInterval  = null;
let retryTimeout       = null;
let unsubscribeScreen  = null;
let unsubscribePlaylist = null;
let unsubscribeVideos  = null;
let currentPlaylistId  = null;
let currentFirmId      = null;
let currentOrientation = null;
let isLinkMode         = false;   // true when ?screen= URL param is used
let controlBarTimeout  = null;

// ========== SETUP HELPERS ==========
function showSetupError(msg) {
  setupError.textContent = msg;
  setupError.classList.remove("hidden");
}

function hideSetupError() {
  setupError.classList.add("hidden");
}

// ========== LOAD FIRMS ==========
async function loadFirms() {
  try {
    const snap = await getDocs(collection(db, "firms"));
    firmSelect.innerHTML = '<option value="">Firma seçin...</option>';
    snap.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.data().name;
      firmSelect.appendChild(opt);
    });
  } catch (e) {
    showSetupError("Firmalar yüklenemedi.");
  }
}

// ========== SHOW SETUP SCREEN ==========
function showSetupScreen() {
  stopAllListeners();
  setupScreen.classList.remove("hidden");
  playerScreen.classList.add("hidden");
  loadFirms();
}

// ========== SAVE SCREEN (kaydet butonu) ==========
saveScreenButton.addEventListener("click", async () => {
  const firmId      = firmSelect.value;
  const name        = screenNameInput.value.trim();
  const location    = screenLocationInput.value.trim();
  const orientationEl = document.querySelector('input[name="screenOrientation"]:checked');
  const orientation = orientationEl?.value;

  if (!firmId)      { showSetupError("Lütfen firma seçin.");     return; }
  if (!name)        { showSetupError("Lütfen ekran adı girin."); return; }
  if (!location)    { showSetupError("Lütfen konum girin.");     return; }
  if (!orientation) { showSetupError("Lütfen yön seçin.");      return; }

  hideSetupError();
  saveScreenButton.disabled    = true;
  saveScreenButton.textContent = "Kaydediliyor...";

  try {
    const docRef = await addDoc(collection(db, "screens"), {
      firmId,
      name,
      location,
      orientation,
      status: "online",
      lastSeen: serverTimestamp(),
      currentVideoId: null,
      currentVideoTitle: null,
      playlistId: null,
      registeredAt: serverTimestamp()
    });
    localStorage.setItem("screenId", docRef.id);
    startPlayback(docRef.id);
  } catch (e) {
    showSetupError("Ekran kaydedilemedi: " + e.message);
    saveScreenButton.disabled    = false;
    saveScreenButton.textContent = "Ekranı Kaydet";
  }
});

// ========== START PLAYBACK ==========
function startPlayback(screenId) {
  currentScreenId = screenId;
  setupScreen.classList.add("hidden");
  playerScreen.classList.remove("hidden");

  if (unsubscribeScreen)  { unsubscribeScreen();  unsubscribeScreen  = null; }
  if (unsubscribePlaylist){ unsubscribePlaylist(); unsubscribePlaylist = null; }
  if (unsubscribeVideos)  { unsubscribeVideos();  unsubscribeVideos  = null; }

  startHeartbeat(screenId);

  unsubscribeScreen = onSnapshot(doc(db, "screens", screenId), (snap) => {
    if (!snap.exists()) {
      localStorage.removeItem("screenId");
      cleanupAndShowSetup();
      return;
    }
    const screen = snap.data();
    if (screen.playlistId) {
      startPlaylistMode(screen.playlistId);
    } else {
      startFirmMode(screen.firmId, screen.orientation);
    }
  });
}

// ========== FIRM MODE ==========
function startFirmMode(firmId, orientation) {
  // Aynı firm+orientation zaten aktifse tekrar kurma
  if (currentFirmId === firmId && currentOrientation === orientation && currentPlaylistId === null) return;
  currentFirmId      = firmId;
  currentOrientation = orientation;
  currentPlaylistId  = null;

  if (unsubscribePlaylist){ unsubscribePlaylist(); unsubscribePlaylist = null; }
  if (unsubscribeVideos)  { unsubscribeVideos();  unsubscribeVideos  = null; }

  const q = query(
    collection(db, "videos"),
    where("firmId", "==", firmId),
    where("isActive", "==", true)
  );

  unsubscribeVideos = onSnapshot(q, (snap) => {
    const now    = new Date();
    const videos = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(v => !v.expiresAt || v.expiresAt.toDate() > now)
      .filter(v => v.orientation === orientation || v.orientation === "both");
    updateVideoQueue(videos);
  });
}

// ========== PLAYLIST MODE ==========
function startPlaylistMode(playlistId) {
  if (currentPlaylistId === playlistId) return;
  currentPlaylistId = playlistId;
  currentFirmId     = null;

  if (unsubscribeVideos)  { unsubscribeVideos();  unsubscribeVideos  = null; }
  if (unsubscribePlaylist){ unsubscribePlaylist(); unsubscribePlaylist = null; }

  unsubscribePlaylist = onSnapshot(doc(db, "playlists", playlistId), async (snap) => {
    if (!snap.exists()) { currentPlaylistId = null; return; }
    const playlist    = snap.data();
    const sortedItems = [...playlist.items].sort((a, b) => a.order - b.order);

    const videos = [];
    for (const item of sortedItems) {
      try {
        const vSnap = await getDoc(doc(db, "videos", item.videoId));
        if (vSnap.exists()) {
          const v = { id: vSnap.id, ...vSnap.data() };
          if (v.isActive) videos.push(v);
        }
      } catch (_) { /* video getirilemezse atla */ }
    }
    updateVideoQueue(videos);
  });
}

// ========== VIDEO QUEUE ==========
function updateVideoQueue(newVideos) {
  if (newVideos.length === 0) {
    videoQueue = [];
    mainVideo.pause();
    bgVideo.pause();
    mainVideo.removeAttribute("src");
    bgVideo.removeAttribute("src");
    showNoVideosMessage();
    return;
  }

  hideNoVideosMessage();
  hideContentError();

  // Sadece ID dizisi değişmişse playlist'i sıfırla
  const oldKey = videoQueue.map(v => v.id).join(",");
  const newKey = newVideos.map(v => v.id).join(",");

  if (oldKey !== newKey) {
    videoQueue        = newVideos;
    consecutiveErrors = 0;
    if (retryTimeout) { clearTimeout(retryTimeout); retryTimeout = null; }
    playVideo(0);
  }
}

// ========== PLAYBACK ==========
function playVideo(index) {
  if (videoQueue.length === 0) return;
  currentVideoIndex = index % videoQueue.length;
  currentVideo      = videoQueue[currentVideoIndex];

  mainVideo.src = currentVideo.fileUrl;
  bgVideo.src   = currentVideo.fileUrl;
  mainVideo.load();
  bgVideo.load();
  mainVideo.muted = false;
  bgVideo.muted   = true;
  mainVideo.play().catch(console.error);
  bgVideo.play().catch(console.error);
}

function playNext() {
  playVideo(currentVideoIndex + 1);
}

mainVideo.addEventListener("ended", () => {
  consecutiveErrors = 0;
  playNext();
});

mainVideo.addEventListener("playing", () => {
  consecutiveErrors = 0; // Başarılı oynatmada hata sayacını sıfırla
});

// ========== HATA DAYANIKLILIĞI ==========
mainVideo.addEventListener("error", () => {
  consecutiveErrors++;
  if (consecutiveErrors >= 3) {
    // 3 üst üste hata — içerik hata ekranı göster, 5dk sonra retry
    showContentError();
    if (retryTimeout) clearTimeout(retryTimeout);
    retryTimeout = setTimeout(() => {
      consecutiveErrors = 0;
      hideContentError();
      if (videoQueue.length > 0) playVideo(currentVideoIndex);
    }, 5 * 60 * 1000);
  } else {
    // 3 saniye bekle, sonraki videoya geç
    setTimeout(playNext, 3000);
  }
});

// ========== MESAJ OVERLAY'LERİ ==========
function showNoVideosMessage() {
  hideContentError();
  if (document.getElementById("noVideosMsg")) return;
  const el = document.createElement("div");
  el.id        = "noVideosMsg";
  el.className = "absolute inset-0 z-30 flex items-center justify-center bg-black";
  el.innerHTML = `
    <div class="text-center">
      <svg class="mx-auto h-16 w-16 text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14
             M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      <p class="text-slate-600 text-lg">Yayınlanacak video bulunamadı</p>
    </div>`;
  playerScreen.appendChild(el);
}

function hideNoVideosMessage() {
  document.getElementById("noVideosMsg")?.remove();
}

function showContentError() {
  hideNoVideosMessage();
  if (document.getElementById("contentErrorMsg")) return;
  const el = document.createElement("div");
  el.id        = "contentErrorMsg";
  el.className = "absolute inset-0 z-30 flex items-center justify-center bg-black";
  el.innerHTML = `
    <div class="text-center">
      <p class="text-slate-500 text-lg">İçerik yüklenemiyor, lütfen bekleyin...</p>
    </div>`;
  playerScreen.appendChild(el);
}

function hideContentError() {
  document.getElementById("contentErrorMsg")?.remove();
}

// ========== HEARTBEAT ==========
function startHeartbeat(screenId) {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(async () => {
    try {
      await updateDoc(doc(db, "screens", screenId), {
        lastSeen:          serverTimestamp(),
        status:            "online",
        currentVideoId:    currentVideo?.id    || null,
        currentVideoTitle: currentVideo?.title || null
      });
    } catch (_) { /* heartbeat hatası oynatmayı durdurmasın */ }
  }, 60000);
}

window.addEventListener("beforeunload", () => {
  if (currentScreenId) {
    updateDoc(doc(db, "screens", currentScreenId), { status: "offline" });
  }
});

// ========== EKRANI SIFIRLA (dişli ikonu) ==========
async function resetScreen() {
  if (!confirm("Ekranı sıfırlamak istediğinizden emin misiniz?")) return;

  if (currentScreenId) {
    try {
      await updateDoc(doc(db, "screens", currentScreenId), { status: "offline" });
    } catch (_) {}
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    stopAllListeners();
  }

  localStorage.removeItem("screenId");
  location.reload();
}

resetButton.addEventListener("click", resetScreen);

// ========== LISTENER TEMİZLEME ==========
function stopAllListeners() {
  if (unsubscribeScreen)  { unsubscribeScreen();  unsubscribeScreen  = null; }
  if (unsubscribePlaylist){ unsubscribePlaylist(); unsubscribePlaylist = null; }
  if (unsubscribeVideos)  { unsubscribeVideos();  unsubscribeVideos  = null; }
}

function cleanupAndShowSetup() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  stopAllListeners();
  currentScreenId   = null;
  currentVideo      = null;
  videoQueue        = [];
  hideNoVideosMessage();
  hideContentError();
  showSetupScreen();
}

// ========== CONTROL BAR ==========
function showControlBar() {
  controlBar.style.opacity = "1";
  if (controlBarTimeout) clearTimeout(controlBarTimeout);
  controlBarTimeout = setTimeout(() => { controlBar.style.opacity = "0"; }, 3000);
}

playerScreen.addEventListener("mousemove", showControlBar);
playerScreen.addEventListener("mouseenter", showControlBar);

function updatePlayPauseIcon() {
  if (mainVideo.paused) {
    iconPlay.classList.remove("hidden");
    iconPause.classList.add("hidden");
  } else {
    iconPlay.classList.add("hidden");
    iconPause.classList.remove("hidden");
  }
}

function updateMuteIcon() {
  if (mainVideo.muted) {
    iconUnmuted.classList.add("hidden");
    iconMuted.classList.remove("hidden");
  } else {
    iconUnmuted.classList.remove("hidden");
    iconMuted.classList.add("hidden");
  }
}

function updateFullscreenIcon() {
  const isFs = !!document.fullscreenElement;
  iconFullscreenEnter.classList.toggle("hidden", isFs);
  iconFullscreenExit.classList.toggle("hidden", !isFs);
}

ctrlPlayPause.addEventListener("click", () => {
  if (mainVideo.paused) { mainVideo.play().catch(() => {}); bgVideo.play().catch(() => {}); }
  else                  { mainVideo.pause(); bgVideo.pause(); }
  updatePlayPauseIcon();
});

ctrlMute.addEventListener("click", () => {
  mainVideo.muted = !mainVideo.muted;
  updateMuteIcon();
});

ctrlFullscreen.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});

mainVideo.addEventListener("play",  updatePlayPauseIcon);
mainVideo.addEventListener("pause", updatePlayPauseIcon);

document.addEventListener("fullscreenchange", () => {
  updateFullscreenIcon();
  // Link modunda fullscreen'den çıkılınca overlay'i geri göster
  if (!document.fullscreenElement && isLinkMode) {
    showLinkOverlay();
  }
});

// ========== LINK OVERLAY ==========
function showLinkOverlay() {
  mainVideo.pause();
  bgVideo.pause();
  linkOverlay.classList.remove("hidden");
}

function hideLinkOverlay() {
  linkOverlay.classList.add("hidden");
}

linkOverlay.addEventListener("click", () => {
  hideLinkOverlay();
  document.documentElement.requestFullscreen().catch(() => {});
  mainVideo.play().catch(() => {});
  bgVideo.play().catch(() => {});
});

// ========== OFFLINE / ONLINE NETWORK YÖNETİMİ ==========
// İnternet kesilince Firestore offline cache kullanır — onSnapshot'lar son veriyle çalışmaya devam eder.
window.addEventListener("online",  () => enableNetwork(db).catch(() => {}));
window.addEventListener("offline", () => disableNetwork(db).catch(() => {}));

// ========== INIT ==========
async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlScreenId = urlParams.get("screen");

  const tryAuth = async () => {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.error("Anonim auth hatası:", e);
      setupScreen.classList.remove("hidden");
      playerScreen.classList.add("hidden");
      showSetupError("Bağlantı hatası, yeniden deneniyor...");
      setTimeout(tryAuth, 30000);
      return;
    }

    if (urlScreenId) {
      // LINK MODU: ?screen= parametresi var
      isLinkMode = true;
      try {
        const snap = await getDoc(doc(db, "screens", urlScreenId));
        if (!snap.exists()) {
          // Geçersiz ekran ID'si
          document.body.innerHTML = `
            <div style="color:white;text-align:center;padding:4rem;background:black;min-height:100vh;display:flex;align-items:center;justify-content:center;">
              <p style="font-size:1.25rem">Geçersiz ekran linki</p>
            </div>`;
          return;
        }
        // Geçerli ekran — önce overlay göster, localStorage'a yazma
        setupScreen.classList.add("hidden");
        playerScreen.classList.remove("hidden");
        linkOverlay.classList.remove("hidden");
        startHeartbeat(urlScreenId);
        // startPlayback'i direkt çağırmak yerine listener'ı kur
        // ama oynatmayı overlay tıklamasına bırak
        currentScreenId = urlScreenId;
        if (unsubscribeScreen) { unsubscribeScreen(); unsubscribeScreen = null; }
        unsubscribeScreen = onSnapshot(doc(db, "screens", urlScreenId), (screenSnap) => {
          if (!screenSnap.exists()) return;
          const screen = screenSnap.data();
          if (screen.playlistId) {
            startPlaylistMode(screen.playlistId);
          } else {
            startFirmMode(screen.firmId, screen.orientation);
          }
        });
      } catch (e) {
        console.error("Link modu ekran hatası:", e);
        document.body.innerHTML = `
          <div style="color:white;text-align:center;padding:4rem;background:black;min-height:100vh;display:flex;align-items:center;justify-content:center;">
            <p style="font-size:1.25rem">Bağlantı hatası, lütfen sayfayı yenileyin.</p>
          </div>`;
      }
    } else {
      // NORMAL MOD: localStorage akışı
      const screenId = localStorage.getItem("screenId");
      if (screenId) {
        try {
          const snap = await getDoc(doc(db, "screens", screenId));
          if (snap.exists()) {
            startPlayback(screenId);
          } else {
            localStorage.removeItem("screenId");
            showSetupScreen();
          }
        } catch (e) {
          console.error("Ekran dokümanı alınamadı:", e);
          showSetupScreen();
        }
      } else {
        showSetupScreen();
      }
    }
  };

  await tryAuth();
}

init();
