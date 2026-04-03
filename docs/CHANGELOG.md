# Changelog

Tüm önemli değişiklikler bu dosyada belgelenir.

Biçim: [Anlamsal Sürümleme](https://semver.org/lang/tr/) — `MAJOR.MINOR.PATCH`

---

## [1.0.0] — 2026-04-03

İlk kararlı sürüm. Temel video yönetim paneli ve TV oynatıcı tamamlandı.

### Eklendi
- **Login** — Firebase Auth e-posta/şifre girişi, Türkçe hata mesajları, oturum kontrolü
- **Dashboard** — Video yükleme (sürükle-bırak), listeleme, aktif/pasif toggle, silme
- **Çoklu video yükleme** — Birden fazla MP4 dosyası aynı anda seçilip sırayla yüklenebilir
- **Otomatik başlık** — Dosya adından başlık otomatik doldurulur (uzantı kaldırılır, `-` ve `_` boşluğa çevrilir)
- **Otomatik kapak görseli** — Video yüklenirken `loadedmetadata` + canvas ile 1. saniyeden kare alınır, Storage'a JPEG olarak kaydedilir; 4s timeout fallback
- **Video meta verisi** — Firma, yön (yatay/dikey/ortak), bitiş tarihi
- **TV Oynatıcı** — Firma + ekran modu seçimi, blur fill efekti, sesli oynatma, kesintisiz döngü
- **Fullscreen yönetimi** — Oynatma başlayınca tam ekran; ESC veya fullscreen çıkışında kurulum ekranına dönüş; sayfa yenileme sonrası "Devam etmek için dokunun" overlay
- **5 dakikalık otomatik yenileme** — Playlist Firestore'dan yeniden çekilir
- **Dişli ikon** — Local Storage temizle ve kurumsal ekrana dön
- **Premium UI** — Google Fonts Inter, glassmorphism kartlar, mesh gradient arka plan, özel tablo stilleri
- **Güvenlik** — Kullanıcı verisi yalnızca `textContent` ile DOM'a yazılır (XSS koruması); başlıkta `maxlength="200"` sınırı; Storage'da `/thumbnails/` kuralı eklendi
- **Firebase Emulator** desteği — Auth, Firestore, Storage, Hosting yerel emulatorlar üzerinde çalışır
- **Seed scripti** — Admin kullanıcı ve 4 firma otomatik oluşturulur

### Teknik
- Toggle optimizasyonu: Tüm listeyi yeniden yüklemek yerine tek satır güncellenir (optimistic update + hata durumunda revert)
- `loadFirms()` + `loadVideos()` sıralı `await` ile çalışır — race condition düzeltildi
- Orientation helpers tek `ORIENTATION` config nesnesinde birleştirildi
- `stopPlayback()` helper'a çıkarıldı — player'ın her iki reset akışında ortak kullanılır

---

<!-- Sonraki sürümler için şablon:

## [1.1.0] — YYYY-MM-DD

### Eklendi
-

### Değiştirildi
-

### Düzeltildi
-

### Kaldırıldı
-

-->
