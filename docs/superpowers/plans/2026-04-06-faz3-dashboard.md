# FAZ 3 Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite dashboard.html and dashboard.js as a dark-themed SPA with sidebar navigation, 5 pages (Overview, Screens, Contents, Playlists, Settings), modal upload, and realtime Firestore listeners.

**Architecture:** Single `dashboard.html` + single `dashboard.js`. No build tools, no npm. Each page has an `initXxx()` function that attaches `onSnapshot` listeners stored in `unsubscribers[pageId]`. On page switch, the previous page's listener is unsubscribed before the new one starts.

**Tech Stack:** Vanilla JS ES modules, Firebase v9 (Auth + Firestore + Storage), TailwindCSS CDN, Firebase Emulator for dev.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `js/firebase-config.js` | Modify | Add `updatePassword`, `reauthenticateWithCredential`, `EmailAuthProvider` exports |
| `dashboard.html` | Rewrite | Sidebar layout, 5 page containers, modal overlay, toast container |
| `js/dashboard.js` | Rewrite | All dashboard logic — auth, routing, toast, modal, 5 pages |
| `docs/CHANGELOG.md` | Modify | Add v2.0.0 entry |

`player.html`, `js/player.js`, `index.html`, `css/style.css` — **do not touch**.

---

## Task 1: firebase-config.js — Auth Exports

**Files:**
- Modify: `js/firebase-config.js`

- [ ] **Step 1: Add missing auth imports**

In `js/firebase-config.js`, change the auth import line from:
```javascript
import { getAuth, connectAuthEmulator, onAuthStateChanged, signInWithEmailAndPassword, signInAnonymously, signOut } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
```
to:
```javascript
import { getAuth, connectAuthEmulator, onAuthStateChanged, signInWithEmailAndPassword, signInAnonymously, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
```

- [ ] **Step 2: Add to export block**

Change the export block from:
```javascript
export {
  auth, db, storage,
  onAuthStateChanged, signInWithEmailAndPassword, signInAnonymously, signOut,
  ...
};
```
to:
```javascript
export {
  auth, db, storage,
  onAuthStateChanged, signInWithEmailAndPassword, signInAnonymously, signOut,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider,
  ...
};
```

- [ ] **Step 3: Verify no syntax errors**

Open `http://127.0.0.1:5000/dashboard.html` in browser — console must show no import errors. (Emulator must be running: `firebase emulators:start`)

- [ ] **Step 4: Commit**

```bash
git add js/firebase-config.js
git commit -m "feat: export updatePassword, reauthenticateWithCredential, EmailAuthProvider"
```

---

## Task 2: dashboard.html — Full Rewrite

**Files:**
- Rewrite: `dashboard.html`

- [ ] **Step 1: Write the complete HTML file**

Replace the entire contents of `dashboard.html` with:

```html
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NetOnline DS — Yönetim Paneli</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="flex h-screen bg-gray-950 text-white overflow-hidden">

  <!-- Sidebar -->
  <aside class="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
    <div class="p-4 border-b border-gray-800">
      <h1 class="text-sm font-semibold text-white">NetOnline DS</h1>
      <p class="text-xs text-gray-500 mt-0.5">Yönetim Paneli</p>
    </div>

    <nav class="flex-1 p-3 space-y-1">
      <button data-page="overview"  class="nav-btn w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
        Genel Bakış
      </button>
      <button data-page="screens"   class="nav-btn w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
        Ekranlar
      </button>
      <button data-page="contents"  class="nav-btn w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
        İçerikler
      </button>
      <button data-page="playlists" class="nav-btn w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h10"/></svg>
        Playlist'ler
      </button>
      <button data-page="settings"  class="nav-btn w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        Ayarlar
      </button>
    </nav>

    <div class="p-3 border-t border-gray-800">
      <p class="text-xs text-gray-400 truncate" id="user-email"></p>
      <button id="logout-btn" class="mt-2 text-xs text-gray-500 hover:text-red-400 transition-colors">Çıkış Yap</button>
    </div>
  </aside>

  <!-- Main content -->
  <main class="flex-1 overflow-y-auto">
    <div id="page-overview"  class="page hidden p-6"></div>
    <div id="page-screens"   class="page hidden p-6"></div>
    <div id="page-contents"  class="page hidden p-6"></div>
    <div id="page-playlists" class="page hidden p-6"></div>
    <div id="page-settings"  class="page hidden p-6"></div>
  </main>

  <!-- Toast -->
  <div id="toast-container" class="fixed bottom-4 right-4 space-y-2 z-50 pointer-events-none"></div>

  <!-- Modal -->
  <div id="modal-overlay" class="hidden fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
    <div id="modal-box" class="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"></div>
  </div>

  <script type="module" src="js/dashboard.js"></script>
</body>
</html>
```

- [ ] **Step 2: Add active nav style via Tailwind config**

Add this script block just before the `</head>` tag (after the Tailwind CDN script):

```html
<script>
  tailwind.config = {
    theme: {
      extend: {}
    }
  }
</script>
<style>
  .nav-btn.active {
    background-color: rgb(37 99 235 / 0.15);
    color: #60a5fa;
  }
</style>
```

- [ ] **Step 3: Verify structure**

Open `http://127.0.0.1:5000/dashboard.html` — sidebar must be visible on the left. Console must show no errors except "Missing or insufficient permissions" (expected before auth).

- [ ] **Step 4: Commit**

```bash
git add dashboard.html
git commit -m "feat: dashboard SPA skeleton — sidebar + 5 page containers + modal + toast"
```

---

## Task 3: dashboard.js — Foundation (Auth, Routing, Helpers)

**Files:**
- Rewrite: `js/dashboard.js`

- [ ] **Step 1: Write the complete foundation**

Replace `js/dashboard.js` entirely with:

```javascript
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
function initOverview()  { /* Task 4 */ }
function initScreens()   { /* Task 5 */ }
function initContents()  { /* Task 6 */ }
function initPlaylists() { /* Task 7 */ }
function initSettings()  { /* Task 8 */ }
```

