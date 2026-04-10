// js/dashboard/overview.js — Genel Bakış sayfası

import { supabase } from "../supabase-config.js";
import { esc, timeAgo, firmsMap, unsubscribers, isScreenOnline } from "./shared.js";

export function initOverview() {
  const el = document.getElementById("page-overview");
  el.innerHTML = `
    <h2 class="text-lg font-semibold text-white mb-6">Genel Bakış</h2>
    <div id="play-stats-bar" class="mb-4 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 text-sm text-blue-300 hidden">
      Son 24 saatte <span id="stat-play-count" class="font-bold text-white">—</span> video oynatıldı,
      toplam <span id="stat-play-minutes" class="font-bold text-white">—</span> dakika yayın yapıldı.
    </div>
    <div id="play-firm-stats" class="hidden mb-4"></div>
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

  let lastSeenInterval = null;

  const fetchScreens = async () => {
    const { data: screens, error } = await supabase.from("screens").select("*");
    if (error) return;

    let online = 0;
    const tbody = document.getElementById("overview-screen-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    (screens || []).forEach(s => {
      const online_ = isScreenOnline(s);
      if (online_) online++;

      const tr = document.createElement("tr");
      tr.className = "border-b border-gray-800/50 hover:bg-gray-800/20";
      tr.innerHTML = `
        <td class="px-4 py-3 text-gray-200 font-medium">${esc(s.name)}</td>
        <td class="px-4 py-3 text-gray-400">${esc(firmsMap.get(s.firm_id) || "—")}</td>
        <td class="px-4 py-3">
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
            ${online_ ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}">
            <span class="w-1.5 h-1.5 rounded-full ${online_ ? "bg-green-400" : "bg-red-400"}"></span>
            ${online_ ? "Çevrimiçi" : "Çevrimdışı"}
          </span>
        </td>
        <td class="px-4 py-3 text-gray-400 text-xs">${esc(s.current_video_title || "—")}</td>
        <td class="px-4 py-3 text-gray-500 text-xs" data-timestamp="${s.last_seen || ""}">${timeAgo(s.last_seen)}</td>
      `;
      tbody.appendChild(tr);
    });

    // Canlı sayaç: her 30s'de Son Görülme hücrelerini güncelle
    if (lastSeenInterval) clearInterval(lastSeenInterval);
    lastSeenInterval = setInterval(() => {
      document.querySelectorAll("#overview-screen-tbody [data-timestamp]").forEach(td => {
        td.textContent = timeAgo(td.dataset.timestamp);
      });
    }, 30000);

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
          <span>Henüz hiç firma eklenmedi. <button id="go-to-settings" class="underline hover:text-yellow-300 transition-colors">Ayarlar</button> sayfasından firma ekleyebilirsiniz.</span>
        `;
        el.insertBefore(banner, el.firstChild);
        const settingsBtn = document.getElementById("go-to-settings");
        if (settingsBtn) {
          settingsBtn.addEventListener("click", () => {
            document.querySelector('[data-page="settings"]').click();
          });
        }
      }
    } else {
      existing?.remove();
    }
  };

  const fetchPlayStats = async () => {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: logs, error } = await supabase
        .from("play_logs")
        .select("firm_id, duration_seconds")
        .gte("started_at", since);
      if (error) return;

      const count    = (logs || []).length;
      const totalSec = (logs || []).reduce((s, r) => s + (r.duration_seconds || 0), 0);
      const minutes  = Math.round(totalSec / 60);
      const bar      = document.getElementById("play-stats-bar");
      const cEl      = document.getElementById("stat-play-count");
      const mEl      = document.getElementById("stat-play-minutes");
      if (bar)  bar.classList.toggle("hidden", count === 0);
      if (cEl)  cEl.textContent = count;
      if (mEl)  mEl.textContent = minutes;

      // Firma bazlı özet
      const firmStats = document.getElementById("play-firm-stats");
      if (firmStats && firmsMap.size > 0) {
        const byFirm = new Map();
        (logs || []).forEach(log => {
          if (!log.firm_id) return;
          const entry = byFirm.get(log.firm_id) || { count: 0, totalSec: 0 };
          entry.count++;
          entry.totalSec += log.duration_seconds || 0;
          byFirm.set(log.firm_id, entry);
        });

        const rows = [];
        firmsMap.forEach((name, id) => {
          const entry = byFirm.get(id);
          if (!entry) return;
          const totalMin = Math.round(entry.totalSec / 60);
          const durStr = totalMin >= 60
            ? `${Math.floor(totalMin / 60)}s ${totalMin % 60}dk`
            : `${totalMin}dk`;
          rows.push(`<tr class="border-b border-gray-800/50">
            <td class="px-4 py-2 text-gray-300">${esc(name)}</td>
            <td class="px-4 py-2 text-gray-400">${entry.count}</td>
            <td class="px-4 py-2 text-gray-400">${durStr}</td>
          </tr>`);
        });

        if (rows.length > 0) {
          firmStats.classList.remove("hidden");
          firmStats.innerHTML = `
            <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div class="px-4 py-3 border-b border-gray-800">
                <h3 class="text-sm font-medium text-gray-300">Firma Bazlı — Son 24 Saat</h3>
              </div>
              <table class="w-full text-sm">
                <thead><tr class="border-b border-gray-800">
                  <th class="text-left px-4 py-2 text-xs text-gray-500 font-medium">Firma</th>
                  <th class="text-left px-4 py-2 text-xs text-gray-500 font-medium">Oynatma</th>
                  <th class="text-left px-4 py-2 text-xs text-gray-500 font-medium">Toplam Süre</th>
                </tr></thead>
                <tbody>${rows.join("")}</tbody>
              </table>
            </div>
          `;
        } else {
          firmStats.classList.add("hidden");
        }
      }
    } catch (_) {}
  };

  fetchVideosCount();
  fetchScreens();
  renderNoFirmsBanner();
  fetchPlayStats();

  const unsubVideos = supabase.channel("public:videos_overview")
    .on("postgres_changes", { event: "*", schema: "public", table: "videos" }, fetchVideosCount)
    .subscribe();

  const unsubScreens = supabase.channel("public:screens_overview")
    .on("postgres_changes", { event: "*", schema: "public", table: "screens" }, fetchScreens)
    .subscribe();

  unsubscribers.overview = () => {
    supabase.removeChannel(unsubVideos);
    supabase.removeChannel(unsubScreens);
    if (lastSeenInterval) { clearInterval(lastSeenInterval); lastSeenInterval = null; }
  };
}
