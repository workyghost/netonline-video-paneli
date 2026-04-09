// js/dashboard.js

// ========== IMPORTS ==========
import { supabase, SUPABASE_URL } from "./supabase-config.js";

// ========== STATE ==========
let currentPage = "overview";
let firmsMap    = new Map();   // firmId → firmName
let unsubscribers = {};        // pageId → unsubscribe fn
let currentUser   = null;
let isUploading   = false;     // blocks modal close during upload

// ========== AUTH ==========
// NOT: onAuthStateChange içinden asla supabase DB sorgusu çağırmayın —
// Supabase JS v2 auth callback'i session lock tutarken çağrılır,
// DB sorgusu da aynı lock'ı almaya çalışır → deadlock.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || !session) {
    window.location.href = "index.html";
  }
});

// Initial check — getSession lock dışında çalışır, DB sorgusu güvenli
supabase.auth.getSession().then(async ({ data: { session } }) => {
  if (!session) {
    window.location.href = "index.html";
    return;
  }
  currentUser = session.user;
  document.getElementById("user-email").textContent = currentUser.email;
  await loadFirmsMap();
  showPage("overview");
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
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
  const container = document.getElementById("toast-container");
  const colors = {
    success: "bg-green-600 text-white",
    error:   "bg-red-600 text-white",
    info:    "bg-gray-700 text-white"
  };
  const toast = document.createElement("div");
  toast.className = `flex items-start gap-2 px-4 py-3 rounded-lg text-sm font-medium shadow-lg pointer-events-auto ${colors[type] ?? colors.info}`;

  const msgSpan = document.createElement("span");
  msgSpan.className = "flex-1";
  msgSpan.textContent = message;
  toast.appendChild(msgSpan);

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.className = "ml-1 opacity-60 hover:opacity-100 flex-shrink-0 leading-none";
  closeBtn.addEventListener("click", () => toast.remove());
  toast.appendChild(closeBtn);

  container.appendChild(toast);

  if (type !== "error") {
    setTimeout(() => toast.remove(), 3500);
  }
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
    const date = new Date(timestamp);
    const diff = Math.max(0, Date.now() - date.getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1)  return "Az önce";
    if (minutes < 60) return `${minutes} dakika önce`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)   return `${hours} saat önce`;
    return date.toLocaleDateString("tr-TR");
  } catch { return "—"; }
}

const isImage = fn => /\.(jpg|jpeg|png)$/i.test(fn || "");

function formatDate(ts) {
  if (!ts) return "Sınırsız";
  try {
    const d = new Date(ts);
    return d.toLocaleDateString("tr-TR");
  } catch { return "Sınırsız"; }
}


