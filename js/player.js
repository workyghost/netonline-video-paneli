// js/player.js
import {
  db,
  collection, getDocs, query, where, orderBy
} from "./firebase-config.js";

// DOM elements
const setupScreen  = document.getElementById("setupScreen");
const playerScreen = document.getElementById("playerScreen");
const firmSelect   = document.getElementById("firmSelect");
const screenMode   = document.getElementById("screenMode");
const playButton   = document.getElementById("playButton");
const setupError   = document.getElementById("setupError");
const resetButton  = document.getElementById("resetButton");
const bgVideo      = document.getElementById("bgVideo");
const mainVideo    = document.getElementById("mainVideo");

// Local Storage keys
const LS_FIRM_ID    = "netonline_firmId";
const LS_FIRM_NAME  = "netonline_firmName";
const LS_SCREEN_MODE = "netonline_screenMode";

// Player state
let videoPlaylist    = [];
let currentVideoIndex = 0;
let refreshInterval  = null;
let isResetting      = false; // prevents fullscreenchange re-entry

// ========== FULLSCREEN EXIT DETECTION ==========
// When user presses ESC (or exits fullscreen any way), return to setup
document.addEventListener("fullscreenchange", () => {
  if (
    !document.fullscreenElement &&
    !playerScreen.classList.contains("hidden") &&
    !document.getElementById("resumeOverlay") && // ignore while resume overlay is shown
    !isResetting
  ) {
    goToSetup();
  }
});

// ========== CHECK SAVED SETTINGS ON LOAD ==========
function checkSavedSettings() {
  const savedFirmId   = localStorage.getItem(LS_FIRM_ID);
  const savedFirmName = localStorage.getItem(LS_FIRM_NAME);
  const savedMode     = localStorage.getItem(LS_SCREEN_MODE);

  if (savedFirmId && savedMode) {
    showResumeScreen(savedFirmId, savedFirmName || "", savedMode);
    return true;
  }
  return false;
}

// Show black screen with "tap to continue" overlay (needed for fullscreen user-gesture requirement)
function showResumeScreen(firmId, firmName, mode) {
  setupScreen.classList.add("hidden");
  playerScreen.classList.remove("hidden");

  const overlay = document.createElement("div");
  overlay.id = "resumeOverlay";
  overlay.style.cssText =
    "position:absolute;inset:0;z-index:50;display:flex;flex-direction:column;" +
    "align-items:center;justify-content:center;background:#000;cursor:pointer;user-select:none;";

  // Use textContent to avoid XSS from stored values
  const title = document.createElement("h2");
  title.style.cssText = "color:#fff;font-size:1.75rem;font-weight:700;margin-bottom:0.5rem;font-family:Inter,sans-serif;";
  title.textContent = "NetOnline Player";

  const sub = document.createElement("p");
  sub.style.cssText = "color:#475569;font-size:0.875rem;margin-bottom:2rem;font-family:Inter,sans-serif;";
  sub.textContent = firmName;

  const hint = document.createElement("p");
  hint.style.cssText = "color:#334155;font-size:0.8rem;font-family:Inter,sans-serif;";
  hint.className = "pulse-slow";
  hint.textContent = "Devam etmek için dokunun";

  overlay.append(title, sub, hint);

  overlay.addEventListener("click", async () => {
    overlay.remove();
    await startPlayer(firmId, mode);
  }, { once: true });

  playerScreen.appendChild(overlay);
}

