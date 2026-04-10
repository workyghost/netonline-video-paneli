// js/dashboard/shared.js — Giriş noktası ve paylaşılan yardımcılar

import { supabase } from "../supabase-config.js";
import { initOverview }  from "./overview.js";
import { initScreens }   from "./screens.js";
import { initContents }  from "./contents.js";
import { initPlaylists } from "./playlists.js";
import { initReports }   from "./reports.js";
import { initSettings }  from "./settings.js";

// ========== PAYLAŞILAN STATE ==========
export let currentPage = "overview";
export const firmsMap    = new Map();   // firmId → firmName
export const unsubscribers = {};        // pageId → unsubscribe fn
export let currentUser   = null;
// isUploading nesne olarak export edilir — contents.js'den mutasyona uğrayabilir
export const modalState  = { isUploading: false };

// ========== AUTH ==========
// NOT: onAuthStateChange içinden asla supabase DB sorgusu çağırmayın —
// Supabase JS v2 auth callback'i session lock tutarken çağrılır,
// DB sorgusu da aynı lock'ı almaya çalışır → deadlock.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session) {
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
export function showPage(pageId) {
  if (unsubscribers[currentPage]) {
    unsubscribers[currentPage]();
    unsubscribers[currentPage] = null;
  }
  const pageEl = document.getElementById("page-" + pageId);
  if (!pageEl) { console.debug("Unknown page:", pageId); return; }
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  pageEl.classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelector(`[data-page="${pageId}"]`)?.classList.add("active");
  currentPage = pageId;
  const inits = {
    overview:  initOverview,
    screens:   initScreens,
    contents:  initContents,
    playlists: initPlaylists,
    reports:   initReports,
    settings:  initSettings
  };
  inits[pageId]?.();
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => showPage(btn.dataset.page));
});

// ========== TOAST ==========
export function showToast(message, type = "success") {
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

// ========== MODAL (renderFn pattern) ==========
// renderFn(box): modal-box DOM elementini parametre olarak alır, içini doldurur ve
// tüm event listener'ları kendi içinde addEventListener ile bağlar.
export function openModal(renderFn) {
  const box = document.getElementById("modal-box");
  box.innerHTML = "";
  document.getElementById("modal-overlay").classList.remove("hidden");
  renderFn(box);
}

export function closeModal() {
  if (modalState.isUploading) return;
  document.getElementById("modal-overlay").classList.add("hidden");
  document.getElementById("modal-box").innerHTML = "";
}

document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// ========== HELPERS ==========
export function esc(str) {
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(String(str ?? "")));
  return d.innerHTML;
}

export function timeAgo(timestamp) {
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

export const isImage = fn => /\.(jpg|jpeg|png)$/i.test(fn || "");

export function isScreenOnline(screen) {
  if (!screen.last_seen) return false;
  const TWO_MIN = 2 * 60 * 1000;
  return (Date.now() - new Date(screen.last_seen).getTime()) < TWO_MIN;
}

export function formatDate(ts) {
  if (!ts) return "Sınırsız";
  try {
    return new Date(ts).toLocaleDateString("tr-TR");
  } catch { return "Sınırsız"; }
}

export async function loadFirmsMap() {
  try {
    const { data: firms, error } = await supabase.from("firms").select("id, name");
    if (error) throw error;
    firmsMap.clear();
    firms.forEach(d => firmsMap.set(d.id, d.name));
  } catch (e) {
    showToast("Firmalar yüklenemedi", "error");
  }
}

export function firmsOptions(selected = "") {
  let html = '<option value="">Firma seçin...</option>';
  firmsMap.forEach((name, id) => {
    html += `<option value="${esc(id)}" ${id === selected ? "selected" : ""}>${esc(name)}</option>`;
  });
  return html;
}
