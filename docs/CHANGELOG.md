# Changelog

Tüm önemli değişiklikler bu dosyada belgelenir.

Biçim: [Anlamsal Sürümleme](https://semver.org/lang/tr/) — `MAJOR.MINOR.PATCH`

---

## [2.3.2] — 2026-04-09

### Hata Düzeltmeleri
- **Video yükleme orientation hatası**: VPS'te video yüklerken `null value in column "orientation"` hatası alınıyordu. Insert sorgusuna varsayılan `'horizontal'` değeri eklendi.

---

## [2.3.1] — 2026-04-09

### Yeni Özellikler
- **Görsel desteği (JPG/PNG)**: Dashboard'dan görsel yüklenebilir; player'da blur background ile tam ekran 30 saniye gösterilir. Link modunda sayaç overlay kapatıldıktan sonra başlar.
- **Kalıcı error toast**: Hata mesajları ✕ butonuyla kapatılana kadar ekranda kalır; başarı mesajları 3.5s sonra otomatik kapanır.

### İyileştirmeler
- **Orientation (Yön) kaldırıldı**: Upload formu, içerik filtresi, ekranlar tablosu ve tüm modallardan yön alanı kaldırıldı. Player tüm aktif içerikleri oynatur; blur fill farklı en/boy oranlarını otomatik doldurur.
- **Ekranlar listesi anlık güncelleme**: Ekran eklenince/düzenlenince liste sayfa yenilemesine gerek kalmadan anında güncellenir.
- **Büyük video oynatma düzeltmesi**: Mock server video dosyalarını geçici diske kaydeder, HTTP Range request desteğiyle serve eder. Uzun videolar kendi tam süresince (58s test videosu tam oynandı) çalışır.
- **Upload gerçek progress**: XHR ile yükleme sırasında "X.X MB / Y.Y MB" gösterimi, 10 dakika timeout, HTTP 413/403/404 hata mesajları.

---

## [2.3.0] — 2026-04-09

### Düzeltildi
- **Video yükleme — büyük dosya desteği**: `supabase.storage.upload()` yerine `XMLHttpRequest` kullanıldı. Eski SDK upload'u gerçek ilerleme bilgisi vermiyordu ve büyük dosyalarda hatalı davranıyordu.
  - Gerçek upload progress (gönderilen MB / toplam MB gösterimi)
  - 10 dakika timeout limiti
  - HTTP 413, 403, 404 için anlamlı Türkçe hata mesajları
- **supabase-config.js**: `SUPABASE_URL` export'u eklendi (XHR endpoint inşası için gerekli)

### VPS Notu
Eğer VPS'te hâlâ 413 hatası alıyorsanız, Easypanel Nginx ayarlarında `client_max_body_size` değerini artırın (örn: `500m`).

---

## [2.2.9] — 2026-04-09

### Lokal Test Sunucusu (mock-server) İyileştirmeleri
- **Realtime broadcast**: Supabase realtime v2 Phoenix array protokolü (`[joinRef,ref,topic,event,payload]`) desteği eklendi. Önceki obje formatı `data.event` çalışmıyordu. Artık tüm DB değişiklikleri (INSERT/UPDATE/DELETE) bağlı dashboard'lara anında yansıyor.
- **Subscription ID**: `phx_join` yanıtında subscription ID'leri (`response.postgres_changes[].id`) gönderilmektedir. Supabase client bu ID'leri kullanarak broadcast eventlerini doğru callback'e yönlendiriyor.
- **`.single()` fix**: REST API GET endpoint'i `Accept: application/vnd.pgrst.object+json` header'ı gönderildiğinde dizi yerine tek nesne döndürüyor. Önceki davranışta player.js'deki `screen.playlist_id` undefined geliyordu; bu da "video bulunamadı" hatasına yol açıyordu.
- **Anonymous auth**: `POST /auth/v1/signup` endpoint'i eklendi. Player TV modu artık anonim oturum açabiliyor.

---

## [2.2.8] — 2026-04-09

### Düzeltildi
- **İçerikler — Tbody Temizleme Hatası**: `renderVideos()` video listesi boşken `tbody.innerHTML`'i temizlemeden döndüğünden eski DOM satırları gizli tablo içinde kalıyordu. `tbody.innerHTML = ""` çağrısı `filtered.length` kontrolünden önceye alındı.

### Lokal Test Sunucusu (mock-server) İyileştirmeleri
- **Thumbnail Storage Düzeltmesi**: Express 5'te `*path` wildcard'ı string yerine dizi döndürüyor. `parsePath()` yardımcı fonksiyonu eklenerek dizi doğru şekilde `join('/')` ile stringe çevriliyor. Bu düzeltme öncesinde thumbnail upload ve download anahtarları Map'te hiç eşleşmiyordu.
- **Storage Upload/Download Desteği**: Thumbnail yüklemeleri artık belleğe alınıp servis ediliyor; video dosyaları belleği doldurmamak için drain ediliyor.
- **Favicon**: Mock server `/favicon.ico` isteğine 204 döndürüyor, 404 hatası giderildi.

---

## [2.2.7] — 2026-04-08

### Kritik Düzeltme
- **Firma Ekleme/Listeleme Deadlock Giderildi**: Supabase JS v2'de `onAuthStateChange` callback'i çalışırken session lock tutulur. Bu callback içinden `supabase.from(...).select()` gibi DB sorgusu yapılması lock'u deadlock'a sokarak isteğin hiçbir zaman sunucuya ulaşmamasına neden oluyordu. `loadFirmsMap()` çağrısı `onAuthStateChange`'den kaldırılıp yalnızca `getSession().then()` içinde bırakıldı. Bu düzeltme VPS üzerindeki firma ekleme/görmeme sorununu da çözüyor.

---

## [2.2.6] — 2026-04-08

### Düzeltildi
- **Login Sonrası Otomatik Yönlendirme**: Giriş başarılı olunca `dashboard.html` sayfasına doğrudan yönlendirme eklendi; artık tekrar tıklamaya gerek yok.
- **Firma Ekleme Kesin Düzeltme**: `.select().single()` zinciri kaldırıldı (bazı self-hosted Supabase versiyonlarında hata üretiyordu). Artık insert sonrası liste veritabanından yeniden yükleniyor.
- **RLS Politikaları**: `auth.role()` yerine `auth.uid() IS NOT NULL` kullanılarak self-hosted Supabase uyumluluğu sağlandı. Her işlem (SELECT/INSERT/UPDATE/DELETE) için ayrı politika ve `WITH CHECK` eklendi.
- **fetchFirms Global Map Senkronizasyonu**: `fetchFirms` artık `firmsMap` global state'ini de güncelliyor; firma listesiyle diğer sayfaların senkronize kalması garantilendi.

### Güncellendi
- `sql/schema.sql`: Yeni RLS politika yapısıyla güncellendi.

---

## [2.2.5] — 2026-04-08

### Düzeltildi
- **Firma Ekleme Çalışmıyor**: Ayarlar sayfasında firma ekle butonuna basılınca liste güncellenmiyordu. Realtime subscription'a ek olarak insert/delete sonrası `fetchFirms()` doğrudan çağrılarak güncelleme garantisi sağlandı.
- **Şifre Değiştirmede Mevcut Şifre Doğrulanmıyordu**: "Mevcut Şifre" alanı arayüzde bulunmasına karşın sunucu tarafında doğrulanmıyordu. Artık `signInWithPassword` ile mevcut şifre doğrulanıyor; hatalı girişte açık hata mesajı gösteriliyor.

### Eklendi
- **Overview Firma Uyarısı**: Henüz hiç firma eklenmemişse Genel Bakış sayfasında sarı uyarı banner'ı görünür. Banner, Ayarlar sayfasına doğrudan bağlantı içerir ve firma eklendiğinde otomatik kaybolur.
- **Firma Silme Sonrası Anlık Liste Yenileme**: Firma silindikten sonra liste Realtime'a bağlı kalmaksızın anında güncellenir.

---

## [2.2.4] — 2026-04-07

### Değiştirildi
- **Mimari Yaygınlaştırma (.gitignore):** `js/supabase-config.js` dosyası üzerindeki `.gitignore` kısıtlaması kaldırıldı. Anon Key'in (Anonim Anahtarın) istemci (client) kodunda barındırılmasının güvenlik zafiyeti yaratmadığı (RLS kurallarıyla korunduğu) teyit edilerek projenin Github üzerinden VPS ortamlarına kolay taşınabilmesi sağlandı.

---

## [2.2.3] — 2026-04-07

### Güvenlik & Mimari Düzeltmeler
- **Depolanan Supabase Anahtarları Temizliği (Kritik)**: Daha önceden `.gitignore` de unutulan `supabase-config.js` doyası Github takip sisteminden temizlendi (`git rm --cached`). Artık API anahtarları asla repoya aktarılmayacak; kurulum referansı olması için `supabase-config.example.js` eklendi. (Readme adımları buna göre güncellendi).
- **Yalan Beyan Giderildi (CSP Etiketleri)**: Eski changelog versiyonlarında eklendiği söylenen ama HTML'lerde unutulan `Content-Security-Policy` etiketleri `dashboard.html` ve `index.html` e eklendi.
- **Nginx Kılavuzu İyileştirildi**: VPS Nginx sunucu yapılandırması aşırı savunmasızdı; `README.md` içerisindeki Nginx bloğuna `X-Frame-Options`, `X-Content-Type-Options` gibi zorunlu header'lar eklendi.

---

## [2.2.2] — 2026-04-07

### Güvenlik
- **Kritik Oynatıcı Güncelleme Zafiyeti Giderildi**: Oynatıcıların RLS (*Row Level Security*) politikalarında anonim kullanıcılara, kendi "heartbeat" alanlarını güncellemeleri için serbestlik verilmiş ancak bu aynı zamanda diğer ekranların da `playlist_id`, `firm_id` ve diğer kritik bilgilerini güncelleyebilmesine yol açmıştı. 
- Supabase/PostgreSQL şemasına **`restrict_screen_updates`** adında bir güvenlik tetikleyicisi (*Trigger*) eklenerek; admin yetkisi (authenticated) olmayan kişilerin ekran ağını ele geçirmesinin önüne veri tabanı çekirdeğinden %100 kesinlikte geçilmiştir.

---

## [2.2.1] — 2026-04-07

### Düzeltildi
- **Storage Bucket İsimlendirme Uyumsuzluğu**: Şema açıklamalarındaki ve `dashboard.js` içerisindeki `storage-netonline` isimleri, README belgesiyle ve standartlarla tutarlı olarak `digital-signage` şeklinde güncellendi.
- **Güvenlik / Şema**: `schema.sql` içerisine eksik olan Supabase Storage kova (bucket) oluşturma komutu ve okuma/yazma/silme yetkilerini belirleyen RLS (Row Level Security) kuralları eklendi.

---

## [2.2.0] — 2026-04-07

### Değiştirildi
- **Backend Geçişi**: Firebase'den Supabase'e geçiş tamamlandı.
  - Veritabanı olarak NoSQL (Firestore) yerine PostgreSQL (Supabase) kullanıldı.
  - Kimlik doğrulama Firebase Auth'tan Supabase Auth'a geçirildi.
  - Realtime veri akışı için Firestore `onSnapshot` yerine Supabase Realtime (Channels) yapısına geçildi.
  - Depolama operasyonları Supabase Storage API'ye aktarıldı.
- Firebase'e özel olan tüm konfigürasyon ve kurallar (`firebase-config.js`, `firestore.rules` vb.) temizlendi, `supabase-config.js` eklendi.
- PostgreSQL standardına uygun olarak camelCase veritabanı isimleri snake_case'e dönüştürüldü.

---

## [2.1.0] — 2026-04-07

### Eklendi
- **player.html: URL parametreli link modu** — `player.html?screen=ID` formatında doğrudan ekran linki desteği
  - URL'de `?screen=` varsa setup ekranı gösterilmez; geçerli ekrana bağlanır, localStorage'a yazılmaz (stateless)
  - Geçersiz ekran ID'sinde siyah ekranda "Geçersiz ekran linki" mesajı gösterilir
  - Siyah ekranda büyük ▶ ikonu + "Oynatmak için tıklayın" yazısı; tıklanınca fullscreen açılır ve video başlar
  - Fullscreen'den çıkılınca (ESC) ▶ overlay tekrar gösterilir
- **player.html: Kontrol çubuğu** — playerScreen üzerine gelinince beliren, 3 saniye hareketsizlikte kaybolan yarı saydam kontrol çubuğu (48px, z-index yüksek)
  - Play/Pause, Ses Aç/Kapat, Fullscreen Gir/Çık butonları (SVG ikonlar, durum bazlı)
- **dashboard.js: Ekranlar sayfasına "Linki Kopyala" butonu** — her ekran satırına `player.html?screen=ID` formatında link panoya kopyalayan buton eklendi
- **player.html: ES Module optimizasyonları** — `<link rel="modulepreload">` ile `player.js` ve `firebase-config.js` ön yükleme; `<noscript>` fallback mesajı; `upgrade-insecure-requests` CSP meta tag

---

## [2.0.4] — 2026-04-06

### Değiştirildi
- `.gitignore` oluşturuldu: `*.mp4`, `FAZ*.md`, `.claude/`, `.superpowers/`, `*.log` repoya alınmıyor
- `docs/superpowers/` iç geliştirme dokümanları repodan kaldırıldı
- `firestore.indexes.json` git takibine alındı (composite index tanımı)
- `CLAUDE.md` v2.0.3 mimarisine göre tamamen güncellendi
- `docs/README.md` yeniden yazıldı: güncel mimari, VPS/nginx deployment rehberi, nginx config

### Kaldırıldı
- `docs/superpowers/plans/` ve `docs/superpowers/specs/` — iç geliştirme dokümanları

---

## [2.0.3] — 2026-04-06

### Güvenlik
- **Firestore rules**: anonim kullanıcılar (player) artık yalnızca kendi heartbeat alanlarını (`lastSeen`, `status`, `currentVideoId`, `currentVideoTitle`) güncelleyebiliyor; başka ekranların `playlistId`, `firmId`, `name` alanlarını değiştiremez
- **CSP header**: tüm sayfalara `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options: DENY` eklendi
- `seedFirms()` login akışından kaldırıldı — her girişte gereksiz Firestore okuma yapıyor ve hard-coded firma adları içeriyordu
- `firebase.json` ignore: `*.mjs` dosyaları artık deploy'a gitmiyor

### Düzeltildi
- `data-raw-name` özel kaçış yöntemi kaldırıldı; `esc()` tutarlı olarak kullanılıyor
- `videoUrl` → `fileUrl`: CLAUDE.md şeması gerçek kodla hizalandı

---

## [2.0.2] — 2026-04-06

### Değiştirildi
- `firebase-config.js`: `USE_EMULATORS` hostname'e göre otomatik belirleniyor (localhost → emülatör, diğer → production)
- `firebase.json`: hosting ignore listesi genişletildi, JS/CSS cache + HTML no-cache header'ları eklendi
- Player `playing` event'i artık ardışık hata sayacını sıfırlıyor

### Güvenlik
- `player.html` ve `dashboard.html`'e `noindex, nofollow` meta tag'i eklendi
- Dashboard auth guard zaten aktifti: anonim kullanıcılar login'e yönlendiriliyor

### Düzeltildi
- Player: internet bağlantısı kesilince `disableNetwork(db)` ile Firestore offline cache'e geçiliyor, geri gelince `enableNetwork(db)` ile yeniden bağlanıyor

---

## [2.0.1] — 2026-04-06

### Düzeltildi
- **Kritik: Sonsuz döngü** — player.html ve dashboard.html aynı Firebase Auth IndexedDB'yi paylaşıyordu; player'ın `signInAnonymously` çağrısı admin session'ını silip dashboard'u login sayfasına yönlendiriyordu
- Player için `netonline-player` adlı ayrı Firebase App instance oluşturuldu; auth state'leri artık tamamen izole

---

## [2.0.0] — 2026-04-06

### Eklendi
- Sidebar navigasyonlu modern SPA dashboard (5 sayfa, JS tab switching, sayfa yenileme yok)
- Genel Bakış: realtime metrik kartları (Toplam/Çevrimiçi Ekran, Toplam/Aktif Video) + ekran durumu tablosu
- Ekranlar sayfası: playlist atama, düzenleme, silme, dashboard'dan yeni ekran ekleme
- Playlist yönetimi: oluştur, düzenle, ↑↓ sıralama, ekrana ata, bağımlılık kontrolü
- Ayarlar: dinamik firma CRUD (bağımlılık kontrolü ile) + şifre değiştirme
- Toast notification sistemi (success/error/info, 3.5sn auto-remove)
- Modal sistemi (overlay click ile kapatma, upload sırasında kilit)

### Değiştirildi
- Dashboard tek sayfa yapısından SPA mimarisine geçildi
- Video upload formu sabit görünümden modal'a taşındı
- Genel Bakış ve Ekranlar sayfaları onSnapshot realtime'a geçildi
- Sayfa geçişlerinde önceki onSnapshot listener'lar temizleniyor (bellek sızıntısı yok)

### Kaldırıldı
- Eski header+main tek sayfa dashboard layout
- css/style.css dashboard bağımlılığı (player.html hâlâ kullanıyor)

---

## [1.2.7] — 2026-04-06

### Eklendi
- `initSettings()` tam implementasyonu: firma CRUD yönetimi ve şifre değiştirme
- Firma listesi `onSnapshot` ile realtime güncellenir; satır içi isim düzenleme ve kaydetme
- Firma silme öncesinde bağlı `screens` ve `videos` sayısı kontrol edilir; kullanımdaysa uyarılı confirm
- Firma ekleme/silme/güncelleme işlemlerinde `firmsMap` in-memory güncellenir
- Şifre değiştirme: mevcut şifre ile yeniden kimlik doğrulama (`reauthenticateWithCredential`), doğrulama hataları kullanıcıya gösterilir
- `unsubscribers.settings = unsubFirms` — sayfa değişince listener temizlenir

---

## [1.2.6] — 2026-04-06

### Eklendi
- `initPlaylists()` tam implementasyonu: tablo listesi, "Yeni Playlist" butonu, düzenle/sil işlemleri
- Playlist oluştur/düzenle modalı: ad, firma seçimi, video checkbox listesi, ↑↓ sıralama ve ✕ kaldırma
- Firma seçilince o firmaya ait videolar Firestore'dan dinamik yüklenir
- Silme öncesi ekran bağımlılık kontrolü: `screens` koleksiyonunda `playlistId` ile sorgu; kullanımdaysa uyarılı confirm
- `items` formatı: `[{ videoId, order, durationOverride: null }]` — CLAUDE.md şemasına uygun
- `unsubscribers.playlists = null` — getDocs tabanlı sayfa, onSnapshot listener gerektirmez

---

## [1.2.5] — 2026-04-06

### Eklendi
- `initContents()` implementasyonu: video tablosu, firma/yön/arama filtreleri, aktif/pasif toggle, silme
- Upload modal: drag & drop veya dosya seç, çoklu MP4 desteği, firma/yön/bitiş tarihi alanları, yükleme progress bar
- `uploadSingleVideo()`: Firebase Storage'a yükleme, Firestore `videos` koleksiyonuna `setDoc`
- `generateThumbnail()`: video canvas'tan JPEG kapak oluşturma ve Storage'a yükleme
- Silme işlemi: video dosyası ve kapak görseli Storage'dan, belge Firestore'dan silinir
- `unsubscribers.contents = null` — getDocs tabanlı sayfa, onSnapshot listener gerektirmez

---

## [1.2.4] — 2026-04-06

### Eklendi
- `initScreens()` implementasyonu: onSnapshot tablosu, playlist atama dropdown'u, düzenle/sil/yeni ekran modalları
- `openAddScreenModal()`: firma seç, ekran adı, konum, yön alanlarıyla yeni ekran oluşturma; Firestore `screens` koleksiyonuna `addDoc` ile kaydeder
- `openEditScreenModal()`: ekran adı, konum ve yön güncelleme modalı (firma değiştirilemez)
- Playlist atama: her satırda inline `<select>` ile `updateDoc` anında kaydeder
- Silme: confirm dialog + `deleteDoc`; durum badge'i `lastSeen < 2 dk` online kriteri ile yeşil/kırmızı
- `unsubscribers.screens` listener temizliği

---

## [1.2.3] — 2026-04-06

### Eklendi
- `initOverview()` implementasyonu: 4 metrik kartı (Toplam Ekran, Çevrimiçi, Toplam Video, Aktif Video) ve ekran durumu tablosu
- Metrik kartlar `onSnapshot` ile realtime güncellenir; ekran listesi son görülme zamanına göre online/offline badge gösterir
- Online kriteri: `lastSeen` < 2 dakika; `firmsMap` üzerinden firma adı çözümleme
- Sayfa temizliği için `unsubscribers.overview` hem screens hem videos listener'larını kapatır

---

## [1.2.2] — 2026-04-06

### Değiştirildi
- `js/dashboard.js` tamamen yeniden yazıldı: eski tek-sayfa yapısı kaldırıldı, v2 mimarisine uygun foundation oluşturuldu
- Auth guard: anonim kullanıcılar da login'e yönlendiriliyor (`user.isAnonymous` kontrolü eklendi)
- Routing sistemi: `showPage()` ile JS tab switching, sayfa yenileme yok; önceki sayfa listener'ları `unsubscribers` map ile temizleniyor
- Toast bildirimleri: `alert()` yerine non-blocking `showToast()` (success/error/info)
- Modal altyapısı: `openModal()` / `closeModal()`, `window.closeModal` global olarak expose edildi (inline onclick için)
- Yardımcı fonksiyonlar: `esc()`, `timeAgo()`, `formatDate()`, `firmsOptions()`, `ORIENTATION_LABEL` sabiti
- Sayfa init stub'ları eklendi (overview, screens, contents, playlists, settings) — sonraki task'larda doldurulacak

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