// ========== LOAD FIRMS ==========
async function loadFirms() {
  try {
    const firmsSnapshot = await getDocs(collection(db, "firms"));
    firmsSnapshot.forEach((docSnap) => {
      const option = document.createElement("option");
      option.value = docSnap.id;
      option.textContent = docSnap.data().name;
      firmSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Firmalar yüklenirken hata:", error);
    showError("Firmalar yüklenemedi. İnternet bağlantınızı kontrol edin.");
  }
}

function showError(message) {
  setupError.textContent = message;
  setupError.classList.remove("hidden");
}

function hideError() {
  setupError.classList.add("hidden");
}

// ========== FETCH VIDEOS ==========
async function fetchVideos(firmId, mode) {
  try {
    const videosQuery = query(
      collection(db, "videos"),
      where("firmId", "==", firmId),
      where("isActive", "==", true),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(videosQuery);
    const now      = new Date();
    const videos   = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      if (data.expiresAt) {
        const expiryDate = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
        if (expiryDate < now) return;
      }

      if (mode === "horizontal") {
        if (data.orientation !== "horizontal" && data.orientation !== "both") return;
      } else if (mode === "vertical") {
        if (data.orientation !== "vertical" && data.orientation !== "both") return;
      }
      // "mixed" mode: accept all orientations

      videos.push({ id: docSnap.id, ...data });
    });

    return videos;
  } catch (error) {
    console.error("Videolar yüklenirken hata:", error);
    return [];
  }
}

// ========== NO VIDEOS MESSAGE ==========
function showNoVideosMessage() {
  if (document.getElementById("noVideosMsg")) return;
  const msg = document.createElement("div");
  msg.id = "noVideosMsg";
  msg.className = "absolute inset-0 z-30 flex items-center justify-center";
  msg.innerHTML = `
    <div class="text-center">
      <svg class="mx-auto h-16 w-16 text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      <p class="text-slate-600 text-lg">Yayınlanacak video bulunamadı</p>
    </div>
  `;
  playerScreen.appendChild(msg);
}

function hideNoVideosMessage() {
  const existing = document.getElementById("noVideosMsg");
  if (existing) existing.remove();
}

// ========== PLAYBACK ==========
function playVideo(index) {
  if (videoPlaylist.length === 0) return;
  currentVideoIndex = index % videoPlaylist.length;
  const video = videoPlaylist[currentVideoIndex];

  mainVideo.src = video.fileUrl;
  bgVideo.src   = video.fileUrl;
  mainVideo.load();
  bgVideo.load();
  mainVideo.muted = false;
  bgVideo.muted   = true;
  mainVideo.play().catch(console.error);
  bgVideo.play().catch(console.error);
}

function onVideoEnded() {
  playVideo(currentVideoIndex + 1);
}

// ========== START PLAYER ==========
async function startPlayer(firmId, mode) {
  setupScreen.classList.add("hidden");
  playerScreen.classList.remove("hidden");

  try {
    await document.documentElement.requestFullscreen();
  } catch (e) {
    console.warn("Fullscreen isteği reddedildi:", e);
  }

  mainVideo.removeEventListener("ended", onVideoEnded);
  mainVideo.addEventListener("ended", onVideoEnded);

  await refreshPlaylist(firmId, mode);

  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => refreshPlaylist(firmId, mode), 5 * 60 * 1000);
}

// ========== REFRESH PLAYLIST ==========
async function refreshPlaylist(firmId, mode) {
  const newVideos = await fetchVideos(firmId, mode);

  if (newVideos.length === 0) {
    videoPlaylist = [];
    mainVideo.pause();
    bgVideo.pause();
    mainVideo.removeAttribute("src");
    bgVideo.removeAttribute("src");
    showNoVideosMessage();
    return;
  }

  hideNoVideosMessage();

  const oldUrls = videoPlaylist.map(v => v.fileUrl).join(",");
  const newUrls = newVideos.map(v => v.fileUrl).join(",");

  if (oldUrls !== newUrls) {
    videoPlaylist = newVideos;
    currentVideoIndex = 0;
    playVideo(0);
  }
}

// ========== STOP PLAYBACK ==========
function stopPlayback() {
  if (refreshInterval) clearInterval(refreshInterval);
  mainVideo.pause();
  bgVideo.pause();
  mainVideo.removeAttribute("src");
  bgVideo.removeAttribute("src");
  videoPlaylist    = [];
  currentVideoIndex = 0;
  hideNoVideosMessage();
}

// ========== GO TO SETUP (shared by ESC exit and reset button) ==========
function goToSetup() {
  isResetting = true;
  stopPlayback();

  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }

  playerScreen.classList.add("hidden");
  setupScreen.classList.remove("hidden");

  firmSelect.innerHTML = '<option value="">Firma seçin...</option>';
  loadFirms();

  isResetting = false;
}

// ========== PLAY BUTTON ==========
playButton.addEventListener("click", () => {
  hideError();

  const selectedFirmId = firmSelect.value;
  const selectedMode   = screenMode.value;

  if (!selectedFirmId) { showError("Lütfen bir firma seçin."); return; }
  if (!selectedMode)   { showError("Lütfen bir ekran modu seçin."); return; }

  const selectedFirmName = firmSelect.options[firmSelect.selectedIndex].text;
  localStorage.setItem(LS_FIRM_ID,    selectedFirmId);
  localStorage.setItem(LS_FIRM_NAME,  selectedFirmName);
  localStorage.setItem(LS_SCREEN_MODE, selectedMode);

  startPlayer(selectedFirmId, selectedMode);
});

// ========== RESET BUTTON (dişli ikonu — setup'a dön + ayarları temizle) ==========
resetButton.addEventListener("click", () => {
  localStorage.removeItem(LS_FIRM_ID);
  localStorage.removeItem(LS_FIRM_NAME);
  localStorage.removeItem(LS_SCREEN_MODE);
  goToSetup();
});

// ========== INIT ==========
const hasSaved = checkSavedSettings();
if (!hasSaved) {
  loadFirms();
}
