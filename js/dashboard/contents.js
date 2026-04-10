// js/dashboard/contents.js — İçerikler sayfası (video yükleme, listeleme)

import { supabase, SUPABASE_URL } from "../supabase-config.js";
import { esc, firmsMap, unsubscribers, showToast, openModal, closeModal, isImage, formatDate, modalState } from "./shared.js";

export function initContents() {
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
            <th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">Başlangıç</th>
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
      tdThumb.className = "px-4 py-3 cursor-pointer";
      tdThumb.title = "Önizleme için tıklayın";
      if (v.thumbnail_url) {
        const img = document.createElement("img");
        img.src = v.thumbnail_url; img.alt = v.title;
        img.className = "w-16 h-10 object-cover rounded hover:opacity-80 transition-opacity";
        tdThumb.appendChild(img);
      } else {
        tdThumb.innerHTML = `<div class="w-16 h-10 bg-gray-800 rounded flex items-center justify-center hover:bg-gray-700 transition-colors">
          <svg class="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
          </svg></div>`;
      }
      tdThumb.addEventListener("click", () => openPreviewModal(v));

      tr.innerHTML = `
        <td class="px-4 py-3 text-gray-200 font-medium">${esc(v.title)}</td>
        <td class="px-4 py-3 text-gray-400">${esc(firmsMap.get(v.firm_id) || "—")}</td>
        <td class="px-4 py-3 text-gray-400 text-xs">${formatDate(v.starts_at)}</td>
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

  document.getElementById("filter-firm")?.addEventListener("change", renderVideos);
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

    // Storage dosyalarını tek çağrıda sil
    const filePaths = checked.flatMap(chk => {
      const video = allVideos.find(v => v.id === chk.dataset.id);
      if (!video?.file_name) return [];
      return [
        "videos/" + video.file_name,
        "thumbnails/thumb_" + video.file_name.replace(/\.[^.]+$/, ".jpg")
      ];
    });
    if (filePaths.length) {
      try { await supabase.storage.from("digital-signage").remove(filePaths); } catch (_) {}
    }

    // DB kayıtlarını tek çağrıda sil
    const ids = checked.map(chk => chk.dataset.id);
    const { error } = await supabase.from("videos").delete().in("id", ids);
    if (error) showToast(`Silinemedi: ${error.message}`, "error");
    else showToast(`${checked.length} içerik silindi`);
    await loadVideos();
  });

  document.getElementById("btn-upload-video").addEventListener("click", () => openUploadModal(loadVideos));

  unsubscribers.contents = null;
  loadVideos();
}

function openUploadModal(onComplete) {
  openModal(box => {
    let firmUploadOpts = '<option value="">Firma seçin...</option>';
    firmsMap.forEach((name, id) => {
      firmUploadOpts += `<option value="${esc(id)}">${esc(name)}</option>`;
    });

    box.innerHTML = `
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
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-gray-400 mb-1">Başlangıç Tarihi <span class="text-gray-600">(opsiyonel)</span></label>
            <input type="date" id="upload-starts-at" class="w-full bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2">
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">Bitiş Tarihi <span class="text-gray-600">(opsiyonel)</span></label>
            <input type="date" id="upload-expiry" class="w-full bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2">
          </div>
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
          <button id="upload-cancel-btn" class="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg">İptal</button>
          <button id="upload-submit-btn" class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg disabled:opacity-50">Yükle</button>
        </div>
      </div>
    `;

    box.querySelector("#upload-cancel-btn").addEventListener("click", closeModal);

    let selectedFiles = [];
    const dropZone  = box.querySelector("#upload-drop-zone");
    const fileInput = box.querySelector("#upload-file-input");

    dropZone.addEventListener("click", () => fileInput.click());
    dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("border-blue-500"); });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("border-blue-500"));
    dropZone.addEventListener("drop", e => { e.preventDefault(); dropZone.classList.remove("border-blue-500"); handleFiles(e.dataTransfer.files); });
    fileInput.addEventListener("change", () => handleFiles(fileInput.files));

    const MB = 1024 * 1024;
    const GB = 1024 * MB;

    function handleFiles(files) {
      const candidates = Array.from(files).filter(f =>
        f.type === "video/mp4" || f.type === "image/jpeg" || f.type === "image/png"
      );
      if (!candidates.length) { showToast("Yalnızca MP4, JPG, PNG kabul edilir", "error"); return; }

      // Boyut kontrolü
      for (const f of candidates) {
        const isImg = f.type === "image/jpeg" || f.type === "image/png";
        if (isImg && f.size > 10 * MB) {
          showToast(`"${f.name}" çok büyük — görseller en fazla 10 MB olabilir.`, "error");
          return;
        }
        if (!isImg && f.size > GB) {
          showToast(`"${f.name}" çok büyük — videolar en fazla 1 GB olabilir.`, "error");
          return;
        }
        if (!isImg && f.size > 500 * MB) {
          showToast(`"${f.name}" 500 MB'tan büyük — yükleme uzun sürebilir.`, "info");
        }
      }

      const valid = candidates;
      selectedFiles = valid;
      const nameEl    = box.querySelector("#upload-file-name");
      const formEl    = box.querySelector("#upload-form-fields");
      const titleWrap = box.querySelector("#upload-title-wrap");
      const titleInput = box.querySelector("#upload-title");
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

    box.querySelector("#upload-submit-btn").addEventListener("click", async () => {
      if (!selectedFiles.length) { showToast("Dosya seçin", "error"); return; }
      const firmId   = box.querySelector("#upload-firm").value;
      const startsAt = box.querySelector("#upload-starts-at").value;
      const expiry   = box.querySelector("#upload-expiry").value;
      if (selectedFiles.length === 1 && !box.querySelector("#upload-title").value.trim()) {
        showToast("Başlık girin", "error"); return;
      }
      if (!firmId) { showToast("Firma seçin", "error"); return; }

      modalState.isUploading = true;
      box.querySelector("#upload-submit-btn").disabled = true;
      box.querySelector("#upload-cancel-btn").disabled = true;
      box.querySelector("#upload-progress-wrap").classList.remove("hidden");

      const total = selectedFiles.length;
      let successCount = 0;
      try {
        for (let i = 0; i < total; i++) {
          const file  = selectedFiles[i];
          const title = total === 1
            ? box.querySelector("#upload-title").value.trim()
            : file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
          box.querySelector("#upload-progress-label").textContent =
            total > 1 ? `Video ${i + 1} / ${total} yükleniyor...` : "Yükleniyor...";
          box.querySelector("#upload-progress-bar").style.width = "0%";
          box.querySelector("#upload-progress-pct").textContent = "0%";
          try {
            await uploadSingleVideo(file, title, firmId, startsAt, expiry, box);
            successCount++;
          } catch (e) {
            showToast(`"${file.name}" yüklenemedi: ${e.message}`, "error");
          }
        }
      } finally {
        modalState.isUploading = false;
      }
      closeModal();
      if (successCount > 0) showToast(`${successCount} video yüklendi`, "success");
      await onComplete();
    });
  });
}

