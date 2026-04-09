# Firma Silme & İçerik Yönetimi — Tasarım Dokümanı

**Tarih:** 2026-04-09  
**Sürüm:** v2.4.0 (hedef)

---

## Sorun

1. Firma silindiğinde `ON DELETE CASCADE` ile video DB kayıtları siliniyor, ancak Supabase Storage'daki fiziksel dosyalar kalıyor → orphaned files.
2. Herhangi bir video/görsel silindiğinde yalnızca DB kaydı siliniyor, storage dosyası temizlenmiyor.
3. Toplu silme özelliği yok.
4. Supabase Storage bucket dosya limiti 50MB — büyük videolar yüklenemiyor.

---

## Tasarım

### 1. Şema Değişiklikleri (SQL — Supabase Studio'dan çalıştırılır)

```sql
-- videos.firm_id: NOT NULL kaldır, CASCADE → SET NULL
ALTER TABLE videos
  ALTER COLUMN firm_id DROP NOT NULL,
  DROP CONSTRAINT videos_firm_id_fkey,
  ADD CONSTRAINT videos_firm_id_fkey
    FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE SET NULL;

-- Bucket dosya limiti 500MB
UPDATE storage.buckets
  SET file_size_limit = 524288000
  WHERE id = 'digital-signage';
```

`schema.sql` dosyası da bu değişiklikleri yansıtacak şekilde güncellenir.

### 2. Firma Silme Davranışı

Kod değişikliği gerekmez. Şema değişikliğiyle:
- Firma silinir → ilgili videoların `firm_id` alanı `NULL` olur
- Videolar DB'de ve storage'da yerinde kalır

### 3. İçerikler Sekmesi — Video Listesi

- `firm_id = NULL` olan videolar "—" firma etiketiyle gösterilir
- Mevcut `firmsMap` lookup'ı kullanılır; firma bulunamazsa "—" döner
- Video hem mp4 hem jpg/png için geçerli (isImage() kontrolü korunur)

### 4. Video/Görsel Silme (Düzeltme)

Mevcut davranış: yalnızca DB kaydı siliniyor.

Yeni davranış — sırayla:
1. `storage.remove(["videos/{fileName}"])` — ana dosya
2. `storage.remove(["thumbnails/thumb_{baseName}.jpg"])` — thumbnail (varsa)
3. `supabase.from("videos").delete().eq("id", videoId)` — DB kaydı

Storage silme hatası işlemi durdurmaz (dosya zaten yoksa devam eder).

### 5. Toplu Silme (Yeni Özellik)

- Her video satırına checkbox eklenir
- Tablo başlığında "Tümünü Seç" checkbox'ı
- En az 1 video seçilince "Seçilenleri Sil (N)" butonu görünür
- Onay dialogu: "N içerik silinecek. Emin misiniz?"
- Seçilen her video için §4'teki silme akışı çalışır (storage + DB)
- Tüm silmeler tamamlanınca liste yenilenir

---

## Kapsam Dışı

- PostgreSQL şifre değişimi (ayrı prosedür, kod değişikliği gerektirmez)
- Sahipsiz videoları otomatik temizleme / cron job
- Firma bazlı video filtreleme dropdown'ı

---

## Uygulama Sırası

1. `schema.sql` güncelle
2. `dashboard.js` — firma adı gösterimi ("—" fallback)
3. `dashboard.js` — tekli silme storage temizliği
4. `dashboard.js` — toplu silme UI + mantığı
5. GitHub'a push
6. Supabase Studio'da SQL komutlarını çalıştır (kullanıcı yapar)
7. VPS'te `git pull`
