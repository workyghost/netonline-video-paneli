# Firma Silme & İçerik Yönetimi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Firma silindiğinde videolar sahipsiz kalır ve dashboardda görünür; toplu silme özelliği eklenir; storage her silmede temizlenir.

**Architecture:** SQL şema değişikliği (firm_id nullable + ON DELETE SET NULL) + dashboard.js'e toplu silme UI ve mantığı eklenir. "—" firma gösterimi ve tekli silme storage temizliği zaten mevcut kodda var.

**Tech Stack:** Vanilla JS, Supabase (PostgreSQL + Storage), TailwindCSS CDN

---

## Hazır Olan (Kod Değişikliği Gerekmez)

- `firmsMap.get(v.firm_id) || "—"` → NULL firm_id'li videolar zaten "—" gösteriyor (`dashboard.js:632`)
- Tekli silme zaten storage'ı temizliyor (`dashboard.js:679-680`)

---

## Dosya Haritası

| Dosya | Değişiklik |
|-------|-----------|
| `sql/schema.sql` | firm_id nullable + ON DELETE SET NULL |
| `js/dashboard.js` | Filtre "Sahipsiz" seçeneği + toplu silme UI + mantık |

---

### Task 1: schema.sql Güncelle

**Files:**
- Modify: `sql/schema.sql:23`

- [ ] **Adım 1: schema.sql'de videos tablosunu güncelle**

`sql/schema.sql` satır 23'teki şu satırı:
```sql
firm_id uuid references firms(id) on delete cascade not null,
```
Şununla değiştir:
```sql
firm_id uuid references firms(id) on delete set null,
```

NOT: `sql/` dizini `.gitignore`'da olduğu için bu değişiklik GitHub'a gitmez. Şema değişikliği Supabase Studio'dan çalıştırılacak (Task 5).

- [ ] **Adım 2: Bucket limiti notunu schema.sql'e ekle**

`sql/schema.sql` sonuna ekle:
```sql
-- Bucket dosya limiti 500MB (Supabase Studio'dan çalıştır)
-- UPDATE storage.buckets SET file_size_limit = 524288000 WHERE id = 'digital-signage';
```

---

### Task 2: Filtre Dropdown'ına "Sahipsiz" Seçeneği Ekle

**Files:**
- Modify: `js/dashboard.js:536-539`

- [ ] **Adım 1: firmFilterOpts'a "Sahipsiz" seçeneği ekle**

`js/dashboard.js` satır 536-539:
```javascript
  let firmFilterOpts = '<option value="">Tüm Firmalar</option>';
  firmsMap.forEach((name, id) => {
    firmFilterOpts += `<option value="${esc(id)}">${esc(name)}</option>`;
  });
```
Şununla değiştir:
```javascript
  let firmFilterOpts = '<option value="">Tüm Firmalar</option>';
  firmFilterOpts += '<option value="__orphan__">— Sahipsiz</option>';
  firmsMap.forEach((name, id) => {
    firmFilterOpts += `<option value="${esc(id)}">${esc(name)}</option>`;
  });
```

- [ ] **Adım 2: renderVideos filtre mantığını güncelle**

`js/dashboard.js` satır 592-596:
```javascript
    const filtered = allVideos.filter(v => {
      if (firmFilter && v.firm_id !== firmFilter) return false;
      if (search     && !v.title?.toLowerCase().includes(search)) return false;
      return true;
    });
```
Şununla değiştir:
```javascript
    const filtered = allVideos.filter(v => {
      if (firmFilter === "__orphan__" && v.firm_id != null) return false;
      if (firmFilter && firmFilter !== "__orphan__" && v.firm_id !== firmFilter) return false;
      if (search && !v.title?.toLowerCase().includes(search)) return false;
      return true;
    });
```

- [ ] **Adım 3: Mock server'da test et**

1. `cd mock-server && node server.js`
2. `http://localhost:3001` → login → İçerikler sekmesi
3. Filtre dropdown'ında "— Sahipsiz" seçeneği görünüyor mu? ✓
4. Şimdilik sahipsiz video yok olduğu için liste boş görünür — doğru davranış ✓

---

### Task 3: Tablo Başlığına Checkbox + "Seçilenleri Sil" Butonu Ekle

**Files:**
- Modify: `js/dashboard.js:541-573` (initContents HTML şablonu)

- [ ] **Adım 1: Tablo başlığına checkbox kolonu ve "Seçilenleri Sil" butonu ekle**

`js/dashboard.js` satır 541-573 arasındaki `el.innerHTML` bloğunu bul.

`<div class="flex flex-wrap items-center justify-between gap-3 mb-6">` satırını içeren div'i şununla değiştir:
```javascript
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
```

---

### Task 4: Satır Checkbox'ları ve Toplu Silme Mantığı

