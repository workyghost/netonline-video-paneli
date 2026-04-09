// js/player.js
import { playerSupabase as supabase } from "./supabase-config.js";

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
    const { data: snap, error } = await supabase.from("firms").select("*");
    if (error) throw error;
    firmSelect.innerHTML = '<option value="">Firma seçin...</option>';
    (snap || []).forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.name;
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
  if (!firmId)   { showSetupError("Lütfen firma seçin.");     return; }
  if (!name)     { showSetupError("Lütfen ekran adı girin."); return; }
  if (!location) { showSetupError("Lütfen konum girin.");     return; }

  hideSetupError();
  saveScreenButton.disabled    = true;
  saveScreenButton.textContent = "Kaydediliyor...";

  try {
    const { data: docRef, error } = await supabase.from("screens").insert([{
      firm_id: firmId,
      name,
      location,
      status: "online",
      last_seen: new Date().toISOString(),
      current_video_id: null,
      current_video_title: null,
      playlist_id: null,
      registered_at: new Date().toISOString()
    }]).select().single();
    if (error) throw error;
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

  const fetchScreen = async () => {
    const { data: screen } = await supabase.from("screens").select("*").eq("id", screenId).single();
    if (!screen) {
      localStorage.removeItem("screenId");
      cleanupAndShowSetup();
      return;
    }
    if (screen.playlist_id) {
      startPlaylistMode(screen.playlist_id);
    } else {
      startFirmMode(screen.firm_id);
    }
  };

  fetchScreen();
  unsubscribeScreen = supabase.channel(`public:screens:id=${screenId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "screens", filter: `id=eq.${screenId}` }, fetchScreen)
    .subscribe();
}

// ========== FIRM MODE ==========
function startFirmMode(firmId) {
  if (currentFirmId === firmId && currentPlaylistId === null) return;
  currentFirmId     = firmId;
  currentPlaylistId = null;

  if (unsubscribePlaylist){ supabase.removeChannel(unsubscribePlaylist); unsubscribePlaylist = null; }
  if (unsubscribeVideos)  { supabase.removeChannel(unsubscribeVideos);  unsubscribeVideos  = null; }

  const fetchFirmVideos = async () => {
    const { data: videos, error } = await supabase.from("videos").select("*")
      .eq("firm_id", firmId)
      .eq("is_active", true);
    if (!error) {
      const now = new Date();
      const validVideos = (videos || [])
        .filter(v => !v.expires_at || new Date(v.expires_at) > now);
      updateVideoQueue(validVideos);
    }
  };
  fetchFirmVideos();
  unsubscribeVideos = supabase.channel(`public:videos:firm=${firmId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "videos", filter: `firm_id=eq.${firmId}` }, fetchFirmVideos)
    .subscribe();
}

// ========== PLAYLIST MODE ==========
function startPlaylistMode(playlistId) {
  if (currentPlaylistId === playlistId) return;
  currentPlaylistId = playlistId;
  currentFirmId     = null;

  if (unsubscribeVideos)  { supabase.removeChannel(unsubscribeVideos);  unsubscribeVideos  = null; }
  if (unsubscribePlaylist){ supabase.removeChannel(unsubscribePlaylist); unsubscribePlaylist = null; }

  const fetchPlaylistVideos = async () => {
    const { data: playlist } = await supabase.from("playlists").select("*").eq("id", playlistId).single();
    if (!playlist) { currentPlaylistId = null; return; }
    const sortedItems = [...(playlist.items || [])].sort((a, b) => a.order - b.order);
    
    const videos = [];
    for (const item of sortedItems) {
      try {
        const { data: vSnap } = await supabase.from("videos").select("*").eq("id", item.videoId).single();
        if (vSnap && vSnap.is_active) videos.push(vSnap);
      } catch (_) { /* video getirilemezse atla */ }
    }
    updateVideoQueue(videos);
  };
  fetchPlaylistVideos();
  unsubscribePlaylist = supabase.channel(`public:playlists:id=${playlistId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "playlists", filter: `id=eq.${playlistId}` }, fetchPlaylistVideos)
    .subscribe();
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

  mainVideo.src = currentVideo.file_url;
  bgVideo.src   = currentVideo.file_url;
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
      await supabase.from("screens").update({
        last_seen: new Date().toISOString(),
        status: "online",
        current_video_id: currentVideo?.id || null,
        current_video_title: currentVideo?.title || null
      }).eq("id", screenId);
    } catch (_) { /* heartbeat hatası oynatmayı durdurmasın */ }
  }, 60000);
}

window.addEventListener("beforeunload", () => {
  if (currentScreenId) {
    supabase.from("screens").update({ status: "offline" }).eq("id", currentScreenId);
  }
});

// ========== EKRANI SIFIRLA (dişli ikonu) ==========
async function resetScreen() {
  if (!confirm("Ekranı sıfırlamak istediğinizden emin misiniz?")) return;

  if (currentScreenId) {
    try {
      await supabase.from("screens").update({ status: "offline" }).eq("id", currentScreenId);
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
  if (unsubscribeScreen)  { supabase.removeChannel(unsubscribeScreen);  unsubscribeScreen  = null; }
  if (unsubscribePlaylist){ supabase.removeChannel(unsubscribePlaylist); unsubscribePlaylist = null; }
  if (unsubscribeVideos)  { supabase.removeChannel(unsubscribeVideos);  unsubscribeVideos  = null; }
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

// ========== INIT ==========
async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlScreenId = urlParams.get("screen");

  const tryAuth = async () => {
    try {
      await supabase.auth.signInAnonymously();
    } catch (e) {
      console.warn("Anonim auth hatası (veya desteklenmiyor), anonim isteklerle devam ediliyor:", e);
    }

    if (urlScreenId) {
      // LINK MODU: ?screen= parametresi var
      isLinkMode = true;
      try {
        const { data: snap } = await supabase.from("screens").select("*").eq("id", urlScreenId).single();
        if (!snap) {
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
        if (unsubscribeScreen) { supabase.removeChannel(unsubscribeScreen); unsubscribeScreen = null; }
        
        const fetchScreen = async () => {
           const { data: screenSnap } = await supabase.from("screens").select("*").eq("id", urlScreenId).single();
           if (!screenSnap) return;
           const screen = screenSnap;
           if (screen.playlist_id) {
             startPlaylistMode(screen.playlist_id);
           } else {
             startFirmMode(screen.firm_id);
           }
        };
        fetchScreen();
        unsubscribeScreen = supabase.channel(`public:screens:link=${urlScreenId}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "screens", filter: `id=eq.${urlScreenId}` }, fetchScreen)
          .subscribe();
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
          const { data: snap } = await supabase.from("screens").select("*").eq("id", screenId).single();
          if (snap) {
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
