// js/dashboard/reports.js — Raporlar sayfası

import { supabase } from "../supabase-config.js";
import { esc, firmsMap, unsubscribers } from "./shared.js";

export function initReports() {
  const el = document.getElementById("page-reports");

  const defaultEnd   = new Date();
  const defaultStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const toDateVal = d => d.toISOString().slice(0, 10);

  let firmFilterOpts = '<option value="">Tüm Firmalar</option>';
  firmsMap.forEach((name, id) => {
    firmFilterOpts += `<option value="${esc(id)}">${esc(name)}</option>`;
  });

  el.innerHTML = `
    <h2 class="text-lg font-semibold text-white mb-6">Raporlar</h2>
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label class="block text-xs text-gray-400 mb-1">Başlangıç</label>
          <input type="date" id="rpt-start" value="${toDateVal(defaultStart)}"
            class="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5">
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">Bitiş</label>
          <input type="date" id="rpt-end" value="${toDateVal(defaultEnd)}"
            class="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5">
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">Firma</label>
          <select id="rpt-firm" class="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5">
            ${firmFilterOpts}
          </select>
        </div>
        <button id="rpt-btn" class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
          Rapor Oluştur
        </button>
      </div>
    </div>
    <div id="rpt-loading" class="hidden text-center py-12 text-gray-600 text-sm">Yükleniyor...</div>
    <div id="rpt-empty"   class="hidden text-center py-12 text-gray-600 text-sm">
      Seçilen tarih aralığında oynatma kaydı bulunamadı.
    </div>
    <div id="rpt-results" class="hidden space-y-6"></div>
  `;

  document.getElementById("rpt-btn").addEventListener("click", generateReport);

  async function generateReport() {
    const startVal = document.getElementById("rpt-start").value;
    const endVal   = document.getElementById("rpt-end").value;
    const firmId   = document.getElementById("rpt-firm").value;
    if (!startVal || !endVal) return;

    const startDate = new Date(startVal).toISOString();
    const endDate   = new Date(endVal + "T23:59:59").toISOString();

    const resultsEl = document.getElementById("rpt-results");
    const emptyEl   = document.getElementById("rpt-empty");
    const loadingEl = document.getElementById("rpt-loading");

    resultsEl.classList.add("hidden");
    emptyEl.classList.add("hidden");
    loadingEl.classList.remove("hidden");

    try {
      let query = supabase.from("play_logs")
        .select("*")
        .gte("started_at", startDate)
        .lte("started_at", endDate);
      if (firmId) query = query.eq("firm_id", firmId);
      const { data: logs, error } = await query;
      if (error) throw error;

      loadingEl.classList.add("hidden");

      if (!logs || logs.length === 0) {
        emptyEl.classList.remove("hidden");
        return;
      }

      renderReport(logs, startVal, endVal);
      resultsEl.classList.remove("hidden");
    } catch (e) {
      loadingEl.classList.add("hidden");
      emptyEl.textContent = "Rapor yüklenemedi: " + e.message;
      emptyEl.classList.remove("hidden");
    }
  }

  function formatDur(sec) {
    if (!sec || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function renderReport(logs, startVal, endVal) {
    const resultsEl = document.getElementById("rpt-results");

    // Özet
    const totalCount    = logs.length;
    const totalSec      = logs.reduce((s, l) => s + (l.duration_seconds || 0), 0);
    const totalHours    = Math.floor(totalSec / 3600);
    const totalMins     = Math.floor((totalSec % 3600) / 60);
    const uniqueScreens = new Set(logs.map(l => l.screen_id).filter(Boolean)).size;
    const dayCount      = Math.max(1, Math.ceil((new Date(endVal) - new Date(startVal)) / (24 * 60 * 60 * 1000)) + 1);
    const avgDaily      = (totalCount / dayCount).toFixed(1);

    // Video bazlı gruplama
    const byVideo = new Map();
    logs.forEach(l => {
      const key   = l.video_title || "Bilinmiyor";
      const entry = byVideo.get(key) || { count: 0, totalSec: 0 };
      entry.count++;
      entry.totalSec += l.duration_seconds || 0;
      byVideo.set(key, entry);
    });
    const videoRows = [...byVideo.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([title, d]) => {
        const avg = d.count > 0 ? Math.round(d.totalSec / d.count) : 0;
        return `<tr class="border-b border-gray-800/50">
          <td class="px-4 py-2 text-gray-300">${esc(title)}</td>
          <td class="px-4 py-2 text-gray-400 text-center">${d.count}</td>
          <td class="px-4 py-2 text-gray-400 text-center">${formatDur(d.totalSec)}</td>
          <td class="px-4 py-2 text-gray-400 text-center">${formatDur(avg)}</td>
        </tr>`;
      }).join("");

    // Ekran bazlı gruplama
    const byScreen = new Map();
    logs.forEach(l => {
      if (!l.screen_id) return;
      const entry = byScreen.get(l.screen_id) || { count: 0, totalSec: 0, firmId: l.firm_id };
      entry.count++;
      entry.totalSec += l.duration_seconds || 0;
      byScreen.set(l.screen_id, entry);
    });
    const screenRows = [...byScreen.values()]
      .sort((a, b) => b.count - a.count)
      .map(d => {
        const firmName = firmsMap.get(d.firmId) || "—";
        return `<tr class="border-b border-gray-800/50">
          <td class="px-4 py-2 text-gray-300 text-xs font-mono">${esc(d.count > 0 ? String(d.firmId || "").slice(0, 8) + "…" : "—")}</td>
          <td class="px-4 py-2 text-gray-400">${esc(firmName)}</td>
          <td class="px-4 py-2 text-gray-400 text-center">${d.count}</td>
          <td class="px-4 py-2 text-gray-400 text-center">${formatDur(d.totalSec)}</td>
        </tr>`;
      }).join("");

    resultsEl.innerHTML = `
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="text-xs text-gray-500 mb-1">Toplam Oynatma</p>
          <p class="text-2xl font-bold text-white">${totalCount}</p>
        </div>
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="text-xs text-gray-500 mb-1">Toplam Yayın Süresi</p>
          <p class="text-2xl font-bold text-white">${totalHours}s ${totalMins}dk</p>
        </div>
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="text-xs text-gray-500 mb-1">Aktif Ekran Sayısı</p>
          <p class="text-2xl font-bold text-white">${uniqueScreens}</p>
        </div>
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="text-xs text-gray-500 mb-1">Ort. Günlük Oynatma</p>
          <p class="text-2xl font-bold text-white">${avgDaily}</p>
        </div>
      </div>

      <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-800">
          <h3 class="text-sm font-medium text-gray-300">Video Bazlı Oynatma</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-gray-800">
              <th class="text-left px-4 py-2 text-xs text-gray-500 font-medium">Video Adı</th>
              <th class="text-center px-4 py-2 text-xs text-gray-500 font-medium">Oynatma</th>
              <th class="text-center px-4 py-2 text-xs text-gray-500 font-medium">Toplam Süre</th>
              <th class="text-center px-4 py-2 text-xs text-gray-500 font-medium">Ort. Süre</th>
            </tr></thead>
            <tbody>${videoRows || '<tr><td colspan="4" class="px-4 py-4 text-center text-gray-600">—</td></tr>'}</tbody>
          </table>
        </div>
      </div>

      <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-800">
          <h3 class="text-sm font-medium text-gray-300">Ekran Bazlı Oynatma</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-gray-800">
              <th class="text-left px-4 py-2 text-xs text-gray-500 font-medium">Ekran ID</th>
              <th class="text-left px-4 py-2 text-xs text-gray-500 font-medium">Firma</th>
              <th class="text-center px-4 py-2 text-xs text-gray-500 font-medium">Oynatma</th>
              <th class="text-center px-4 py-2 text-xs text-gray-500 font-medium">Toplam Süre</th>
            </tr></thead>
            <tbody>${screenRows || '<tr><td colspan="4" class="px-4 py-4 text-center text-gray-600">—</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  unsubscribers.reports = null;
}