**Files:**
- Modify: `js/dashboard.js` — `renderVideos()` ve event listener bölümleri

- [ ] **Adım 1: renderVideos'ta her satıra checkbox ekle**

`js/dashboard.js` satır 612'de `filtered.forEach(v => {` bloğunun içinde, `tr.innerHTML = \`` satırından önce şu satırı ekle:

```javascript
      const tdCheck = document.createElement("td");
      tdCheck.className = "px-4 py-3";
      tdCheck.innerHTML = `<input type="checkbox" class="chk-video rounded border-gray-600 bg-gray-800 text-blue-600" data-id="${esc(v.id)}">`;
```

`tr.insertBefore(tdThumb, tr.firstChild);` satırının hemen öncesine ekle:
```javascript
      tr.insertBefore(tdCheck, tr.firstChild);
```

- [ ] **Adım 2: updateBulkUI yardımcı fonksiyonunu renderVideos içine ekle**

`renderVideos()` fonksiyonunun başına (tbody.innerHTML = "" satırından önce) ekle:
```javascript
    function updateBulkUI() {
      const checked = document.querySelectorAll(".chk-video:checked");
      const btn     = document.getElementById("btn-bulk-delete");
      const counter = document.getElementById("bulk-delete-count");
      if (btn)     btn.classList.toggle("hidden", checked.length === 0);
      if (counter) counter.textContent = checked.length;
    }
```

- [ ] **Adım 3: Checkbox event listener'larını renderVideos sonuna ekle**

`tbody.querySelectorAll(".btn-delete-video").forEach(...)` bloğunun hemen ardına ekle:

```javascript
    // Satır checkbox'ları
    tbody.querySelectorAll(".chk-video").forEach(chk => {
      chk.addEventListener("change", () => {
        const all = document.getElementById("chk-select-all");
        const boxes = document.querySelectorAll(".chk-video");
        if (all) all.checked = [...boxes].every(b => b.checked);
        updateBulkUI();
      });
    });

    // Tümünü Seç
    const selectAll = document.getElementById("chk-select-all");
    if (selectAll) {
      selectAll.addEventListener("change", () => {
        document.querySelectorAll(".chk-video").forEach(chk => {
          chk.checked = selectAll.checked;
        });
        updateBulkUI();
      });
    }
```

- [ ] **Adım 4: "Seçilenleri Sil" buton mantığı**

`document.getElementById("btn-upload-video").addEventListener(...)` satırından önce ekle:

```javascript
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
        const { error } = await supabase.from("videos").delete().eq("id", videoId);
        if (error) throw error;
        successCount++;
      } catch (_) {
        errorCount++;
      }
    }

    if (errorCount > 0) showToast(`${successCount} silindi, ${errorCount} silinemedi`, "error");
    else showToast(`${successCount} içerik silindi`);
    await loadVideos();
  });
```

- [ ] **Adım 5: Mock server'da toplu silme testi**

1. Dashboard → İçerikler → birkaç video yükle
2. Checkbox'ları işaretle
3. "Seçilenleri Sil (N)" butonu görünüyor mu? ✓
4. "Tümünü Seç" çalışıyor mu? ✓
5. Onayla → videolar silindi mi? ✓
6. Storage mock'ta da temizlendi mi (server log'a bak)? ✓

---

### Task 5: Commit ve Push

**Files:** `js/dashboard.js`

- [ ] **Adım 1: Commit et**

```bash
git add js/dashboard.js
git commit -m "feat: toplu silme, sahipsiz video filtresi (v2.4.0)"
```

- [ ] **Adım 2: Push et**

```bash
git push origin main
```

---

### Task 6: VPS Deploy (Kullanıcı Yapar)

- [ ] **Adım 1: VPS'te git pull**

```bash
git pull
```

- [ ] **Adım 2: Supabase Studio SQL Editor'da şema değişikliğini çalıştır**

`https://digital-signage-supabase.hnx0gp.easypanel.host` → SQL Editor:

```sql
-- 1. firm_id nullable + ON DELETE SET NULL
ALTER TABLE videos
  ALTER COLUMN firm_id DROP NOT NULL,
  DROP CONSTRAINT videos_firm_id_fkey,
  ADD CONSTRAINT videos_firm_id_fkey
    FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE SET NULL;

-- 2. Bucket dosya limiti 500MB
UPDATE storage.buckets
  SET file_size_limit = 524288000
  WHERE id = 'digital-signage';
```

- [ ] **Adım 3: Doğrula**

1. Dashboard'a gir
2. Bir firma sil → firmanın videoları hâlâ İçerikler'de "—" ile görünüyor mu? ✓
3. 66MB videoyu yükle → başarılı mı? ✓
4. Toplu silme çalışıyor mu? ✓