async function loadFirmsMap() {
  try {
    const { data: firms, error } = await supabase.from("firms").select("id, name");
    if (error) throw error;
    firmsMap.clear();
    firms.forEach(d => firmsMap.set(d.id, d.name));
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

  const fetchVideosCount = async () => {
    const [{ count: total }, { count: active }] = await Promise.all([
      supabase.from("videos").select("*", { count: "exact", head: true }),
      supabase.from("videos").select("*", { count: "exact", head: true }).eq("is_active", true)
    ]);
    const tv = document.getElementById("m-total-videos");
    const av = document.getElementById("m-active-videos");
    if (tv) tv.textContent = total || 0;
    if (av) av.textContent = active || 0;
  };

  const fetchScreens = async () => {
    const { data: screens, error } = await supabase.from("screens").select("*");
    if (error) return;

    const now = Date.now();
    const TWO_MIN = 2 * 60 * 1000;
    let online = 0;
    const tbody = document.getElementById("overview-screen-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    (screens || []).forEach(s => {
      const lastMs = s.last_seen ? new Date(s.last_seen).getTime() : 0;
      const isOnline = (now - lastMs) < TWO_MIN;
      if (isOnline) online++;

      const tr = document.createElement("tr");
      tr.className = "border-b border-gray-800/50 hover:bg-gray-800/20";
      tr.innerHTML = `
        <td class="px-4 py-3 text-gray-200 font-medium">${esc(s.name)}</td>
        <td class="px-4 py-3 text-gray-400">${esc(firmsMap.get(s.firm_id) || "—")}</td>
        <td class="px-4 py-3">
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
            ${isOnline ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}">
            <span class="w-1.5 h-1.5 rounded-full ${isOnline ? "bg-green-400" : "bg-red-400"}"></span>
            ${isOnline ? "Çevrimiçi" : "Çevrimdışı"}
          </span>
        </td>
        <td class="px-4 py-3 text-gray-400 text-xs">${esc(s.current_video_title || "—")}</td>
        <td class="px-4 py-3 text-gray-500 text-xs">${timeAgo(s.last_seen)}</td>
      `;
      tbody.appendChild(tr);
    });

    const ts = document.getElementById("m-total-screens");
    const os = document.getElementById("m-online-screens");
    if (ts) ts.textContent = screens.length;
    if (os) os.textContent = online;
  };

  const renderNoFirmsBanner = () => {
    const existing = document.getElementById("no-firms-banner");
    if (firmsMap.size === 0) {
      if (!existing) {
        const banner = document.createElement("div");
        banner.id = "no-firms-banner";
        banner.className = "mb-4 flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm rounded-xl px-4 py-3";
        banner.innerHTML = `
          <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
          <span>Henüz hiç firma eklenmedi. <button class="underline hover:text-yellow-300 transition-colors" onclick="document.querySelector('[data-page=settings]').click()">Ayarlar</button> sayfasından firma ekleyebilirsiniz.</span>
        `;
        el.insertBefore(banner, el.firstChild);
      }
    } else {
      existing?.remove();
    }
  };

  fetchVideosCount();
  fetchScreens();
  renderNoFirmsBanner();

  const unsubVideos = supabase.channel("public:videos_overview")
    .on("postgres_changes", { event: "*", schema: "public", table: "videos" }, fetchVideosCount)
    .subscribe();

  const unsubScreens = supabase.channel("public:screens_overview")
    .on("postgres_changes", { event: "*", schema: "public", table: "screens" }, fetchScreens)
    .subscribe();

  unsubscribers.overview = () => { supabase.removeChannel(unsubVideos); supabase.removeChannel(unsubScreens); };
}
function initScreens() {
  let generation = 0;
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
            <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">Durum</th>
            <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">Playlist</th>
            <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">İşlemler</th>
          </tr></thead>
          <tbody id="screens-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("btn-add-screen").addEventListener("click", () => openAddScreenModal(fetchScreens));

  const fetchScreens = async () => {
    const myGen = ++generation;
    const [{ data: playlists }, { data: screens }] = await Promise.all([
      supabase.from("playlists").select("*"),
      supabase.from("screens").select("*")
    ]);
    
    if (myGen !== generation) return;

    const tbody = document.getElementById("screens-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    const now = Date.now();
    const TWO_MIN = 2 * 60 * 1000;

    (screens || []).forEach(s => {
      const screenId = s.id;
      const lastMs = s.last_seen ? new Date(s.last_seen).getTime() : 0;
      const isOnline = (now - lastMs) < TWO_MIN;

      let plOpts = '<option value="">Otomatik (Playlist Yok)</option>';
      (playlists || []).forEach(p => {
        plOpts += `<option value="${esc(p.id)}" ${s.playlist_id === p.id ? "selected" : ""}>${esc(p.name)}</option>`;
      });

      const tr = document.createElement("tr");
      tr.className = "border-b border-gray-800/50 hover:bg-gray-800/20";
      tr.innerHTML = `
        <td class="px-4 py-3 text-gray-200 font-medium">${esc(s.name)}</td>
        <td class="px-4 py-3 text-gray-400">${esc(firmsMap.get(s.firm_id) || "—")}</td>
        <td class="px-4 py-3 text-gray-400 text-xs">${esc(s.location || "—")}</td>
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
            data-id="${esc(screenId)}" data-name="${esc(s.name)}" data-location="${esc(s.location||"")}" data-firm="${esc(s.firm_id)}">
            Düzenle
          </button>
          <button class="btn-copy-link px-2 py-1 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded transition-colors"
            data-id="${esc(screenId)}">
            🔗 Linki Kopyala
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
        const { error } = await supabase.from("screens").update({ playlist_id: val }).eq("id", sid);
        if (error) showToast("Güncellenemedi: " + error.message, "error");
        else showToast("Playlist güncellendi", "success");
      });
    });

    tbody.querySelectorAll(".btn-edit-screen").forEach(btn => {
      btn.addEventListener("click", () => openEditScreenModal(btn.dataset, fetchScreens));
    });

    tbody.querySelectorAll(".btn-copy-link").forEach(btn => {
      btn.addEventListener("click", () => {
        const url = window.location.origin + "/player.html?screen=" + btn.dataset.id;
        navigator.clipboard.writeText(url).then(() => {
          showToast("Link kopyalandı! → " + url, "success");
        }).catch(() => {
          showToast("Kopyalanamadı, manuel kopyalayın: " + url, "error");
        });
      });
    });

    tbody.querySelectorAll(".btn-delete-screen").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm(`"${btn.dataset.name}" ekranını silmek istediğinizden emin misiniz?`)) return;
        const { error } = await supabase.from("screens").delete().eq("id", btn.dataset.id);
        if (error) showToast("Silinemedi: " + error.message, "error");
        else showToast("Ekran silindi");
      });
    });
  };

  fetchScreens();
  const unsubScreens = supabase.channel("public:screens_list")
    .on("postgres_changes", { event: "*", schema: "public", table: "screens" }, fetchScreens)
    .on("postgres_changes", { event: "*", schema: "public", table: "playlists" }, fetchScreens)
    .subscribe();

  unsubscribers.screens = () => { supabase.removeChannel(unsubScreens); };
}

function openAddScreenModal(onSuccess) {
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
    const errEl = document.getElementById("ms-error");

    if (!firmId || !name || !location) {
      errEl.textContent = "Tüm alanları doldurun.";
      errEl.classList.remove("hidden");
      return;
    }
    errEl.classList.add("hidden");
    const btn = document.getElementById("ms-save");
    btn.disabled = true; btn.textContent = "Kaydediliyor...";

    try {
      const { error } = await supabase.from("screens").insert([{
        firm_id: firmId,
        name, location,
        status: "offline",
        last_seen: new Date().toISOString(),
        current_video_id: null,
        current_video_title: null,
        playlist_id: null,
        registered_at: new Date().toISOString()
      }]);
      if (error) throw error;
      closeModal();
      onSuccess();
      showToast("Ekran eklendi");
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove("hidden");
      btn.disabled = false; btn.textContent = "Kaydet";
    }
  });
}

function openEditScreenModal({ id, name, location, firm }, onSuccess) {
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
      <div class="flex justify-end gap-2 pt-2">
        <button onclick="closeModal()" class="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg">İptal</button>
        <button id="es-save" class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg">Kaydet</button>
      </div>
    </div>
  `);

  document.getElementById("es-save").addEventListener("click", async () => {
    const newName     = document.getElementById("es-name").value.trim();
    const newLocation = document.getElementById("es-location").value.trim();
    if (!newName || !newLocation) return;
    const { error } = await supabase.from("screens").update({ name: newName, location: newLocation }).eq("id", id);
    if (error) showToast(error.message, "error");
    else {
      closeModal();
      onSuccess();
      showToast("Ekran güncellendi");
    }
  });
}
function initContents() {
  const el = document.getElementById("page-contents");

  let firmFilterOpts = '<option value="">Tüm Firmalar</option>';
  firmFilterOpts += '<option value="__orphan__">— Sahipsiz</option>';
  firmsMap.forEach((name, id) => {
    firmFilterOpts += `<option value="${esc(id)}">${esc(name)}</option>`;
  });

  el.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-semibold text-white">İçerikler</h2>
        <button id="btn-bulk-delete" class="hidden px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors">
          Seçilenleri Sil (<span id="bulk-delete-count">0</span>)
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <select id="filter-firm" class="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5">
          ${firmFilterOpts}
        </select>
        <input id="filter-search" type="text" placeholder="Video ara..." maxlength="100"
          class="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 placeholder-gray-600 w-40">
        <button id="btn-upload-video" class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
          + İçerik Yükle
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
            <th class="px-4 py-3 w-8">
              <input type="checkbox" id="chk-select-all" class="rounded border-gray-600 bg-gray-800 text-blue-600">
            </th>
            <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium w-16">Kapak</th>
            <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">Video Adı</th>
            <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">Firma</th>
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
      const { data: videos, error } = await supabase.from("videos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      allVideos = videos || [];
      renderVideos();
    } catch (e) {
      showToast("Videolar yüklenemedi: " + e.message, "error");
    }
  }

  function updateBulkUI() {
    const checked = document.querySelectorAll(".chk-video:checked");
    const btn     = document.getElementById("btn-bulk-delete");
    const counter = document.getElementById("bulk-delete-count");
    if (btn)     btn.classList.toggle("hidden", checked.length === 0);
    if (counter) counter.textContent = checked.length;
  }

  function renderVideos() {
    const firmFilter = document.getElementById("filter-firm")?.value || "";
    const search     = (document.getElementById("filter-search")?.value || "").toLowerCase();

    const filtered = allVideos.filter(v => {
      if (firmFilter === "__orphan__" && v.firm_id != null) return false;
      if (firmFilter && firmFilter !== "__orphan__" && v.firm_id !== firmFilter) return false;
      if (search && !v.title?.toLowerCase().includes(search)) return false;
      return true;
    });

    const tbody     = document.getElementById("contents-tbody");
    const emptyEl   = document.getElementById("contents-empty");
    const tableWrap = document.getElementById("contents-table-wrap");
    if (!tbody) return;

    tbody.innerHTML = "";
    if (filtered.length === 0) {
      emptyEl?.classList.remove("hidden");
      tableWrap?.classList.add("hidden");
      return;
    }
    emptyEl?.classList.add("hidden");
    tableWrap?.classList.remove("hidden");

    filtered.forEach(v => {
      const tr = document.createElement("tr");
      tr.className = "border-b border-gray-800/50 hover:bg-gray-800/20";

      const tdThumb = document.createElement("td");
      tdThumb.className = "px-4 py-3";
      if (v.thumbnail_url) {
        const img = document.createElement("img");
        img.src = v.thumbnail_url; img.alt = v.title;
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
        <td class="px-4 py-3 text-gray-400">${esc(firmsMap.get(v.firm_id) || "—")}</td>
        <td class="px-4 py-3 text-gray-400 text-xs">${formatDate(v.expires_at)}</td>
        <td class="px-4 py-3">
          <div class="toggle-btn w-10 h-5 rounded-full cursor-pointer transition-colors relative ${v.is_active ? "bg-blue-600" : "bg-gray-700"}"
            data-id="${esc(v.id)}" data-active="${v.is_active}">
            <span class="absolute top-0.5 ${v.is_active ? "right-0.5" : "left-0.5"} w-4 h-4 bg-white rounded-full transition-all"></span>
          </div>
        </td>
        <td class="px-4 py-3">
          <button class="btn-delete-video px-3 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded transition-colors"
            data-id="${esc(v.id)}" data-filename="${esc(v.file_name || "")}">Sil</button>
        </td>
      `;
      const tdCheck = document.createElement("td");
      tdCheck.className = "px-4 py-3";
      tdCheck.innerHTML = `<input type="checkbox" class="chk-video rounded border-gray-600 bg-gray-800 text-blue-600" data-id="${esc(v.id)}">`;
      tr.insertBefore(tdThumb, tr.firstChild);
      tr.insertBefore(tdCheck, tr.firstChild);
      tbody.appendChild(tr);
    });

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
          const { error } = await supabase.from("videos").update({ is_active: newActive, updated_at: new Date().toISOString() }).eq("id", btn.dataset.id);
          if (error) throw error;
        } catch (e) {
          showToast("Güncellenemedi: " + e.message, "error");
          btn.dataset.active = String(!newActive);
          btn.classList.toggle("bg-blue-600", !newActive);
          btn.classList.toggle("bg-gray-700", newActive);
          dot.classList.toggle("right-0.5", !newActive);
          dot.classList.toggle("left-0.5", newActive);
        }
      });
    });

    tbody.querySelectorAll(".btn-delete-video").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Bu videoyu silmek istediğinizden emin misiniz?")) return;
        const videoId = btn.dataset.id;
        const video = allVideos.find(v => v.id === videoId);
        const fileName = video?.file_name || "";
        if (fileName) {
          try { await supabase.storage.from("digital-signage").remove(["videos/" + fileName]); } catch (_) {}
          try { await supabase.storage.from("digital-signage").remove(["thumbnails/thumb_" + fileName.replace(/\.[^.]+$/, ".jpg")]); } catch (_) {}
        }
        try {
          const { error } = await supabase.from("videos").delete().eq("id", videoId);
          if (error) throw error;
          showToast("Video silindi");
          await loadVideos();
        } catch (e) {
          showToast("Silinemedi: " + e.message, "error");
        }
      });
    });

    // Satır checkbox'ları
    tbody.querySelectorAll(".chk-video").forEach(chk => {
      chk.addEventListener("change", () => {
        const all = document.getElementById("chk-select-all");
        const boxes = document.querySelectorAll(".chk-video");
        if (all) {
          const allChecked = [...boxes].every(b => b.checked);
          const someChecked = [...boxes].some(b => b.checked);
          all.checked = allChecked;
          all.indeterminate = someChecked && !allChecked;
        }
        updateBulkUI();
      });
    });

    updateBulkUI();
  }

  ["filter-firm"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", renderVideos);
  });
  document.getElementById("filter-search")?.addEventListener("input", renderVideos);
  document.getElementById("chk-select-all")?.addEventListener("change", () => {
    document.querySelectorAll(".chk-video").forEach(chk => {
      chk.checked = document.getElementById("chk-select-all").checked;
    });
    updateBulkUI();
  });

  document.getElementById("btn-bulk-delete")?.addEventListener("click", async () => {
    const checked = [...document.querySelectorAll(".chk-video:checked")];
    if (checked.length === 0) return;
    if (!confirm(`${checked.length} içerik silinecek. Bu işlem geri alınamaz. Emin misiniz?`)) return;

    let successCount = 0;
    let errorCount = 0;

    for (const chk of checked) {
      const videoId = chk.dataset.id;
      const video = allVideos.find(v => v.id === videoId);
      const fileName = video?.file_name || "";
      if (fileName) {
        try { await supabase.storage.from("digital-signage").remove(["videos/" + fileName]); } catch (_) {}
        try { await supabase.storage.from("digital-signage").remove(["thumbnails/thumb_" + fileName.replace(/\.[^.]+$/, ".jpg")]); } catch (_) {}
      }
      try {
        const { error: dbError } = await supabase.from("videos").delete().eq("id", videoId);
        if (dbError) throw dbError;
        successCount++;
      } catch (_) {
        errorCount++;
      }
    }

    if (errorCount > 0) showToast(`${successCount} silindi, ${errorCount} silinemedi`, "error");
    else showToast(`${successCount} içerik silindi`);
    await loadVideos();
  });

  document.getElementById("btn-upload-video").addEventListener("click", openUploadModal);

  function openUploadModal() {
    let firmUploadOpts = '<option value="">Firma seçin...</option>';
    firmsMap.forEach((name, id) => {
      firmUploadOpts += `<option value="${esc(id)}">${esc(name)}</option>`;
    });

    openModal(`
      <h3 class="text-base font-semibold text-white mb-4">İçerik Yükle</h3>
      <div id="upload-drop-zone" class="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500/50 hover:bg-gray-800/30 transition-colors mb-4">
        <svg class="mx-auto h-8 w-8 text-gray-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
        </svg>
        <p class="text-sm text-gray-300">Sürükle veya <span class="text-blue-400 underline">tıkla</span></p>
        <p class="text-xs text-gray-600 mt-1">MP4 · JPG · PNG · Çoklu seçim desteklenir</p>
        <input type="file" id="upload-file-input" accept=".mp4,video/mp4,.jpg,.jpeg,.png,image/jpeg,image/png" multiple class="hidden">
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
      const valid = Array.from(files).filter(f =>
        f.type === "video/mp4" || f.type === "image/jpeg" || f.type === "image/png"
      );
      if (!valid.length) { showToast("Yalnızca MP4, JPG, PNG kabul edilir", "error"); return; }
      selectedFiles = valid;
      const nameEl    = document.getElementById("upload-file-name");
      const formEl    = document.getElementById("upload-form-fields");
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
      const expiry = document.getElementById("upload-expiry").value;
      if (selectedFiles.length === 1 && !document.getElementById("upload-title").value.trim()) {
        showToast("Başlık girin", "error"); return;
      }
      if (!firmId) { showToast("Firma seçin", "error"); return; }

      isUploading = true;
      document.getElementById("upload-submit-btn").disabled = true;
      document.getElementById("upload-cancel-btn").disabled = true;
      document.getElementById("upload-progress-wrap").classList.remove("hidden");

      const total = selectedFiles.length;
      let successCount = 0;
      try {
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
            await uploadSingleVideo(file, title, firmId, expiry);
            successCount++;
          } catch (e) {
            showToast(`"${file.name}" yüklenemedi: ${e.message}`, "error");
          }
        }
      } finally {
        isUploading = false;
      }
      closeModal();
      if (successCount > 0) showToast(`${successCount} video yüklendi`, "success");
      await loadVideos();
    });
  }

  function uploadSingleVideo(file, title, firmId, expiry) {
    return new Promise(async (resolve, reject) => {
      const fileName = Date.now() + "_" + file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
      const bar     = document.getElementById("upload-progress-bar");
      const pctEl   = document.getElementById("upload-progress-pct");
      const labelEl = document.getElementById("upload-progress-label");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return reject(new Error("Oturum bulunamadı"));

      const storageUrl = `${SUPABASE_URL}/storage/v1/object/digital-signage/videos/${fileName}`;
      const fileUrl    = `${SUPABASE_URL}/storage/v1/object/public/digital-signage/videos/${fileName}`;

      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct     = Math.round((e.loaded / e.total) * 95);
        const sentMB  = (e.loaded  / 1024 / 1024).toFixed(1);
        const totalMB = (e.total   / 1024 / 1024).toFixed(1);
        if (bar)     bar.style.width  = pct + "%";
        if (pctEl)   pctEl.textContent = pct + "%";
        if (labelEl) labelEl.textContent = `Yükleniyor... ${sentMB} / ${totalMB} MB`;
      };

      xhr.onload = async () => {
        if (xhr.status === 200 || xhr.status === 201) {
          if (bar)   bar.style.width   = "98%";
          if (pctEl) pctEl.textContent = "98%";

          let thumbnailUrl = "";
          if (isImage(fileName)) {
            thumbnailUrl = fileUrl;
          } else {
            try { thumbnailUrl = await generateThumbnail(file, fileName); } catch (_) {}
          }

          const { error: dbError } = await supabase.from("videos").insert([{
            title, firm_id: firmId, file_name: fileName, file_url: fileUrl,
            orientation: 'horizontal',
            thumbnail_url: thumbnailUrl, is_active: true,
            expires_at: expiry ? new Date(expiry).toISOString() : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);

          if (bar)   bar.style.width   = "100%";
          if (pctEl) pctEl.textContent = "100%";

          if (dbError) reject(dbError);
          else resolve();
        } else {
          let msg = `Yükleme hatası (HTTP ${xhr.status})`;
          if (xhr.status === 413) msg = "Dosya çok büyük — sunucu limiti aşıldı (413). VPS'te Nginx/Kong client_max_body_size artırılmalı.";
          else if (xhr.status === 403) msg = "Yetkisiz erişim (403). Storage bucket izinlerini kontrol edin.";
          else if (xhr.status === 404) msg = "Storage bucket bulunamadı (404). 'digital-signage' bucket'ın oluşturulduğunu doğrulayın.";
          reject(new Error(msg));
        }
      };

      xhr.onerror   = () => reject(new Error("Ağ hatası. İnternet bağlantınızı kontrol edin."));
      xhr.ontimeout = () => reject(new Error("Yükleme zaman aşımı (10 dk). Dosya çok büyük veya bağlantı çok yavaş."));

      xhr.open("POST", storageUrl);
      xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
      xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
      xhr.timeout = 10 * 60 * 1000; // 10 dakika

      xhr.send(file);
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
            const thumbFileName = "thumb_" + fileName.replace(/\.[^/.]+$/, ".jpg");
            const { error: tErr } = await supabase.storage.from("digital-signage").upload("thumbnails/" + thumbFileName, blob);
            if (tErr) return reject(tErr);
            const { data: { publicUrl } } = supabase.storage.from("digital-signage").getPublicUrl("thumbnails/" + thumbFileName);
            resolve(publicUrl);
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
      const { data: playlists, error } = await supabase.from("playlists").select("*");
      if (error) throw error;
      const tbody    = document.getElementById("playlists-tbody");
      const emptyEl  = document.getElementById("playlists-empty");
      const tableWrap = document.getElementById("playlists-table-wrap");
      if (!tbody) return;
      tbody.innerHTML = "";

      if (!playlists || playlists.length === 0) {
        emptyEl?.classList.remove("hidden");
        tableWrap?.classList.add("hidden");
        return;
      }
      emptyEl?.classList.add("hidden");
      tableWrap?.classList.remove("hidden");

      playlists.forEach(p => {
        const tr = document.createElement("tr");
        tr.className = "border-b border-gray-800/50 hover:bg-gray-800/20";
        tr.innerHTML = `
          <td class="px-4 py-3 text-gray-200 font-medium">${esc(p.name)}</td>
          <td class="px-4 py-3 text-gray-400">${esc(firmsMap.get(p.firm_id) || "—")}</td>
          <td class="px-4 py-3 text-gray-400">${(p.items || []).length}</td>
          <td class="px-4 py-3 flex gap-2">
            <button class="btn-edit-pl px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded" data-id="${esc(p.id)}">Düzenle</button>
            <button class="btn-delete-pl px-2 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded" data-id="${esc(p.id)}" data-name="${esc(p.name)}">Sil</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll(".btn-edit-pl").forEach(btn => {
        btn.addEventListener("click", async () => {
          const { data: plSnap } = await supabase.from("playlists").select("*").eq("id", btn.dataset.id).single();
          if (plSnap) openPlaylistModal(btn.dataset.id, plSnap);
        });
      });

      tbody.querySelectorAll(".btn-delete-pl").forEach(btn => {
        btn.addEventListener("click", async () => {
          const { count } = await supabase.from("screens").select("*", { count: 'exact', head: true }).eq("playlist_id", btn.dataset.id);
          if (count > 0) {
            if (!confirm(`Bu playlist ${count} ekranda kullanılıyor. Yine de silmek istiyor musunuz?`)) return;
          } else {
            if (!confirm(`"${btn.dataset.name}" silinecek. Emin misiniz?`)) return;
          }
          try {
            const { error } = await supabase.from("playlists").delete().eq("id", btn.dataset.id);
            if (error) throw error;
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
            ${firmsOptions(existing?.firm_id || "")}
          </select>
        </div>
        <div id="pl-videos-wrap" class="${existing?.firm_id ? "" : "hidden"}">
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

    let orderedVideoIds = (existing?.items || [])
      .sort((a, b) => a.order - b.order)
      .map(i => i.videoId);

    let videosForFirm = [];

    async function loadVideosForFirm(firmId) {
      try {
        const { data: snap } = await supabase.from("videos").select("id, title").eq("firm_id", firmId);
        videosForFirm = (snap || []).map(d => ({ id: d.id, title: d.title }));
        renderVideoCheckboxes();
        renderOrderList();
      } catch (e) {
        showToast("Videolar yüklenemedi: " + e.message, "error");
      }
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

    document.getElementById("pl-firm").addEventListener("change", async (e) => {
      const firmId = e.target.value;
      const wrap = document.getElementById("pl-videos-wrap");
      if (!firmId) { wrap?.classList.add("hidden"); return; }
      wrap?.classList.remove("hidden");
      orderedVideoIds = [];
      await loadVideosForFirm(firmId);
    });

    if (existing?.firm_id) {
      await loadVideosForFirm(existing.firm_id);
    }

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
          const { error } = await supabase.from("playlists").update({ name, firm_id: firmId, items, updated_at: new Date().toISOString() }).eq("id", playlistId);
          if (error) throw error;
          showToast("Playlist güncellendi");
        } else {
          const { error } = await supabase.from("playlists").insert([{ name, firm_id: firmId, items, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
          if (error) throw error;
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
  const fetchFirms = async () => {
    const { data: firms, error } = await supabase.from("firms").select("*");
    if (error) { showToast("Firmalar yüklenemedi: " + error.message, "error"); console.error("fetchFirms error:", error); return; }
    // Global firmsMap'i de güncelle (diğer sayfalarda firma adları güncel kalsın)
    firmsMap.clear();
    (firms || []).forEach(d => firmsMap.set(d.id, d.name));
    const container = document.getElementById("firms-list");
    if (!container) return;
    container.innerHTML = "";
    (firms || []).forEach(d => {
      const row = document.createElement("div");
      row.className = "flex items-center gap-2 py-2 border-b border-gray-800/50";
      row.innerHTML = `
        <input class="firm-name-input flex-1 bg-transparent border-0 text-gray-200 text-sm px-1 py-0.5 rounded focus:bg-gray-800 focus:border focus:border-gray-700 outline-none"
          value="${esc(d.name)}" data-id="${esc(d.id)}" data-original="${esc(d.name)}" maxlength="100">
        <button class="btn-save-firm hidden px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded" data-id="${esc(d.id)}">Kaydet</button>
        <button class="btn-delete-firm px-2 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded" data-id="${esc(d.id)}" data-name="${esc(d.name)}">Sil</button>
      `;
      container.appendChild(row);
    });

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
          const { error } = await supabase.from("firms").update({ name: newName }).eq("id", btn.dataset.id);
          if (error) throw error;
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
          const [{ count: screensCount }, { count: videosCount }] = await Promise.all([
            supabase.from("screens").select("*", { count: 'exact', head: true }).eq("firm_id", firmId),
            supabase.from("videos").select("*", { count: 'exact', head: true }).eq("firm_id", firmId)
          ]);
          const msg = (screensCount + videosCount) > 0
            ? `Bu firmaya bağlı ${screensCount || 0} ekran ve ${videosCount || 0} video var. Yine de silmek istiyor musunuz?`
            : `"${name}" firmasını silmek istediğinizden emin misiniz?`;
          if (!confirm(msg)) return;
          const { error } = await supabase.from("firms").delete().eq("id", firmId);
          if (error) throw error;
          firmsMap.delete(firmId);
          showToast("Firma silindi");
          await fetchFirms();
        } catch (e) {
          showToast("Silinemedi: " + e.message, "error");
        }
      });
    });
  };

  fetchFirms();
  const unsubFirms = supabase.channel("public:firms")
    .on("postgres_changes", { event: "*", schema: "public", table: "firms" }, fetchFirms)
    .subscribe();

  document.getElementById("btn-add-firm").addEventListener("click", async () => {
    const input = document.getElementById("new-firm-input");
    const name  = input.value.trim();
    if (!name) return;
    const btn = document.getElementById("btn-add-firm");
    btn.disabled = true;
    try {
      const { error } = await supabase.from("firms").insert({ name });
      if (error) throw error;
      input.value = "";
      showToast("Firma eklendi");
      await fetchFirms();
    } catch (e) {
      console.error("Firma insert error:", e);
      showToast("Eklenemedi: " + e.message, "error");
    } finally {
      btn.disabled = false;
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
    btn.disabled = true; btn.textContent = "Doğrulanıyor...";

    try {
      // Mevcut şifreyi doğrula
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: current
      });
      if (signInError) {
        errEl.textContent = "Mevcut şifre yanlış.";
        errEl.classList.remove("hidden");
        btn.disabled = false; btn.textContent = "Şifreyi Güncelle";
        return;
      }
      btn.textContent = "Güncelleniyor...";
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      document.getElementById("pw-current").value = "";
      document.getElementById("pw-new").value     = "";
      document.getElementById("pw-confirm").value = "";
      showToast("Şifre güncellendi");
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove("hidden");
    } finally {
      btn.disabled = false; btn.textContent = "Şifreyi Güncelle";
    }
  });

  unsubscribers.settings = () => { supabase.removeChannel(unsubFirms); };
}
