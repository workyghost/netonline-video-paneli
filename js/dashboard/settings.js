// js/dashboard/settings.js — Ayarlar sayfası (firma yönetimi, şifre değiştirme)

import { supabase } from "../supabase-config.js";
import { esc, firmsMap, unsubscribers, showToast, currentUser } from "./shared.js";

export function initSettings() {
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
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
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
    if (error) { showToast("Firmalar yüklenemedi: " + error.message, "error"); console.debug("fetchFirms error:", error); return; }
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
            supabase.from("screens").select("*", { count: "exact", head: true }).eq("firm_id", firmId),
            supabase.from("videos").select("*", { count: "exact", head: true }).eq("firm_id", firmId)
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
      console.debug("Firma insert error:", e);
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

  // ---- Demo & Geliştirme bölümü (HTML ekle) ----
  const demoSection = document.createElement("div");
  demoSection.className = "bg-gray-900 border border-yellow-500/20 rounded-xl p-5";
  demoSection.innerHTML = `
    <h3 class="text-sm font-semibold text-yellow-400/80 mb-1">Demo & Geliştirme</h3>
    <p class="text-xs text-gray-600 mb-4">Bu bölüm yalnızca demo ve test amacıyla kullanılır.</p>
    <div class="flex flex-wrap gap-3">
      <button id="btn-demo-create" class="px-4 py-2 text-sm bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 rounded-lg transition-colors">
        Demo Verisi Oluştur
      </button>
      <button id="btn-demo-delete" class="px-4 py-2 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors">
        Tüm Demo Verilerini Sil
      </button>
    </div>
  `;
  el.appendChild(demoSection);

  document.getElementById("btn-demo-create").addEventListener("click", async () => {
    const btn = document.getElementById("btn-demo-create");
    btn.disabled = true; btn.textContent = "Oluşturuluyor...";
    try {
      // 2 firma
      const { data: firms, error: fErr } = await supabase.from("firms").insert([
        { name: "Lezzet Cafe" },
        { name: "Stil Kuaför" }
      ]).select();
      if (fErr) throw fErr;

      for (const firm of firms) {
        // Her firmaya 1 ekran
        await supabase.from("screens").insert([{
          firm_id: firm.id, name: `${firm.name} — Ana Ekran`,
          location: "Giriş", status: "offline",
          last_seen: new Date().toISOString(),
          current_video_id: null, current_video_title: null,
          playlist_id: null, registered_at: new Date().toISOString()
        }]);
        // Her firmaya 2 playlist
        await supabase.from("playlists").insert([
          { firm_id: firm.id, name: `${firm.name} — Sabah Listesi`, items: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { firm_id: firm.id, name: `${firm.name} — Akşam Listesi`, items: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ]);
      }
      showToast("Demo verileri oluşturuldu");
      await fetchFirms();
    } catch (e) {
      showToast("Demo verisi oluşturulamadı: " + e.message, "error");
    } finally {
      btn.disabled = false; btn.textContent = "Demo Verisi Oluştur";
    }
  });

  document.getElementById("btn-demo-delete").addEventListener("click", async () => {
    if (!confirm("TÜM play_logs, playlists, screens, videos ve firmalar silinecek!\nBu işlem geri alınamaz. Devam etmek istiyor musunuz?")) return;
    const btn = document.getElementById("btn-demo-delete");
    btn.disabled = true; btn.textContent = "Siliniyor...";
    try {
      // FK sırasına göre sil
      await supabase.from("play_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("playlists").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("screens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("videos").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("firms").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      showToast("Tüm demo verileri silindi");
      await fetchFirms();
    } catch (e) {
      showToast("Silme hatası: " + e.message, "error");
    } finally {
      btn.disabled = false; btn.textContent = "Tüm Demo Verilerini Sil";
    }
  });

  unsubscribers.settings = () => { supabase.removeChannel(unsubFirms); };
}