- [ ] **Step 2: Verify auth redirect**

Open `http://127.0.0.1:5000/dashboard.html` without being logged in — must redirect to `index.html`.

Login with `admin@netonline.com` / `admin123` — must show sidebar with "Genel Bakış" active (page empty for now). Console no errors.

- [ ] **Step 3: Commit**

```bash
git add js/dashboard.js
git commit -m "feat: dashboard.js foundation — auth, routing, toast, modal, helpers"
```

---

## Task 4: Genel Bakış Sayfası

**Files:**
- Modify: `js/dashboard.js` — replace `initOverview` stub

- [ ] **Step 1: Implement initOverview**

Replace the `function initOverview()  { /* Task 4 */ }` line with:

```javascript
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
    document.getElementById("m-total-videos")?.setAttribute("data-val", snap.size);
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
```

- [ ] **Step 2: Verify Genel Bakış**

1. Emülatör çalışıyor, seed + test-upload yapıldı
2. Dashboard'a giriş yap → Genel Bakış sekmesine geç
3. 4 metrik kartı görmeli (sayılar dolmalı)
4. Ekran tablosu görünmeli (seed'den gelen A Şubesi + B Şubesi)
5. player.html'de bir ekran kaydet → Genel Bakış'ta "Çevrimiçi" badge'i 10sn içinde güncellenmeli

- [ ] **Step 3: Commit**

```bash
git add js/dashboard.js
git commit -m "feat: Genel Bakış sayfası — realtime metrik kartlar + ekran durumu tablosu"
```

---

## Task 5: Ekranlar Sayfası

**Files:**
- Modify: `js/dashboard.js` — replace `initScreens` stub

- [ ] **Step 1: Implement initScreens**

Replace `function initScreens()   { /* Task 5 */ }` with:

```javascript
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
    // Load playlists for the dropdown
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

      // Build playlist select options
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

    // Playlist select change
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

    // Edit buttons
    tbody.querySelectorAll(".btn-edit-screen").forEach(btn => {
      btn.addEventListener("click", () => openEditScreenModal(btn.dataset));
    });

    // Delete buttons
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
```

- [ ] **Step 2: Expose closeModal to inline onclick**

Add this line after the `closeModal` function definition (after the modal-overlay click listener):

```javascript
window.closeModal = closeModal;
```

- [ ] **Step 3: Verify Ekranlar sayfası**

1. "Ekranlar" sekmesine tıkla → tablo görünmeli
2. Seed'den gelen 2 ekran listelenmeli
3. Playlist dropdown'u değiştir → Firestore'da `playlistId` güncellenmeli
4. "Düzenle" → modal açılmalı, kaydet → tablo güncellenmeli
5. "Yeni Ekran Ekle" → modal → kaydet → tabloya eklenmeli

- [ ] **Step 4: Commit**

```bash
git add js/dashboard.js
git commit -m "feat: Ekranlar sayfası — onSnapshot tablo, playlist atama, düzenle/sil/yeni ekran modalları"
```

---

## Task 6: İçerikler Sayfası

**Files:**
- Modify: `js/dashboard.js` — replace `initContents` stub

- [ ] **Step 1: Implement initContents**

Replace `function initContents()  { /* Task 6 */ }` with:

```javascript
function initContents() {
  const el = document.getElementById("page-contents");

  // Build firm filter options
  let firmFilterOpts = '<option value="">Tüm Firmalar</option>';
  firmsMap.forEach((name, id) => {
    firmFilterOpts += `<option value="${esc(id)}">${esc(name)}</option>`;
  });

  el.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h2 class="text-lg font-semibold text-white">İçerikler</h2>
      <div class="flex flex-wrap items-center gap-2">
        <select id="filter-firm" class="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5">
          ${firmFilterOpts}
        </select>
        <select id="filter-orientation" class="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5">
          <option value="">Tüm Yönler</option>
          <option value="horizontal">Yatay</option>
          <option value="vertical">Dikey</option>
          <option value="both">Ortak</option>
        </select>
        <input id="filter-search" type="text" placeholder="Video ara..." maxlength="100"
          class="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 placeholder-gray-600 w-40">
        <button id="btn-upload-video" class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
          + Video Yükle
        </button>
      </div>
    </div>
    <div id="contents-empty" class="hidden text-center py-16 text-gray-600">
      <p class="text-sm">Henüz video yüklenmemiş.</p>
    </div>
    <div id="contents-table-wrap" class="hidden bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800">
            <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium w-16">Kapak</th>
            <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">Video Adı</th>
            <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">Firma</th>
            <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">Yön</th>
            <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">Bitiş</th>
            <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">Durum</th>
            <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">İşlem</th>
          </tr></thead>
          <tbody id="contents-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  let allVideos = [];

  async function loadVideos() {
    try {
      const snap = await getDocs(query(collection(db, "videos"), orderBy("createdAt", "desc")));
      allVideos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderVideos();
    } catch (e) {
      showToast("Videolar yüklenemedi: " + e.message, "error");
    }
  }

  function renderVideos() {
    const firmFilter   = document.getElementById("filter-firm")?.value || "";
    const orientFilter = document.getElementById("filter-orientation")?.value || "";
    const search       = (document.getElementById("filter-search")?.value || "").toLowerCase();

    const filtered = allVideos.filter(v => {
      if (firmFilter   && v.firmId      !== firmFilter)   return false;
      if (orientFilter && v.orientation !== orientFilter) return false;
      if (search       && !v.title?.toLowerCase().includes(search)) return false;
      return true;
    });

    const tbody    = document.getElementById("contents-tbody");
    const emptyEl  = document.getElementById("contents-empty");
    const tableWrap = document.getElementById("contents-table-wrap");
    if (!tbody) return;

    if (filtered.length === 0) {
      emptyEl?.classList.remove("hidden");
      tableWrap?.classList.add("hidden");
      return;
    }
    emptyEl?.classList.add("hidden");
    tableWrap?.classList.remove("hidden");
    tbody.innerHTML = "";

    filtered.forEach(v => {
      const BADGE = {
        horizontal: "bg-blue-500/10 text-blue-400",
        vertical:   "bg-purple-500/10 text-purple-400",
        both:       "bg-green-500/10 text-green-400"
      };
      const tr = document.createElement("tr");
      tr.className = "border-b border-gray-800/50 hover:bg-gray-800/20";

      // Thumbnail
      const tdThumb = document.createElement("td");
      tdThumb.className = "px-4 py-3";
      if (v.thumbnailUrl) {
        const img = document.createElement("img");
        img.src = v.thumbnailUrl; img.alt = v.title;
        img.className = "w-16 h-10 object-cover rounded";
        tdThumb.appendChild(img);
      } else {
        tdThumb.innerHTML = `<div class="w-16 h-10 bg-gray-800 rounded flex items-center justify-center">
          <svg class="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
          </svg></div>`;
      }

      tr.innerHTML = `
        <td class="px-4 py-3 text-gray-200 font-medium">${esc(v.title)}</td>
        <td class="px-4 py-3 text-gray-400">${esc(firmsMap.get(v.firmId) || "—")}</td>
        <td class="px-4 py-3"><span class="px-2 py-0.5 rounded text-xs font-medium ${BADGE[v.orientation] || ""}">${esc(ORIENTATION_LABEL[v.orientation] || v.orientation)}</span></td>
        <td class="px-4 py-3 text-gray-400 text-xs">${formatDate(v.expiresAt)}</td>
        <td class="px-4 py-3">
          <div class="toggle-btn w-10 h-5 rounded-full cursor-pointer transition-colors relative ${v.isActive ? "bg-blue-600" : "bg-gray-700"}"
            data-id="${esc(v.id)}" data-active="${v.isActive}">
            <span class="absolute top-0.5 ${v.isActive ? "right-0.5" : "left-0.5"} w-4 h-4 bg-white rounded-full transition-all"></span>
          </div>
        </td>
        <td class="px-4 py-3">
          <button class="btn-delete-video px-3 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded transition-colors"
            data-id="${esc(v.id)}" data-filename="${esc(v.fileName || "")}">Sil</button>
        </td>
      `;
      tr.insertBefore(tdThumb, tr.firstChild);
      tbody.appendChild(tr);
    });

    // Toggle
    tbody.querySelectorAll(".toggle-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const newActive = btn.dataset.active !== "true";
        btn.dataset.active = String(newActive);
        btn.classList.toggle("bg-blue-600", newActive);
        btn.classList.toggle("bg-gray-700", !newActive);
        const dot = btn.querySelector("span");
        dot.classList.toggle("right-0.5", newActive);
        dot.classList.toggle("left-0.5", !newActive);
        try {
          await updateDoc(doc(db, "videos", btn.dataset.id), { isActive: newActive, updatedAt: serverTimestamp() });
        } catch (e) {
          showToast("Güncellenemedi: " + e.message, "error");
          // revert
          btn.dataset.active = String(!newActive);
          btn.classList.toggle("bg-blue-600", !newActive);
          btn.classList.toggle("bg-gray-700", newActive);
          dot.classList.toggle("right-0.5", !newActive);
          dot.classList.toggle("left-0.5", newActive);
        }
      });
    });

    // Delete
    tbody.querySelectorAll(".btn-delete-video").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Bu videoyu silmek istediğinizden emin misiniz?")) return;
        const { id: videoId, filename } = btn.dataset;
        if (filename) {
          try { await deleteObject(ref(storage, "videos/" + filename)); } catch (_) {}
          try { await deleteObject(ref(storage, "thumbnails/thumb_" + filename.replace(/\.mp4$/i, ".jpg"))); } catch (_) {}
        }
        try {
          await deleteDoc(doc(db, "videos", videoId));
          showToast("Video silindi");
          await loadVideos();
        } catch (e) {
          showToast("Silinemedi: " + e.message, "error");
        }
      });
    });
  }

  // Filter events
  ["filter-firm", "filter-orientation"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", renderVideos);
  });
  document.getElementById("filter-search")?.addEventListener("input", renderVideos);

  // Upload modal
  document.getElementById("btn-upload-video").addEventListener("click", openUploadModal);

  function openUploadModal() {
    let firmUploadOpts = '<option value="">Firma seçin...</option>';
    firmsMap.forEach((name, id) => {
      firmUploadOpts += `<option value="${esc(id)}">${esc(name)}</option>`;
    });

    openModal(`
      <h3 class="text-base font-semibold text-white mb-4">Video Yükle</h3>
      <div id="upload-drop-zone" class="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500/50 hover:bg-gray-800/30 transition-colors mb-4">
        <svg class="mx-auto h-8 w-8 text-gray-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
        </svg>
        <p class="text-sm text-gray-300">Sürükle veya <span class="text-blue-400 underline">tıkla</span></p>
        <p class="text-xs text-gray-600 mt-1">MP4 · Çoklu seçim desteklenir</p>
        <input type="file" id="upload-file-input" accept=".mp4,video/mp4" multiple class="hidden">
      </div>
      <p id="upload-file-name" class="text-xs text-gray-400 mb-3 hidden"></p>
      <div id="upload-form-fields" class="hidden space-y-3">
        <div id="upload-title-wrap">
          <label class="block text-xs text-gray-400 mb-1">Video Başlığı</label>
          <input id="upload-title" type="text" maxlength="200" placeholder="Video adı"
            class="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-600">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-gray-400 mb-1">Firma</label>
            <select id="upload-firm" class="w-full bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2">
              ${firmUploadOpts}
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">Yön</label>
            <select id="upload-orientation" class="w-full bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2">
              <option value="">Seçin...</option>
              <option value="horizontal">Yatay</option>
              <option value="vertical">Dikey</option>
              <option value="both">Ortak</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">Bitiş Tarihi <span class="text-gray-600">(opsiyonel)</span></label>
          <input type="date" id="upload-expiry" class="w-full bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2">
        </div>
        <div id="upload-progress-wrap" class="hidden">
          <div class="flex justify-between mb-1">
            <span id="upload-progress-label" class="text-xs text-gray-400">Yükleniyor...</span>
            <span id="upload-progress-pct" class="text-xs text-blue-400">0%</span>
          </div>
          <div class="w-full bg-gray-800 rounded-full h-1.5">
            <div id="upload-progress-bar" class="bg-blue-600 h-1.5 rounded-full transition-all" style="width:0%"></div>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <button onclick="closeModal()" id="upload-cancel-btn" class="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg">İptal</button>
          <button id="upload-submit-btn" class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg disabled:opacity-50">Yükle</button>
        </div>
      </div>
    `);

    let selectedFiles = [];

    const dropZone  = document.getElementById("upload-drop-zone");
    const fileInput = document.getElementById("upload-file-input");

    dropZone.addEventListener("click", () => fileInput.click());
    dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("border-blue-500"); });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("border-blue-500"));
    dropZone.addEventListener("drop", e => { e.preventDefault(); dropZone.classList.remove("border-blue-500"); handleFiles(e.dataTransfer.files); });
    fileInput.addEventListener("change", () => handleFiles(fileInput.files));

    function handleFiles(files) {
      const valid = Array.from(files).filter(f => f.type === "video/mp4");
      if (!valid.length) { showToast("Yalnızca MP4 kabul edilir", "error"); return; }
      selectedFiles = valid;
      const nameEl = document.getElementById("upload-file-name");
      const formEl = document.getElementById("upload-form-fields");
      const titleWrap = document.getElementById("upload-title-wrap");
      const titleInput = document.getElementById("upload-title");

      if (valid.length === 1) {
        nameEl.textContent = valid[0].name;
        titleInput.value = valid[0].name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        titleWrap.classList.remove("hidden");
      } else {
        nameEl.textContent = `${valid.length} video seçildi`;
        titleWrap.classList.add("hidden");
      }
      nameEl.classList.remove("hidden");
      formEl.classList.remove("hidden");
    }

    document.getElementById("upload-submit-btn").addEventListener("click", async () => {
      if (!selectedFiles.length) { showToast("Dosya seçin", "error"); return; }
      const firmId      = document.getElementById("upload-firm").value;
      const orientation = document.getElementById("upload-orientation").value;
      const expiry      = document.getElementById("upload-expiry").value;
      if (selectedFiles.length === 1 && !document.getElementById("upload-title").value.trim()) {
        showToast("Başlık girin", "error"); return;
      }
      if (!firmId)      { showToast("Firma seçin", "error"); return; }
      if (!orientation) { showToast("Yön seçin", "error"); return; }

      isUploading = true;
      document.getElementById("upload-submit-btn").disabled = true;
      document.getElementById("upload-cancel-btn").disabled = true;
      document.getElementById("upload-progress-wrap").classList.remove("hidden");

      const total = selectedFiles.length;
      for (let i = 0; i < total; i++) {
        const file  = selectedFiles[i];
        const title = total === 1
          ? document.getElementById("upload-title").value.trim()
          : file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        document.getElementById("upload-progress-label").textContent =
          total > 1 ? `Video ${i + 1} / ${total} yükleniyor...` : "Yükleniyor...";
        document.getElementById("upload-progress-bar").style.width = "0%";
        document.getElementById("upload-progress-pct").textContent = "0%";
        try {
          await uploadSingleVideo(file, title, firmId, orientation, expiry);
        } catch (e) {
          showToast(`"${file.name}" yüklenemedi: ${e.message}`, "error");
        }
      }

      isUploading = false;
      closeModal();
      showToast(`${total} video yüklendi`, "success");
      await loadVideos();
    });
  }

  function uploadSingleVideo(file, title, firmId, orientation, expiry) {
    return new Promise((resolve, reject) => {
      const fileName   = Date.now() + "_" + file.name;
      const storageRef = ref(storage, "videos/" + fileName);
      const task       = uploadBytesResumable(storageRef, file);

      task.on("state_changed",
        snap => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          const bar = document.getElementById("upload-progress-bar");
          const pctEl = document.getElementById("upload-progress-pct");
          if (bar) bar.style.width = pct + "%";
          if (pctEl) pctEl.textContent = pct + "%";
        },
        reject,
        async () => {
          try {
            const fileUrl = await getDownloadURL(task.snapshot.ref);
            let thumbnailUrl = "";
            try { thumbnailUrl = await generateThumbnail(file, fileName); } catch (_) {}
            const videoRef = doc(collection(db, "videos"));
            await setDoc(videoRef, {
              title, firmId, orientation, fileName, fileUrl, thumbnailUrl,
              isActive: true,
              expiresAt: expiry ? new Date(expiry) : null,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            resolve();
          } catch (e) { reject(e); }
        }
      );
    });
  }

  function generateThumbnail(file, fileName) {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "auto"; video.muted = true; video.playsInline = true;
      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;
      let captured = false;
      const captureFrame = async () => {
        if (captured) return;
        captured = true;
        try {
          const canvas = document.createElement("canvas");
          canvas.width  = video.videoWidth  || 640;
          canvas.height = video.videoHeight || 360;
          canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(async blob => {
            URL.revokeObjectURL(objectUrl);
            if (!blob) { reject(new Error("Canvas blob oluşturulamadı")); return; }
            const thumbFileName = "thumb_" + fileName.replace(/\.mp4$/i, ".jpg");
            const thumbRef = ref(storage, "thumbnails/" + thumbFileName);
            await uploadBytesResumable(thumbRef, blob);
            resolve(await getDownloadURL(thumbRef));
          }, "image/jpeg", 0.75);
        } catch (e) { URL.revokeObjectURL(objectUrl); reject(e); }
      };
      video.addEventListener("loadedmetadata", () => { video.currentTime = video.duration > 1 ? 1 : video.duration * 0.25; });
      video.addEventListener("seeked", captureFrame);
      setTimeout(() => { if (!captured) captureFrame(); }, 4000);
      video.addEventListener("error", () => { URL.revokeObjectURL(objectUrl); reject(new Error("Video yüklenemedi")); });
    });
  }

  unsubscribers.contents = null;
  loadVideos();
}
```

- [ ] **Step 2: Verify İçerikler sayfası**

1. "İçerikler" sekmesi → tablo görünmeli (test-upload ile yüklenen 2 video)
2. "+ Video Yükle" → modal açılmalı
3. Dosya seç → form alanları çıkmalı
4. Firma + yön seç → Yükle → progress bar → tablo güncellenmeli
5. Toggle → aktif/pasif değişmeli
6. Sil → onay → video kaybolmalı
7. Firma filtresi → listeyi filtrelemeli

- [ ] **Step 3: Commit**

```bash
git add js/dashboard.js
git commit -m "feat: İçerikler sayfası — upload modal, video tablosu, filtreler, toggle, sil"
```

---

## Task 7: Playlist'ler Sayfası

**Files:**
- Modify: `js/dashboard.js` — replace `initPlaylists` stub

- [ ] **Step 1: Implement initPlaylists**

Replace `function initPlaylists() { /* Task 7 */ }` with:

```javascript
function initPlaylists() {
  const el = document.getElementById("page-playlists");
  el.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-lg font-semibold text-white">Playlist'ler</h2>
      <button id="btn-new-playlist" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
        + Yeni Playlist
      </button>
    </div>
    <div id="playlists-empty" class="hidden text-center py-16 text-gray-600"><p class="text-sm">Henüz playlist yok.</p></div>
    <div id="playlists-table-wrap" class="hidden bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <table class="w-full text-sm">
        <thead><tr class="border-b border-gray-800">
          <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">Playlist Adı</th>
          <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">Firma</th>
          <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">Video Sayısı</th>
          <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">İşlemler</th>
        </tr></thead>
        <tbody id="playlists-tbody"></tbody>
      </table>
    </div>
  `;

  async function loadPlaylists() {
    try {
      const snap = await getDocs(collection(db, "playlists"));
      const tbody  = document.getElementById("playlists-tbody");
      const emptyEl = document.getElementById("playlists-empty");
      const tableWrap = document.getElementById("playlists-table-wrap");
      if (!tbody) return;
      tbody.innerHTML = "";

      if (snap.empty) {
        emptyEl?.classList.remove("hidden");
        tableWrap?.classList.add("hidden");
        return;
      }
      emptyEl?.classList.add("hidden");
      tableWrap?.classList.remove("hidden");

      snap.forEach(d => {
        const p = d.data();
        const tr = document.createElement("tr");
        tr.className = "border-b border-gray-800/50 hover:bg-gray-800/20";
        tr.innerHTML = `
          <td class="px-4 py-3 text-gray-200 font-medium">${esc(p.name)}</td>
          <td class="px-4 py-3 text-gray-400">${esc(firmsMap.get(p.firmId) || "—")}</td>
          <td class="px-4 py-3 text-gray-400">${(p.items || []).length}</td>
          <td class="px-4 py-3 flex gap-2">
            <button class="btn-edit-pl px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded" data-id="${esc(d.id)}">Düzenle</button>
            <button class="btn-delete-pl px-2 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded" data-id="${esc(d.id)}" data-name="${esc(p.name)}">Sil</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll(".btn-edit-pl").forEach(btn => {
        btn.addEventListener("click", async () => {
          const snap = await getDoc(doc(db, "playlists", btn.dataset.id));
          if (snap.exists()) openPlaylistModal(btn.dataset.id, snap.data());
        });
      });

      tbody.querySelectorAll(".btn-delete-pl").forEach(btn => {
        btn.addEventListener("click", async () => {
          // Check if any screen uses this playlist
          const screensSnap = await getDocs(query(collection(db, "screens"), where("playlistId", "==", btn.dataset.id)));
          if (!screensSnap.empty) {
            if (!confirm(`Bu playlist ${screensSnap.size} ekranda kullanılıyor. Yine de silmek istiyor musunuz?`)) return;
          } else {
            if (!confirm(`"${btn.dataset.name}" silinecek. Emin misiniz?`)) return;
          }
          try {
            await deleteDoc(doc(db, "playlists", btn.dataset.id));
            showToast("Playlist silindi");
            loadPlaylists();
          } catch (e) {
            showToast("Silinemedi: " + e.message, "error");
          }
        });
      });
    } catch (e) {
      showToast("Playlist'ler yüklenemedi: " + e.message, "error");
    }
  }

  document.getElementById("btn-new-playlist").addEventListener("click", () => openPlaylistModal(null, null));

  async function openPlaylistModal(playlistId, existing) {
    openModal(`
      <h3 class="text-base font-semibold text-white mb-4">${playlistId ? "Playlist Düzenle" : "Yeni Playlist"}</h3>
      <div class="space-y-3">
        <div>
          <label class="block text-xs text-gray-400 mb-1">Playlist Adı</label>
          <input id="pl-name" type="text" maxlength="100" value="${esc(existing?.name || "")}" placeholder="Playlist adı"
            class="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-600">
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">Firma</label>
          <select id="pl-firm" class="w-full bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2">
            ${firmsOptions(existing?.firmId || "")}
          </select>
        </div>
        <div id="pl-videos-wrap" class="${existing?.firmId ? "" : "hidden"}">
          <label class="block text-xs text-gray-400 mb-2">Videolar</label>
          <div id="pl-video-list" class="max-h-40 overflow-y-auto space-y-1 bg-gray-800 rounded-lg p-2 mb-3"></div>
          <label class="block text-xs text-gray-400 mb-2">Sıra</label>
          <div id="pl-order-list" class="space-y-1 max-h-40 overflow-y-auto"></div>
        </div>
        <div id="pl-error" class="hidden text-xs text-red-400 bg-red-400/10 rounded p-2"></div>
        <div class="flex justify-end gap-2 pt-2">
          <button onclick="closeModal()" class="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg">İptal</button>
          <button id="pl-save" class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg">Kaydet</button>
        </div>
      </div>
    `);

    // orderedVideoIds: array of videoId strings in display order
    let orderedVideoIds = (existing?.items || [])
      .sort((a, b) => a.order - b.order)
      .map(i => i.videoId);

    let videosForFirm = [];  // { id, title }

    async function loadVideosForFirm(firmId) {
      const snap = await getDocs(query(collection(db, "videos"), where("firmId", "==", firmId)));
      videosForFirm = snap.docs.map(d => ({ id: d.id, title: d.data().title }));
      renderVideoCheckboxes();
      renderOrderList();
    }

    function renderVideoCheckboxes() {
      const container = document.getElementById("pl-video-list");
      if (!container) return;
      container.innerHTML = "";
      videosForFirm.forEach(v => {
        const isChecked = orderedVideoIds.includes(v.id);
        const label = document.createElement("label");
        label.className = "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-700 cursor-pointer";
        label.innerHTML = `
          <input type="checkbox" value="${esc(v.id)}" ${isChecked ? "checked" : ""} class="accent-blue-500">
          <span class="text-sm text-gray-300">${esc(v.title)}</span>
        `;
        label.querySelector("input").addEventListener("change", e => {
          if (e.target.checked) {
            if (!orderedVideoIds.includes(v.id)) orderedVideoIds.push(v.id);
          } else {
            orderedVideoIds = orderedVideoIds.filter(id => id !== v.id);
          }
          renderOrderList();
        });
        container.appendChild(label);
      });
    }

    function renderOrderList() {
      const container = document.getElementById("pl-order-list");
      if (!container) return;
      container.innerHTML = "";
      orderedVideoIds.forEach((vId, idx) => {
        const v = videosForFirm.find(x => x.id === vId);
        const title = v?.title || vId;
        const row = document.createElement("div");
        row.className = "flex items-center gap-2 bg-gray-800 border border-gray-700 rounded px-3 py-2";
        row.innerHTML = `
          <span class="text-xs text-gray-500 w-4">${idx + 1}</span>
          <span class="flex-1 text-sm text-gray-200 truncate">${esc(title)}</span>
          <div class="flex gap-1">
            <button class="btn-up w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs flex items-center justify-center ${idx === 0 ? "opacity-30 cursor-not-allowed" : ""}" data-idx="${idx}">↑</button>
            <button class="btn-dn w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs flex items-center justify-center ${idx === orderedVideoIds.length - 1 ? "opacity-30 cursor-not-allowed" : ""}" data-idx="${idx}">↓</button>
            <button class="btn-rm w-6 h-6 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs flex items-center justify-center" data-idx="${idx}">✕</button>
          </div>
        `;
        row.querySelector(".btn-up").addEventListener("click", () => {
          if (idx === 0) return;
          [orderedVideoIds[idx - 1], orderedVideoIds[idx]] = [orderedVideoIds[idx], orderedVideoIds[idx - 1]];
          renderOrderList();
        });
        row.querySelector(".btn-dn").addEventListener("click", () => {
          if (idx === orderedVideoIds.length - 1) return;
          [orderedVideoIds[idx], orderedVideoIds[idx + 1]] = [orderedVideoIds[idx + 1], orderedVideoIds[idx]];
          renderOrderList();
        });
        row.querySelector(".btn-rm").addEventListener("click", () => {
          orderedVideoIds.splice(idx, 1);
          renderVideoCheckboxes();
          renderOrderList();
        });
        container.appendChild(row);
      });
    }

    // Firm change
    document.getElementById("pl-firm").addEventListener("change", async (e) => {
      const firmId = e.target.value;
      const wrap = document.getElementById("pl-videos-wrap");
      if (!firmId) { wrap?.classList.add("hidden"); return; }
      wrap?.classList.remove("hidden");
      orderedVideoIds = [];
      await loadVideosForFirm(firmId);
    });

    // If editing, load videos for existing firm
    if (existing?.firmId) {
      await loadVideosForFirm(existing.firmId);
    }

    // Save
    document.getElementById("pl-save").addEventListener("click", async () => {
      const name   = document.getElementById("pl-name").value.trim();
      const firmId = document.getElementById("pl-firm").value;
      const errEl  = document.getElementById("pl-error");

      if (!name)   { errEl.textContent = "Playlist adı girin."; errEl.classList.remove("hidden"); return; }
      if (!firmId) { errEl.textContent = "Firma seçin.";        errEl.classList.remove("hidden"); return; }
      errEl.classList.add("hidden");

      const items = orderedVideoIds.map((vId, i) => ({ videoId: vId, order: i, durationOverride: null }));
      const btn = document.getElementById("pl-save");
      btn.disabled = true; btn.textContent = "Kaydediliyor...";

      try {
        if (playlistId) {
          await updateDoc(doc(db, "playlists", playlistId), { name, firmId, items, updatedAt: serverTimestamp() });
          showToast("Playlist güncellendi");
        } else {
          await addDoc(collection(db, "playlists"), { name, firmId, items, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
          showToast("Playlist oluşturuldu");
        }
        closeModal();
        loadPlaylists();
      } catch (e) {
        errEl.textContent = e.message;
        errEl.classList.remove("hidden");
        btn.disabled = false; btn.textContent = "Kaydet";
      }
    });
  }

  unsubscribers.playlists = null;
  loadPlaylists();
}
```

- [ ] **Step 2: Verify Playlist'ler sayfası**

1. "Playlist'ler" sekmesi → seed'den gelen "Örnek Playlist" görünmeli
2. "+ Yeni Playlist" → modal → firma seç → videolar görünmeli → checkbox'ları işaretle → ↑↓ sırala → kaydet
3. "Düzenle" → mevcut items ile modal açılmalı
4. "Sil" → bağlı ekran varsa uyarı, yoksa direkt sil

- [ ] **Step 3: Commit**

```bash
git add js/dashboard.js
git commit -m "feat: Playlist'ler sayfası — CRUD modal, video seçimi, ↑↓ sıralama, bağımlılık kontrolü"
```

---

## Task 8: Ayarlar Sayfası

**Files:**
- Modify: `js/dashboard.js` — replace `initSettings` stub

- [ ] **Step 1: Implement initSettings**

Replace `function initSettings()  { /* Task 8 */ }` with:

```javascript
function initSettings() {
  const el = document.getElementById("page-settings");
  el.innerHTML = `
    <h2 class="text-lg font-semibold text-white mb-6">Ayarlar</h2>

    <!-- Firma Yönetimi -->
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
      <h3 class="text-sm font-semibold text-gray-300 mb-4">Firma Yönetimi</h3>
      <div class="flex gap-2 mb-4">
        <input id="new-firm-input" type="text" maxlength="100" placeholder="Yeni firma adı"
          class="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-600">
        <button id="btn-add-firm" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
          Ekle
        </button>
      </div>
      <div id="firms-list" class="space-y-2"></div>
    </div>

    <!-- Şifre Değiştirme -->
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 class="text-sm font-semibold text-gray-300 mb-4">Şifre Değiştir</h3>
      <div class="space-y-3 max-w-sm">
        <div>
          <label class="block text-xs text-gray-400 mb-1">Mevcut Şifre</label>
          <input id="pw-current" type="password" class="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2">
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">Yeni Şifre</label>
          <input id="pw-new" type="password" class="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2">
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">Tekrar</label>
          <input id="pw-confirm" type="password" class="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2">
        </div>
        <p id="pw-error" class="hidden text-xs text-red-400"></p>
        <button id="btn-change-pw" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
          Şifreyi Güncelle
        </button>
      </div>
    </div>
  `;

  // ---- Firma yönetimi ----
  const unsubFirms = onSnapshot(collection(db, "firms"), (snap) => {
    const container = document.getElementById("firms-list");
    if (!container) return;
    container.innerHTML = "";
    snap.forEach(d => {
      const row = document.createElement("div");
      row.className = "flex items-center gap-2 py-2 border-b border-gray-800/50";
      row.innerHTML = `
        <input class="firm-name-input flex-1 bg-transparent border-0 text-gray-200 text-sm px-1 py-0.5 rounded focus:bg-gray-800 focus:border focus:border-gray-700 outline-none"
          value="${esc(d.data().name)}" data-id="${esc(d.id)}" data-original="${esc(d.data().name)}" maxlength="100">
        <button class="btn-save-firm hidden px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded" data-id="${esc(d.id)}">Kaydet</button>
        <button class="btn-delete-firm px-2 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded" data-id="${esc(d.id)}" data-name="${esc(d.data().name)}">Sil</button>
      `;
      container.appendChild(row);
    });

    // Show save button when value changes
    container.querySelectorAll(".firm-name-input").forEach(input => {
      input.addEventListener("input", () => {
        const saveBtn = input.parentElement.querySelector(".btn-save-firm");
        saveBtn.classList.toggle("hidden", input.value.trim() === input.dataset.original);
      });
    });

    container.querySelectorAll(".btn-save-firm").forEach(btn => {
      btn.addEventListener("click", async () => {
        const input = btn.parentElement.querySelector(".firm-name-input");
        const newName = input.value.trim();
        if (!newName) return;
        try {
          await updateDoc(doc(db, "firms", btn.dataset.id), { name: newName });
          input.dataset.original = newName;
          btn.classList.add("hidden");
          firmsMap.set(btn.dataset.id, newName);
          showToast("Firma güncellendi");
        } catch (e) {
          showToast("Güncellenemedi: " + e.message, "error");
        }
      });
    });

    container.querySelectorAll(".btn-delete-firm").forEach(btn => {
      btn.addEventListener("click", async () => {
        const firmId = btn.dataset.id;
        const name   = btn.dataset.name;
        try {
          const [screensSnap, videosSnap] = await Promise.all([
            getDocs(query(collection(db, "screens"), where("firmId", "==", firmId))),
            getDocs(query(collection(db, "videos"),  where("firmId", "==", firmId)))
          ]);
          const msg = screensSnap.size + videosSnap.size > 0
            ? `Bu firmaya bağlı ${screensSnap.size} ekran ve ${videosSnap.size} video var. Yine de silmek istiyor musunuz?`
            : `"${name}" firmasını silmek istediğinizden emin misiniz?`;
          if (!confirm(msg)) return;
          await deleteDoc(doc(db, "firms", firmId));
          firmsMap.delete(firmId);
          showToast("Firma silindi");
        } catch (e) {
          showToast("Silinemedi: " + e.message, "error");
        }
      });
    });
  });

  document.getElementById("btn-add-firm").addEventListener("click", async () => {
    const input = document.getElementById("new-firm-input");
    const name  = input.value.trim();
    if (!name) return;
    try {
      const docRef = await addDoc(collection(db, "firms"), { name, createdAt: serverTimestamp() });
      firmsMap.set(docRef.id, name);
      input.value = "";
      showToast("Firma eklendi");
    } catch (e) {
      showToast("Eklenemedi: " + e.message, "error");
    }
  });

  // ---- Şifre değiştirme ----
  document.getElementById("btn-change-pw").addEventListener("click", async () => {
    const current  = document.getElementById("pw-current").value;
    const newPw    = document.getElementById("pw-new").value;
    const confirm_ = document.getElementById("pw-confirm").value;
    const errEl    = document.getElementById("pw-error");

    if (!current || !newPw || !confirm_) {
      errEl.textContent = "Tüm alanları doldurun."; errEl.classList.remove("hidden"); return;
    }
    if (newPw !== confirm_) {
      errEl.textContent = "Yeni şifreler eşleşmiyor."; errEl.classList.remove("hidden"); return;
    }
    if (newPw.length < 6) {
      errEl.textContent = "Şifre en az 6 karakter olmalı."; errEl.classList.remove("hidden"); return;
    }
    errEl.classList.add("hidden");

    const btn = document.getElementById("btn-change-pw");
    btn.disabled = true; btn.textContent = "Güncelleniyor...";

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, current);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPw);
      document.getElementById("pw-current").value = "";
      document.getElementById("pw-new").value     = "";
      document.getElementById("pw-confirm").value = "";
      showToast("Şifre güncellendi");
    } catch (e) {
      errEl.textContent = e.code === "auth/wrong-password"
        ? "Mevcut şifre yanlış."
        : e.message;
      errEl.classList.remove("hidden");
    } finally {
      btn.disabled = false; btn.textContent = "Şifreyi Güncelle";
    }
  });

  unsubscribers.settings = unsubFirms;
}
```

- [ ] **Step 2: Verify Ayarlar sayfası**

1. "Ayarlar" sekmesi → firmalar listesi görünmeli
2. Yeni firma adı gir → Ekle → listede görünmeli
3. Firma adını değiştir → Kaydet → firmsMap güncellenmeli
4. Firma sil → bağlı kayıt varsa uyarı, yoksa silinmeli
5. Yanlış mevcut şifre → hata mesajı
6. Doğru şifre + eşleşen yeni şifre → başarı toast

- [ ] **Step 3: Commit**

```bash
git add js/dashboard.js
git commit -m "feat: Ayarlar sayfası — firma CRUD, bağımlılık kontrolü, şifre değiştirme"
```

---

## Task 9: CHANGELOG + Final Verification

**Files:**
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Update CHANGELOG**

`docs/CHANGELOG.md` başına ekle:

```markdown
## [2.0.0] — 2026-04-06

### Eklendi
- Sidebar navigasyonlu modern SPA dashboard (5 sayfa, JS tab switching, sayfa yenileme yok)
- Genel Bakış: realtime metrik kartları (Toplam/Çevrimiçi Ekran, Toplam/Aktif Video) + ekran durumu tablosu
- Ekranlar sayfası: playlist atama, düzenleme, silme, dashboard'dan yeni ekran ekleme
- Playlist yönetimi: oluştur, düzenle, ↑↓ sıralama, ekrana ata, bağımlılık kontrolü
- Ayarlar: dinamik firma CRUD (bağımlılık kontrolü ile) + şifre değiştirme
- Toast notification sistemi (success/error/info, 3.5sn auto-remove)
- Modal sistemi (overlay click ile kapatma, upload sırasında kilit)

### Değiştirildi
- Dashboard tek sayfa yapısından SPA mimarisine geçildi
- Video upload formu sabit görünümden modal'a taşındı
- Genel Bakış ve Ekranlar sayfaları onSnapshot realtime'a geçildi
- Sayfa geçişlerinde önceki onSnapshot listener'lar temizleniyor (bellek sızıntısı yok)

### Kaldırıldı
- Eski header+main tek sayfa dashboard layout
- css/style.css dashboard bağımlılığı (player.html hâlâ kullanıyor)
```

- [ ] **Step 2: Full integration test**

Emülatör çalışıyor (`firebase emulators:start`), seed + test-upload yapıldı. Şunları sırayla doğrula:

1. `http://127.0.0.1:5000/dashboard.html` → login → Genel Bakış açılıyor
2. Sidebar navigasyon: tüm 5 sekme tıklanıyor, sayfa yenileme yok
3. `http://127.0.0.1:5000/player.html` açılıyor → ekran kaydediliyor → Genel Bakış'ta "Çevrimiçi" badge'i görünüyor
4. Dashboard Ekranlar → playlist ata → player 10sn içinde değişimi algılıyor
5. İçerikler → video yükle → tabloda görünüyor
6. Playlist oluştur → ekrana ata → player playlist'i oynatıyor
7. `http://127.0.0.1:5000/index.html` login sayfası etkilenmemiş

- [ ] **Step 3: Final commit + tag**

```bash
git add docs/CHANGELOG.md
git commit -m "chore: v2.0.0 — FAZ3 dashboard SPA yeniden yazımı tamamlandı"
git tag v2.0.0
```

---

## Self-Review

**Spec coverage check:**
- ✅ 3A Layout: Task 2 (dashboard.html)
- ✅ 3B Genel Bakış: Task 4
- ✅ 3C Ekranlar: Task 5
- ✅ 3D İçerikler: Task 6
- ✅ 3E Playlist'ler: Task 7
- ✅ 3F Ayarlar: Task 8
- ✅ 3G Helpers (toast, modal, timeAgo): Task 3
- ✅ 3H Kod kuralları (try/catch→toast, confirm, onSnapshot, loading): tüm task'larda uygulandı
- ✅ firebase-config.js güncellemesi: Task 1
- ✅ CHANGELOG: Task 9

**Placeholder scan:** Tüm code blokları complete. TBD yok.

**Type consistency:**
- `firmsOptions()` → Task 3'te tanımlandı, Task 5/7/8'de kullanıldı ✅
- `esc()`, `timeAgo()`, `formatDate()`, `ORIENTATION_LABEL` → Task 3'te tanımlandı, Task 4-8'de kullanıldı ✅
- `showToast()`, `openModal()`, `closeModal()` → Task 3'te tanımlandı ✅
- `window.closeModal = closeModal` → Task 5 Step 2'de eklendi, modal innerHTML onclick'ler için gerekli ✅
- `isUploading` state → Task 3'te tanımlandı, Task 6'da set/unset edildi ✅