function uploadSingleVideo(file, title, firmId, startsAt, expiry, box) {
  return new Promise(async (resolve, reject) => {
    const fileName = Date.now() + "_" + file.name.replace(/[^a-zA-Z0-9.\-_]/g, "");
    const bar     = box.querySelector("#upload-progress-bar");
    const pctEl   = box.querySelector("#upload-progress-pct");
    const labelEl = box.querySelector("#upload-progress-label");

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
      if (bar)     bar.style.width   = pct + "%";
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
          orientation: "horizontal",
          thumbnail_url: thumbnailUrl, is_active: true,
          starts_at:  startsAt ? new Date(startsAt).toISOString()  : null,
          expires_at: expiry   ? new Date(expiry).toISOString()    : null,
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
    xhr.timeout = 10 * 60 * 1000;

    xhr.send(file);
  });
}

function openPreviewModal(v) {
  openModal(box => {
    const isImg = isImage(v.file_name || "");
    const firmName = firmsMap.get(v.firm_id) || "—";

    let mediaHtml;
    if (isImg) {
      mediaHtml = `<img src="${esc(v.file_url || v.thumbnail_url || "")}" alt="${esc(v.title)}" class="w-full max-h-[60vh] object-contain rounded-lg bg-black">`;
    } else {
      mediaHtml = `<video src="${esc(v.file_url || "")}" controls autoplay class="w-full max-h-[60vh] rounded-lg bg-black" playsinline></video>`;
    }

    box.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold text-white truncate pr-2">${esc(v.title)}</h3>
        <button id="preview-close-btn" class="flex-shrink-0 text-gray-500 hover:text-white transition-colors">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="mb-4">${mediaHtml}</div>
      <div class="text-xs text-gray-400 space-y-1 border-t border-gray-800 pt-3">
        <div><span class="text-gray-500">Firma:</span> ${esc(firmName)}</div>
        <div><span class="text-gray-500">Yükleme Tarihi:</span> ${formatDate(v.created_at)}</div>
      </div>
    `;

    box.querySelector("#preview-close-btn").addEventListener("click", closeModal);
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
