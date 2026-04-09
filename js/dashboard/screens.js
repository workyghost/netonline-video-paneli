// js/dashboard/screens.js — Ekranlar sayfası ve modal'ları

import { supabase } from "../supabase-config.js";
import { esc, firmsMap, unsubscribers, showToast, openModal, closeModal, firmsOptions } from "./shared.js";

export function initScreens() {
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

export function openAddScreenModal(onSuccess) {
  openModal(box => {
    box.innerHTML = `
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
          <button id="ms-cancel" class="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors">İptal</button>
          <button id="ms-save" class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">Kaydet</button>
        </div>
      </div>
    `;

    box.querySelector("#ms-cancel").addEventListener("click", closeModal);

    box.querySelector("#ms-save").addEventListener("click", async () => {
      const firmId   = box.querySelector("#ms-firm").value;
      const name     = box.querySelector("#ms-name").value.trim();
      const location = box.querySelector("#ms-location").value.trim();
      const errEl    = box.querySelector("#ms-error");

      if (!firmId || !name || !location) {
        errEl.textContent = "Tüm alanları doldurun.";
        errEl.classList.remove("hidden");
        return;
      }
      errEl.classList.add("hidden");
      const btn = box.querySelector("#ms-save");
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
  });
}

export function openEditScreenModal({ id, name, location }, onSuccess) {
  openModal(box => {
    box.innerHTML = `
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
          <button id="es-cancel" class="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg">İptal</button>
          <button id="es-save" class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg">Kaydet</button>
        </div>
      </div>
    `;

    box.querySelector("#es-cancel").addEventListener("click", closeModal);

    box.querySelector("#es-save").addEventListener("click", async () => {
      const newName     = box.querySelector("#es-name").value.trim();
      const newLocation = box.querySelector("#es-location").value.trim();
      if (!newName || !newLocation) return;
      const { error } = await supabase.from("screens").update({ name: newName, location: newLocation }).eq("id", id);
      if (error) showToast(error.message, "error");
      else {
        closeModal();
        onSuccess();
        showToast("Ekran güncellendi");
      }
    });
  });
}
