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
  const pageEl = document.getElementById("page-" + pageId);
  if (!pageEl) { console.warn("Unknown page:", pageId); return; }
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  pageEl.classList.remove("hidden");
  // Toggle nav active state
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelector(`[data-page="${pageId}"]`)?.classList.add("active");
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
    const diff = Math.max(0, Date.now() - timestamp.toDate().getTime());
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
function initOverview() {
  const el = document.getElementById("page-overview");
  el.innerHTML = `
    <h2 class="text-lg font-semibold text-white mb-6">Genel Bakış</h2>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p class="text-xs text-gray-500 mb-1">Toplam Ekran</p>
        <p class="text-2xl font-bold text-white" id="m-total-screens">—</p>
      </div>
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p class="text-xs text-gray-500 mb-1">Çevrimiçi</p>
        <p class="text-2xl font-bold text-green-400" id="m-online-screens">—</p>
      </div>
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p class="text-xs text-gray-500 mb-1">Toplam Video</p>
        <p class="text-2xl font-bold text-white" id="m-total-videos">—</p>
      </div>
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p class="text-xs text-gray-500 mb-1">Aktif Video</p>
        <p class="text-2xl font-bold text-white" id="m-active-videos">—</p>
      </div>
    </div>
    <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-800">
        <h3 class="text-sm font-medium text-gray-300">Ekran Durumu</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800">
            <th class="text-left px-4 py-2 text-xs text-gray-500 font-medium">Ekran Adı</th>
            <th class="text-left px-4 py-2 text-xs text-gray-500 font-medium">Firma</th>
            <th class="text-left px-4 py-2 text-xs text-gray-500 font-medium">Durum</th>
            <th class="text-left px-4 py-2 text-xs text-gray-500 font-medium">Şu An Oynayan</th>
            <th class="text-left px-4 py-2 text-xs text-gray-500 font-medium">Son Görülme</th>
          </tr></thead>
          <tbody id="overview-screen-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  const unsubVideos = onSnapshot(collection(db, "videos"), (snap) => {
    const active = snap.docs.filter(d => d.data().isActive).length;
    const tv = document.getElementById("m-total-videos");
    const av = document.getElementById("m-active-videos");
    if (tv) tv.textContent = snap.size;
    if (av) av.textContent = active;
  });

  const unsubScreens = onSnapshot(collection(db, "screens"), (snap) => {
    const now = Date.now();
    const TWO_MIN = 2 * 60 * 1000;
    let online = 0;
    const tbody = document.getElementById("overview-screen-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    snap.forEach(d => {
      const s = d.data();
      const lastMs = s.lastSeen?.toDate?.().getTime() ?? 0;
      const isOnline = (now - lastMs) < TWO_MIN;
      if (isOnline) online++;

      const tr = document.createElement("tr");
      tr.className = "border-b border-gray-800/50 hover:bg-gray-800/20";
      tr.innerHTML = `
        <td class="px-4 py-3 text-gray-200 font-medium">${esc(s.name)}</td>
        <td class="px-4 py-3 text-gray-400">${esc(firmsMap.get(s.firmId) || "—")}</td>
        <td class="px-4 py-3">
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
            ${isOnline ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}">
            <span class="w-1.5 h-1.5 rounded-full ${isOnline ? "bg-green-400" : "bg-red-400"}"></span>
            ${isOnline ? "Çevrimiçi" : "Çevrimdışı"}
          </span>
        </td>
        <td class="px-4 py-3 text-gray-400 text-xs">${esc(s.currentVideoTitle || "—")}</td>
        <td class="px-4 py-3 text-gray-500 text-xs">${timeAgo(s.lastSeen)}</td>
      `;
      tbody.appendChild(tr);
    });

    const ts = document.getElementById("m-total-screens");
    const os = document.getElementById("m-online-screens");
    if (ts) ts.textContent = snap.size;
    if (os) os.textContent = online;
  });

  unsubscribers.overview = () => { unsubScreens(); unsubVideos(); };
}
function initScreens()   { document.getElementById("page-screens").innerHTML   = '<p class="text-gray-500 text-sm">Yükleniyor...</p>'; }
function initContents()  { document.getElementById("page-contents").innerHTML  = '<p class="text-gray-500 text-sm">Yükleniyor...</p>'; }
function initPlaylists() { document.getElementById("page-playlists").innerHTML = '<p class="text-gray-500 text-sm">Yükleniyor...</p>'; }
function initSettings()  { document.getElementById("page-settings").innerHTML  = '<p class="text-gray-500 text-sm">Yükleniyor...</p>'; }
