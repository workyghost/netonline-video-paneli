// js/dashboard.js

// ========== IMPORTS ==========
import {
  auth, db, storage,
  onAuthStateChanged, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider,
  collection, doc, addDoc, getDoc, getDocs, setDoc, deleteDoc, updateDoc,
  query, where, orderBy, onSnapshot, serverTimestamp,
  ref, uploadBytesResumable, getDownloadURL, deleteObject
} from "./firebase-config.js";

// ========== STATE ==========
let currentPage = "overview";
let firmsMap    = new Map();   // firmId → firmName
let unsubscribers = {};        // pageId → unsubscribe fn
let currentUser   = null;
let isUploading   = false;     // blocks modal close during upload

// ========== AUTH ==========
onAuthStateChanged(auth, async (user) => {
  if (!user || user.isAnonymous) {
    window.location.href = "index.html";
    return;
  }
  currentUser = user;
  document.getElementById("user-email").textContent = user.email;
  await loadFirmsMap();
  showPage("overview");
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (e) {
    showToast("Çıkış yapılamadı: " + e.message, "error");
  }
});

// ========== ROUTING ==========
function showPage(pageId) {
  // Unsubscribe previous page listeners
  if (unsubscribers[currentPage]) {
    unsubscribers[currentPage]();
    unsubscribers[currentPage] = null;
  }
  // Toggle page visibility
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.getElementById("page-" + pageId).classList.remove("hidden");
  // Toggle nav active state
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelector(`[data-page="${pageId}"]`).classList.add("active");
  currentPage = pageId;
  // Init page
  const inits = {
    overview:  initOverview,
    screens:   initScreens,
    contents:  initContents,
    playlists: initPlaylists,
    settings:  initSettings
  };
  inits[pageId]?.();
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => showPage(btn.dataset.page));
});

// ========== TOAST ==========
function showToast(message, type = "success") {
  const colors = {
    success: "bg-green-600 text-white",
    error:   "bg-red-600 text-white",
    info:    "bg-gray-700 text-white"
  };
  const toast = document.createElement("div");
  toast.className = `px-4 py-3 rounded-lg text-sm font-medium shadow-lg pointer-events-auto ${colors[type] ?? colors.info}`;
  toast.textContent = message;
  document.getElementById("toast-container").appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ========== MODAL ==========
function openModal(htmlContent) {
  document.getElementById("modal-box").innerHTML = htmlContent;
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() {
  if (isUploading) return;
  document.getElementById("modal-overlay").classList.add("hidden");
  document.getElementById("modal-box").innerHTML = "";
}

document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// Expose closeModal for inline onclick handlers inside modal innerHTML
window.closeModal = closeModal;

// ========== HELPERS ==========
function esc(str) {
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(String(str ?? "")));
  return d.innerHTML;
}

function timeAgo(timestamp) {
  if (!timestamp) return "—";
  try {
    const diff = Date.now() - timestamp.toDate().getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1)  return "Az önce";
    if (minutes < 60) return `${minutes} dakika önce`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)   return `${hours} saat önce`;
    return timestamp.toDate().toLocaleDateString("tr-TR");
  } catch { return "—"; }
}

function formatDate(ts) {
  if (!ts) return "Sınırsız";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("tr-TR");
  } catch { return "Sınırsız"; }
}

const ORIENTATION_LABEL = { horizontal: "Yatay", vertical: "Dikey", both: "Ortak" };

async function loadFirmsMap() {
  try {
    const snap = await getDocs(collection(db, "firms"));
    firmsMap.clear();
    snap.forEach(d => firmsMap.set(d.id, d.data().name));
  } catch (e) {
    showToast("Firmalar yüklenemedi", "error");
  }
}

function firmsOptions(selected = "") {
  let html = '<option value="">Firma seçin...</option>';
  firmsMap.forEach((name, id) => {
    html += `<option value="${esc(id)}" ${id === selected ? "selected" : ""}>${esc(name)}</option>`;
  });
  return html;
}

// ========== PAGE STUBS (filled in subsequent tasks) ==========
function initOverview()  { document.getElementById("page-overview").innerHTML  = '<p class="text-gray-500 text-sm">Yükleniyor...</p>'; }
function initScreens()   { document.getElementById("page-screens").innerHTML   = '<p class="text-gray-500 text-sm">Yükleniyor...</p>'; }
function initContents()  { document.getElementById("page-contents").innerHTML  = '<p class="text-gray-500 text-sm">Yükleniyor...</p>'; }
function initPlaylists() { document.getElementById("page-playlists").innerHTML = '<p class="text-gray-500 text-sm">Yükleniyor...</p>'; }
function initSettings()  { document.getElementById("page-settings").innerHTML  = '<p class="text-gray-500 text-sm">Yükleniyor...</p>'; }
