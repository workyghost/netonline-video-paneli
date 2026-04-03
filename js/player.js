// js/player.js
import {
  db,
  collection, getDocs, query, where, orderBy
} from "./firebase-config.js";

// DOM elements
const setupScreen = document.getElementById("setupScreen");
const playerScreen = document.getElementById("playerScreen");
const firmSelect = document.getElementById("firmSelect");
const screenMode = document.getElementById("screenMode");
const playButton = document.getElementById("playButton");
const setupError = document.getElementById("setupError");
const resetButton = document.getElementById("resetButton");
const bgVideo = document.getElementById("bgVideo");
const mainVideo = document.getElementById("mainVideo");

// Local Storage keys
const LS_FIRM_ID = "netonline_firmId";
const LS_FIRM_NAME = "netonline_firmName";
const LS_SCREEN_MODE = "netonline_screenMode";

// Player state
let videoPlaylist = [];
let currentVideoIndex = 0;
let refreshInterval = null;

// Check Local Storage on load
function checkSavedSettings() {
  const savedFirmId = localStorage.getItem(LS_FIRM_ID);
  const savedScreenMode = localStorage.getItem(LS_SCREEN_MODE);

  if (savedFirmId && savedScreenMode) {
    startPlayer(savedFirmId, savedScreenMode);
    return true;
  }
  return false;
}

// Load firms from Firestore into dropdown
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

// Fetch videos matching firm + orientation + active + not expired
async function fetchVideos(firmId, mode) {
  try {
    const videosQuery = query(
      collection(db, "videos"),
      where("firmId", "==", firmId),
      where("isActive", "==", true),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(videosQuery);
    const now = new Date();
    const videos = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      // Filter by expiry
      if (data.expiresAt) {
        const expiryDate = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
        if (expiryDate < now) return; // skip expired
      }

      // Filter by orientation based on screen mode
      if (mode === "horizontal") {
        if (data.orientation !== "horizontal" && data.orientation !== "both") return;
      } else if (mode === "vertical") {
        if (data.orientation !== "vertical" && data.orientation !== "both") return;
      }
      // "mixed" mode: accept all orientations

      videos.push({
        id: docSnap.id,
        ...data
      });
    });

    return videos;
  } catch (error) {
    console.error("Videolar yüklenirken hata:", error);
    return [];
  }
}

// Show "no videos" message
function showNoVideosMessage() {
  // Remove existing message if any
  const existing = document.getElementById("noVideosMsg");
  if (existing) return;

  const msg = document.createElement("div");
  msg.id = "noVideosMsg";
  msg.className = "absolute inset-0 z-30 flex items-center justify-center";
  msg.innerHTML = `
    <div class="text-center">
      <svg class="mx-auto h-16 w-16 text-slate-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      <p class="text-slate-400 text-lg">Yayınlanacak video bulunamadı</p>
    </div>
  `;
  playerScreen.appendChild(msg);
}

function hideNoVideosMessage() {
  const existing = document.getElementById("noVideosMsg");
  if (existing) existing.remove();
}

// Play a specific video from the playlist
function playVideo(index) {
  if (videoPlaylist.length === 0) return;

  currentVideoIndex = index % videoPlaylist.length;
  const video = videoPlaylist[currentVideoIndex];

  mainVideo.src = video.fileUrl;
  bgVideo.src = video.fileUrl;

  mainVideo.load();
  bgVideo.load();

  mainVideo.muted = false;
  bgVideo.muted = true;

  mainVideo.play().catch(console.error);
  bgVideo.play().catch(console.error);
}

// Handle video ended — play next
function onVideoEnded() {
  playVideo(currentVideoIndex + 1);
}

// Start the player
async function startPlayer(firmId, mode) {
  setupScreen.classList.add("hidden");
  playerScreen.classList.remove("hidden");

  // Request fullscreen
  try {
    await document.documentElement.requestFullscreen();
  } catch (e) {
    console.warn("Fullscreen desteklenmiyor:", e);
  }

  // Set up ended event listener
  mainVideo.removeEventListener("ended", onVideoEnded);
  mainVideo.addEventListener("ended", onVideoEnded);

  // Fetch and play
  await refreshPlaylist(firmId, mode);

  // Auto-refresh every 5 minutes
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    refreshPlaylist(firmId, mode);
  }, 5 * 60 * 1000);
}

// Refresh playlist from Firestore
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

  // Check if playlist actually changed
  const oldUrls = videoPlaylist.map(v => v.fileUrl).join(",");
  const newUrls = newVideos.map(v => v.fileUrl).join(",");

  if (oldUrls !== newUrls) {
    videoPlaylist = newVideos;
    currentVideoIndex = 0;
    playVideo(0);
  }
}

// Play button click
playButton.addEventListener("click", () => {
  hideError();

  const selectedFirmId = firmSelect.value;
  const selectedMode = screenMode.value;

  if (!selectedFirmId) {
    showError("Lütfen bir firma seçin.");
    return;
  }

  if (!selectedMode) {
    showError("Lütfen bir ekran modu seçin.");
    return;
  }

  const selectedFirmName = firmSelect.options[firmSelect.selectedIndex].text;
  localStorage.setItem(LS_FIRM_ID, selectedFirmId);
  localStorage.setItem(LS_FIRM_NAME, selectedFirmName);
  localStorage.setItem(LS_SCREEN_MODE, selectedMode);

  startPlayer(selectedFirmId, selectedMode);
});

// Reset button — clear settings and show setup
resetButton.addEventListener("click", () => {
  localStorage.removeItem(LS_FIRM_ID);
  localStorage.removeItem(LS_FIRM_NAME);
  localStorage.removeItem(LS_SCREEN_MODE);

  // Stop playback
  if (refreshInterval) clearInterval(refreshInterval);
  mainVideo.pause();
  bgVideo.pause();
  mainVideo.removeAttribute("src");
  bgVideo.removeAttribute("src");
  videoPlaylist = [];
  currentVideoIndex = 0;
  hideNoVideosMessage();

  // Exit fullscreen
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }

  playerScreen.classList.add("hidden");
  setupScreen.classList.remove("hidden");

  // Reload firms for setup
  firmSelect.innerHTML = '<option value="">Firma seçin...</option>';
  loadFirms();
});

// Initialize
const hasSaved = checkSavedSettings();
if (!hasSaved) {
  loadFirms();
}
