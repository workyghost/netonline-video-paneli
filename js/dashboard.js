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
function initScreens() {
  const el = document.getElementById("page-screens");
  el.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-lg font-semibold text-white">Ekranlar</h2>
      <button id="btn-add-screen" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
        + Yeni Ekran Ekle
      </button>
    </div>
    <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800">
            <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">Ekran Adı</th>
            <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">Firma</th>
            <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">Konum</th>
            <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">Yön</th>
            <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">Durum</th>
            <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">Playlist</th>
            <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">İşlemler</th>
          </tr></thead>
          <tbody id="screens-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("btn-add-screen").addEventListener("click", () => openAddScreenModal());

  const unsubScreens = onSnapshot(collection(db, "screens"), async (snap) => {
    const playlistsSnap = await getDocs(collection(db, "playlists"));
    const playlists = playlistsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const tbody = document.getElementById("screens-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    const now = Date.now();
    const TWO_MIN = 2 * 60 * 1000;

    snap.forEach(d => {
      const s = d.data();
      const screenId = d.id;
      const lastMs = s.lastSeen?.toDate?.().getTime() ?? 0;
      const isOnline = (now - lastMs) < TWO_MIN;

      let plOpts = '<option value="">Otomatik (Playlist Yok)</option>';
      playlists.forEach(p => {
        plOpts += `<option value="${esc(p.id)}" ${s.playlistId === p.id ? "selected" : ""}>${esc(p.name)}</option>`;
      });

      const tr = document.createElement("tr");
      tr.className = "border-b border-gray-800/50 hover:bg-gray-800/20";
      tr.innerHTML = `
        <td class="px-4 py-3 text-gray-200 font-medium">${esc(s.name)}</td>
        <td class="px-4 py-3 text-gray-400">${esc(firmsMap.get(s.firmId) || "—")}</td>
        <td class="px-4 py-3 text-gray-400 text-xs">${esc(s.location || "—")}</td>
        <td class="px-4 py-3 text-gray-400 text-xs">${esc(ORIENTATION_LABEL[s.orientation] || s.orientation)}</td>
        <td class="px-4 py-3">
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
            ${isOnline ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}">
            <span class="w-1.5 h-1.5 rounded-full ${isOnline ? "bg-green-400" : "bg-red-400"}"></span>
            ${isOnline ? "Çevrimiçi" : "Çevrimdışı"}
          </span>
        </td>
        <td class="px-4 py-3">
          <select class="playlist-select bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1"
            data-screen-id="${esc(screenId)}">${plOpts}</select>
        </td>
        <td class="px-4 py-3 flex gap-2">
          <button class="btn-edit-screen px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            data-id="${esc(screenId)}" data-name="${esc(s.name)}" data-location="${esc(s.location||"")}" data-orientation="${esc(s.orientation)}" data-firm="${esc(s.firmId)}">
            Düzenle
          </button>
          <button class="btn-delete-screen px-2 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded transition-colors"
            data-id="${esc(screenId)}" data-name="${esc(s.name)}">
            Sil
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".playlist-select").forEach(sel => {
      sel.addEventListener("change", async (e) => {
        const sid = e.target.dataset.screenId;
        const val = e.target.value || null;
        try {
          await updateDoc(doc(db, "screens", sid), { playlistId: val });
          showToast("Playlist güncellendi", "success");
        } catch (err) {
          showToast("Güncellenemedi: " + err.message, "error");
        }
      });
    });

    tbody.querySelectorAll(".btn-edit-screen").forEach(btn => {
      btn.addEventListener("click", () => openEditScreenModal(btn.dataset));
    });

    tbody.querySelectorAll(".btn-delete-screen").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm(`"${btn.dataset.name}" ekranını silmek istediğinizden emin misiniz?`)) return;
        try {
          await deleteDoc(doc(db, "screens", btn.dataset.id));
          showToast("Ekran silindi");
        } catch (err) {
          showToast("Silinemedi: " + err.message, "error");
        }
      });
    });
  });

  unsubscribers.screens = unsubScreens;
}

function openAddScreenModal() {
  openModal(`
    <h3 class="text-base font-semibold text-white mb-4">Yeni Ekran Ekle</h3>
    <div class="space-y-3">
      <div>
        <label class="block text-xs text-gray-400 mb-1">Firma</label>
        <select id="ms-firm" class="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2">
          ${firmsOptions()}
        </select>
      </div>
      <div>
        <label class="block text-xs text-gray-400 mb-1">Ekran Adı</label>
        <input id="ms-name" type="text" maxlength="100" placeholder="Kadıköy Şubesi - Giriş TV"
          class="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-600">
      </div>
      <div>
        <label class="block text-xs text-gray-400 mb-1">Konum</label>
        <input id="ms-location" type="text" maxlength="100" placeholder="İstanbul, Kadıköy"
          class="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-600">
      </div>
      <div>
        <label class="block text-xs text-gray-400 mb-2">Yön</label>
        <div class="flex gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="ms-orientation" value="horizontal" class="accent-blue-500"> <span class="text-sm text-gray-300">Yatay</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="ms-orientation" value="vertical" class="accent-blue-500"> <span class="text-sm text-gray-300">Dikey</span>
          </label>
        </div>
      </div>
      <div id="ms-error" class="hidden text-xs text-red-400 bg-red-400/10 rounded p-2"></div>
      <div class="flex justify-end gap-2 pt-2">
        <button onclick="closeModal()" class="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors">İptal</button>
        <button id="ms-save" class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">Kaydet</button>
      </div>
    </div>
  `);

  document.getElementById("ms-save").addEventListener("click", async () => {
    const firmId      = document.getElementById("ms-firm").value;
    const name        = document.getElementById("ms-name").value.trim();
    const location    = document.getElementById("ms-location").value.trim();
    const orientation = document.querySelector('input[name="ms-orientation"]:checked')?.value;
    const errEl       = document.getElementById("ms-error");

    if (!firmId || !name || !location || !orientation) {
      errEl.textContent = "Tüm alanları doldurun.";
      errEl.classList.remove("hidden");
      return;
    }
    errEl.classList.add("hidden");
    const btn = document.getElementById("ms-save");
    btn.disabled = true; btn.textContent = "Kaydediliyor...";

    try {
      await addDoc(collection(db, "screens"), {
        firmId, name, location, orientation,
        status: "offline",
        lastSeen: serverTimestamp(),
        currentVideoId: null,
        currentVideoTitle: null,
        playlistId: null,
        registeredAt: serverTimestamp()
      });
      closeModal();
      showToast("Ekran eklendi");
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove("hidden");
      btn.disabled = false; btn.textContent = "Kaydet";
    }
  });
}

function openEditScreenModal({ id, name, location, orientation, firm }) {
  openModal(`
    <h3 class="text-base font-semibold text-white mb-4">Ekranı Düzenle</h3>
    <div class="space-y-3">
      <div>
        <label class="block text-xs text-gray-400 mb-1">Ekran Adı</label>
        <input id="es-name" type="text" maxlength="100" value="${esc(name)}"
          class="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2">
      </div>
      <div>
        <label class="block text-xs text-gray-400 mb-1">Konum</label>
        <input id="es-location" type="text" maxlength="100" value="${esc(location)}"
          class="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2">
      </div>
      <div>
        <label class="block text-xs text-gray-400 mb-2">Yön</label>
        <div class="flex gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="es-orientation" value="horizontal" ${orientation === "horizontal" ? "checked" : ""} class="accent-blue-500">
            <span class="text-sm text-gray-300">Yatay</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="es-orientation" value="vertical" ${orientation === "vertical" ? "checked" : ""} class="accent-blue-500">
            <span class="text-sm text-gray-300">Dikey</span>
          </label>
        </div>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button onclick="closeModal()" class="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg">İptal</button>
        <button id="es-save" class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg">Kaydet</button>
      </div>
    </div>
  `);

  document.getElementById("es-save").addEventListener("click", async () => {
    const newName     = document.getElementById("es-name").value.trim();
    const newLocation = document.getElementById("es-location").value.trim();
    const newOrient   = document.querySelector('input[name="es-orientation"]:checked')?.value;
    if (!newName || !newLocation || !newOrient) return;
    try {
      await updateDoc(doc(db, "screens", id), { name: newName, location: newLocation, orientation: newOrient });
      closeModal();
      showToast("Ekran güncellendi");
    } catch (e) {
      showToast(e.message, "error");
    }
  });
}
function initContents()  { document.getElementById("page-contents").innerHTML  = '<p class="text-gray-500 text-sm">Yükleniyor...</p>'; }
function initPlaylists() { document.getElementById("page-playlists").innerHTML = '<p class="text-gray-500 text-sm">Yükleniyor...</p>'; }
function initSettings()  { document.getElementById("page-settings").innerHTML  = '<p class="text-gray-500 text-sm">Yükleniyor...</p>'; }
