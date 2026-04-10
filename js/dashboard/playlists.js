// js/dashboard/playlists.js — Playlist'ler sayfası

import { supabase } from "../supabase-config.js";
import { esc, firmsMap, unsubscribers, showToast, openModal, closeModal, firmsOptions } from "./shared.js";

export function initPlaylists() {
  const el = document.getElementById("page-playlists");
  el.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-lg font-semibold text-white">Playlist'ler</h2>
      <button id="btn-new-playlist" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
        + Yeni Playlist
      </button>
    </div>
    <div id="playlists-empty" class="hidden text-center py-16 text-gray-600">
      <p class="text-sm mb-1">Henüz playlist yok.</p>
      <p class="text-xs text-gray-700">Önce İçerikler sekmesinden video yükleyin, sonra playlist oluşturun.</p>
    </div>
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
          const { count } = await supabase.from("screens").select("*", { count: "exact", head: true }).eq("playlist_id", btn.dataset.id);
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
    openModal(box => {
      box.innerHTML = `
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
            <button id="pl-cancel" class="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg">İptal</button>
            <button id="pl-save" class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg">Kaydet</button>
          </div>
        </div>
      `;

      box.querySelector("#pl-cancel").addEventListener("click", closeModal);

      // orderedItems: [{ videoId, durationOverride: number|null }]
      // durationOverride: saniye cinsinden görüntüleme süresi (görsel için); null = varsayılan (30s)
      let orderedItems = (existing?.items || [])
        .sort((a, b) => a.order - b.order)
        .map(i => ({ videoId: i.videoId, durationOverride: i.durationOverride || null }));

      let videosForFirm = [];
      let dragSrcIdx = null;

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
          const isChecked = orderedItems.some(i => i.videoId === v.id);
          const label = document.createElement("label");
          label.className = "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-700 cursor-pointer";
          label.innerHTML = `
            <input type="checkbox" value="${esc(v.id)}" ${isChecked ? "checked" : ""} class="accent-blue-500">
            <span class="text-sm text-gray-300">${esc(v.title)}</span>
          `;
          label.querySelector("input").addEventListener("change", e => {
            if (e.target.checked) {
              if (!orderedItems.some(i => i.videoId === v.id)) {
                orderedItems.push({ videoId: v.id, durationOverride: null });
              }
            } else {
              orderedItems = orderedItems.filter(i => i.videoId !== v.id);
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
        orderedItems.forEach((item, idx) => {
          const v = videosForFirm.find(x => x.id === item.videoId);
          const title = v?.title || item.videoId;
          const row = document.createElement("div");
          row.className = "flex items-center gap-2 bg-gray-800 border border-gray-700 rounded px-3 py-2 cursor-grab";
          row.draggable = true;
          row.innerHTML = `
            <span class="text-gray-600 select-none mr-0.5" title="Sürükle">⠿</span>
            <span class="text-xs text-gray-500 w-4">${idx + 1}</span>
            <span class="flex-1 text-sm text-gray-200 truncate">${esc(title)}</span>
            <input type="number" min="1" max="3600" placeholder="30"
              title="Görüntüleme süresi (saniye)"
              value="${item.durationOverride || ""}"
              class="w-14 bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded px-1.5 py-1 text-center">
            <span class="text-xs text-gray-600">sn</span>
            <div class="flex gap-1">
              <button class="btn-up w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs flex items-center justify-center ${idx === 0 ? "opacity-30 cursor-not-allowed" : ""}" data-idx="${idx}">↑</button>
              <button class="btn-dn w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs flex items-center justify-center ${idx === orderedItems.length - 1 ? "opacity-30 cursor-not-allowed" : ""}" data-idx="${idx}">↓</button>
              <button class="btn-rm w-6 h-6 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs flex items-center justify-center" data-idx="${idx}">✕</button>
            </div>
          `;

          // Drag & Drop
          row.addEventListener("dragstart", () => {
            dragSrcIdx = idx;
            setTimeout(() => row.classList.add("opacity-40"), 0);
          });
          row.addEventListener("dragend", () => {
            row.classList.remove("opacity-40");
            container.querySelectorAll("div").forEach(el => { el.style.borderColor = ""; });
          });
          row.addEventListener("dragover", e => {
            e.preventDefault();
            row.style.borderColor = "#3b82f6";
          });
          row.addEventListener("dragleave", () => { row.style.borderColor = ""; });
          row.addEventListener("drop", e => {
            e.preventDefault();
            row.style.borderColor = "";
            if (dragSrcIdx === null || dragSrcIdx === idx) return;
            const [moved] = orderedItems.splice(dragSrcIdx, 1);
            orderedItems.splice(idx, 0, moved);
            dragSrcIdx = null;
            renderVideoCheckboxes();
            renderOrderList();
          });
          // Süre input değişince orderedItems'ı güncelle (sıralama bozulmasın diye)
          row.querySelector("input[type=number]").addEventListener("change", e => {
            const val = parseInt(e.target.value, 10);
            orderedItems[idx].durationOverride = (val > 0) ? val : null;
          });
          row.querySelector(".btn-up").addEventListener("click", () => {
            if (idx === 0) return;
            [orderedItems[idx - 1], orderedItems[idx]] = [orderedItems[idx], orderedItems[idx - 1]];
            renderOrderList();
          });
          row.querySelector(".btn-dn").addEventListener("click", () => {
            if (idx === orderedItems.length - 1) return;
            [orderedItems[idx], orderedItems[idx + 1]] = [orderedItems[idx + 1], orderedItems[idx]];
            renderOrderList();
          });
          row.querySelector(".btn-rm").addEventListener("click", () => {
            orderedItems.splice(idx, 1);
            renderVideoCheckboxes();
            renderOrderList();
          });
          container.appendChild(row);
        });
      }

      box.querySelector("#pl-firm").addEventListener("change", async (e) => {
        const firmId = e.target.value;
        const wrap = document.getElementById("pl-videos-wrap");
        if (!firmId) { wrap?.classList.add("hidden"); return; }
        wrap?.classList.remove("hidden");
        orderedItems = [];
        await loadVideosForFirm(firmId);
      });

      if (existing?.firm_id) {
        loadVideosForFirm(existing.firm_id);
      }

      box.querySelector("#pl-save").addEventListener("click", async () => {
        const name   = box.querySelector("#pl-name").value.trim();
        const firmId = box.querySelector("#pl-firm").value;
        const errEl  = box.querySelector("#pl-error");
        if (!name)   { errEl.textContent = "Playlist adı girin."; errEl.classList.remove("hidden"); return; }
        if (!firmId) { errEl.textContent = "Firma seçin.";        errEl.classList.remove("hidden"); return; }
        errEl.classList.add("hidden");
        const items = orderedItems.map((item, i) => ({
          videoId: item.videoId,
          order: i,
          durationOverride: item.durationOverride || null
        }));
        const btn = box.querySelector("#pl-save");
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
    });
  }

  unsubscribers.playlists = null;
  loadPlaylists();
}
