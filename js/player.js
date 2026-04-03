// js/player.js
import {
  db,
  collection, getDocs
} from "./firebase-config.js";

// DOM elements
const setupScreen = document.getElementById("setupScreen");
const playerScreen = document.getElementById("playerScreen");
const firmSelect = document.getElementById("firmSelect");
const screenMode = document.getElementById("screenMode");
const playButton = document.getElementById("playButton");
const setupError = document.getElementById("setupError");
const resetButton = document.getElementById("resetButton");

// Local Storage keys
const LS_FIRM_ID = "netonline_firmId";
const LS_FIRM_NAME = "netonline_firmName";
const LS_SCREEN_MODE = "netonline_screenMode";

// Check Local Storage on load
function checkSavedSettings() {
  const savedFirmId = localStorage.getItem(LS_FIRM_ID);
  const savedScreenMode = localStorage.getItem(LS_SCREEN_MODE);

  if (savedFirmId && savedScreenMode) {
    // Settings exist — skip setup, go to player
    startPlayer(savedFirmId, savedScreenMode);
    return true;
  }
  return false;
}

// Load firms from Firestore into dropdown
async function loadFirms() {
  try {
    const firmsSnapshot = await getDocs(collection(db, "firms"));
    firmsSnapshot.forEach((doc) => {
      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = doc.data().name;
      firmSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Firmalar yüklenirken hata:", error);
    showError("Firmalar yüklenemedi. İnternet bağlantınızı kontrol edin.");
  }
}

// Show error message
function showError(message) {
  setupError.textContent = message;
  setupError.classList.remove("hidden");
}

// Hide error message
function hideError() {
  setupError.classList.add("hidden");
}

// Start player (switch from setup to player screen)
function startPlayer(firmId, screenMode) {
  setupScreen.classList.add("hidden");
  playerScreen.classList.remove("hidden");

  // Phase 4 will add video loading and playback logic here
  console.log(`Player başlatıldı — Firma: ${firmId}, Mod: ${screenMode}`);
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

  // Save to Local Storage
  const selectedFirmName = firmSelect.options[firmSelect.selectedIndex].text;
  localStorage.setItem(LS_FIRM_ID, selectedFirmId);
  localStorage.setItem(LS_FIRM_NAME, selectedFirmName);
  localStorage.setItem(LS_SCREEN_MODE, selectedMode);

  startPlayer(selectedFirmId, selectedMode);
});

// Reset button (gear icon) — clear settings and show setup
resetButton.addEventListener("click", () => {
  localStorage.removeItem(LS_FIRM_ID);
  localStorage.removeItem(LS_FIRM_NAME);
  localStorage.removeItem(LS_SCREEN_MODE);

  playerScreen.classList.add("hidden");
  setupScreen.classList.remove("hidden");
});

// Initialize
const hasSaved = checkSavedSettings();
if (!hasSaved) {
  loadFirms();
}
