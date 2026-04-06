# Changelog

Tüm önemli değişiklikler bu dosyada belgelenir.

Biçim: [Anlamsal Sürümleme](https://semver.org/lang/tr/) — `MAJOR.MINOR.PATCH`

---

## [1.2.1] — 2026-04-06

### Eklendi
- `firebase-config.js`'e `updatePassword`, `reauthenticateWithCredential`, `EmailAuthProvider` export edildi (Ayarlar sayfası şifre değiştirme için)

---

## [1.2.0] — 2026-04-06

### Eklendi
- Her TV ekranı Firestore `screens` koleksiyonuna kendi kimliğiyle kayıt oluyor
- Ekran kayıt akışı: firma seç + ekran adı + konum + yön → Firestore'a yaz → screenId localStorage'a kaydet
- Heartbeat: her 60 saniyede `lastSeen` + `currentVideoId` + `currentVideoTitle` güncelleniyor
- `beforeunload`: sayfa kapanırken ekran `status: "offline"` yapılıyor
- Playlist modu: ekrana playlist atanınca `onSnapshot` ile sıralı video oynatılıyor
- Hatalı video URL: 3 saniye bekle → sonraki videoya geç
- 3 üst üste hata: "İçerik yüklenemiyor" mesajı + 5 dakika sonra retry

### Değiştirildi
- 5 dakikalık polling (`setInterval` + `getDocs`) tamamen kaldırıldı; yerine `onSnapshot` realtime listener
- Ekran sıfırlama (dişli ikon): Firestore kaydı silinmiyor, sadece `status: "offline"` + `location.reload()`
- Setup formu: firma + ekran adı + konum + yön (radio) → "Ekranı Kaydet" butonu

### Düzeltildi
- Sayfa yenilenince setup ekranı gelme sorunu: `localStorage`'daki `screenId` Firestore'da doğrulanıyor

---

## [1.1.0] — 2026-04-06

### Eklendi
- `screens` koleksiyonu Firestore şemasına eklendi (seed: 2 örnek ekran)
- `playlists` koleksiyonu Firestore şemasına eklendi (seed: 1 örnek playlist)
- Player'a Firebase Anonymous Auth eklendi — Firestore erişimi auth sonrası başlıyor
- Auth başarısız olursa ekranda "Bağlantı hatası, yeniden deneniyor..." gösterilip 30 saniyede retry yapılıyor

### Değiştirildi
- Firma listesi zaten Firestore'dan dinamik çekiliyordu; hard-coded liste bulunmadığı doğrulandı

### Güvenlik
- Firestore okuma kuralları: herkese açıktan (`allow read: if true`) anonim auth gerektirene güncellendi
- Storage okuma kuralları: auth zorunlu hale getirildi
- `screens` ve `playlists` koleksiyonları için Firestore kuralları eklendi

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
