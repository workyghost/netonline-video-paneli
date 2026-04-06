# FAZ 3 Dashboard Yeniden Yazımı — Tasarım Spec

**Tarih:** 2026-04-06  
**Sürüm hedefi:** v2.0.0  
**Durum:** Onaylandı

---

## Kararlar (Brainstorming Çıktısı)

| Konu | Karar |
|------|-------|
| Görsel tema | Dark Clean — `bg-gray-950` body, `bg-gray-900` sidebar, Tailwind utility sınıfları |
| Upload formu | Modal — "＋ Video Yükle" butonu tetikler, tablo tam genişliği kullanır |
| Playlist sıralama | ↑↓ butonları — sürükle-bırak yok |
| JS dosya yapısı | Tek dosya (`dashboard.js`) — bölüm yorumlarıyla organize |

---

## 1. HTML Yapısı (`dashboard.html`)

Mevcut header+main yapısı kaldırılır, yerine:

```
<body class="flex h-screen bg-gray-950 text-white overflow-hidden">
  <aside id="sidebar" class="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
    <!-- Logo -->
    <div class="p-4 border-b border-gray-800">
      <h1>NetOnline DS</h1>
      <p>Yönetim Paneli</p>
    </div>
    <!-- Nav: 5 buton, data-page attribute -->
    <nav class="flex-1 p-3 space-y-1">
      <button data-page="overview">Genel Bakış</button>
      <button data-page="screens">Ekranlar</button>
      <button data-page="contents">İçerikler</button>
      <button data-page="playlists">Playlist'ler</button>
      <button data-page="settings">Ayarlar</button>
    </nav>
    <!-- Alt: email + çıkış -->
    <div class="p-3 border-t border-gray-800">
      <p id="user-email"></p>
      <button id="logout-btn">Çıkış Yap</button>
    </div>
  </aside>

  <main class="flex-1 overflow-y-auto">
    <div id="page-overview"  class="page hidden p-6"></div>
    <div id="page-screens"   class="page hidden p-6"></div>
    <div id="page-contents"  class="page hidden p-6"></div>
    <div id="page-playlists" class="page hidden p-6"></div>
    <div id="page-settings"  class="page hidden p-6"></div>
  </main>

  <div id="toast-container" class="fixed bottom-4 right-4 space-y-2 z-50"></div>

  <div id="modal-overlay" class="hidden fixed inset-0 bg-black/60 z-40 flex items-center justify-center">
    <div id="modal-box" class="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-lg mx-4 p-6"></div>
  </div>
</body>
```

`css/style.css` silinmez ama dashboard tarafından kullanılmaz.  
`player.html` ve `index.html` etkilenmez.

---

## 2. JavaScript Mimarisi (`dashboard.js`)

### Imports
`firebase-config.js`'den eklenmesi gerekenler (henüz export edilmeyenler):
- `updatePassword`, `reauthenticateWithCredential`, `EmailAuthProvider`

### Global State
```javascript
let currentPage = "overview";
let firmsMap = new Map();   // firmId → firmName
let unsubscribers = {};     // pageId → unsubscribe fonksiyonu
```

### Akış
1. `onAuthStateChanged` → user yoksa `index.html`'e yönlendir
2. User varsa: `loadFirmsMap()` çağır → `showPage("overview")`
3. Her nav butonuna click listener → `showPage(pageId)`

### `showPage(pageId)`
```javascript
function showPage(pageId) {
  // Önceki sayfanın listener'ını kapat
  unsubscribers[currentPage]?.();
  // Tüm .page hidden, hedef visible
  // Tüm nav-btn active kaldır, hedef active ekle
  currentPage = pageId;
  // Sayfanın init fonksiyonunu çağır
  const inits = { overview: initOverview, screens: initScreens, ... };
  inits[pageId]?.();
}
```

### Yardımcı Fonksiyonlar

**`showToast(message, type)`**
- `type`: `"success"` (yeşil) | `"error"` (kırmızı) | `"info"` (gri)
- 3.5 saniye sonra DOM'dan kaldırılır

**`openModal(htmlContent)` / `closeModal()`**
- `modal-box` innerHTML set edilir
- Overlay click → `closeModal()`

**`timeAgo(timestamp)`**
- Firestore timestamp → "Az önce" / "X dakika önce" / "X saat önce" / `toLocaleDateString("tr-TR")`

**`loadFirmsMap()`**
- `getDocs(firms)` → `firmsMap` doldur
- Auth sonrası bir kez çağrılır

---

## 3. Sayfa Detayları

### 3A. Genel Bakış (`initOverview`)

**4 metrik kartı (onSnapshot):**
- Toplam Ekran — `screens` koleksiyon boyutu
- Çevrimiçi Ekran — `lastSeen > now - 2dk` filtresi
- Toplam Video — `videos` koleksiyon boyutu
- Aktif Video — `isActive === true` filtresi

**Ekran durumu tablosu:**

| Ekran Adı | Firma | Durum | Şu An Oynayan | Son Görülme |
|-----------|-------|-------|----------------|-------------|

- Durum badge: yeşil "Çevrimiçi" / kırmızı "Çevrimdışı" (lastSeen < 2dk = online)
- Son görülme: `timeAgo(lastSeen)`
- `onSnapshot(screens)` + `onSnapshot(videos)` — her ikisi realtime

`unsubscribers.overview` = her iki listener'ı kapatan tek fonksiyon:
```javascript
const unsubScreens = onSnapshot(screensRef, ...);
const unsubVideos  = onSnapshot(videosRef, ...);
unsubscribers.overview = () => { unsubScreens(); unsubVideos(); };
```

---

### 3B. Ekranlar (`initScreens`)

**Tablo (onSnapshot):**

| Ekran Adı | Firma | Konum | Yön | Durum | Playlist | İşlemler |
|-----------|-------|-------|-----|-------|----------|----------|

**İşlemler:**
- **Playlist Ata:** `<select>` — playlists + "Otomatik (Playlist Yok)" seçeneği  
  → `updateDoc(screens/id, { playlistId: value || null })`  
  → Başarıda toast
- **Düzenle:** Modal → ad / konum / yön inputları → `updateDoc`
- **Sil:** `confirm()` → `deleteDoc(screens/id)`

**"Yeni Ekran Ekle" butonu → Modal:**
- Firma dropdown (firmsMap'ten), ekran adı, konum, yön radio (Yatay/Dikey)
- `addDoc(screens, { firmId, name, location, orientation, status:"offline", lastSeen: serverTimestamp(), currentVideoId:null, currentVideoTitle:null, playlistId:null, registeredAt:serverTimestamp() })`
- localStorage'a **yazmaz** (dashboard, player değil)

`unsubscribers.screens` = screens listener.

---

### 3C. İçerikler (`initContents`)

**Üst bar:**
- "İçerikler" başlığı
- Firma filtresi `<select>` (firmsMap'ten)
- Yön filtresi `<select>` (Tümü / Yatay / Dikey / Ortak)
- Arama `<input>` (client-side, video adına göre filtreler)
- "＋ Video Yükle" butonu → `openModal(uploadFormHTML)`

**Upload mantığı (korunur, modal içine taşınır):**
- Drag-drop zone, multi-file seçim, başlık input (tek dosyada), firma select, yön select, bitiş tarihi
- `uploadBytesResumable` + progress bar
- Thumbnail canvas capture
- Yükleme bitti → `closeModal()` + `loadVideos()` + toast
- Aktif yükleme sırasında modal overlay click ile **kapatılamaz** (upload tamamlanana kadar)

**Video listesi (`loadVideos()` — getDocs):**
- `query(videos, orderBy("createdAt", "desc"))`
- Tablo: kapak, ad, firma, yön badge, bitiş, aktif toggle (optimistic), sil butonu
- Üst bar filtresi değişince client-side filtre uygula (DOM'u yeniden render et)

`unsubscribers.contents` = null (getDocs kullanıyor, listener yok).

---

### 3D. Playlist'ler (`initPlaylists`)

**Liste (getDocs + manuel refresh):**

| Playlist Adı | Firma | Video Sayısı | İşlemler |
|-------------|-------|-------------|----------|

**"Yeni Playlist" modalı:**
1. Playlist adı input
2. Firma dropdown → seçilince alt video listesi güncellenir
3. Video listesi: `getDocs(videos, where("firmId","==",firmId))` → checkbox listesi
4. Seçilen videolar sıra panelinde görünür:  
   `N. Video Adı [↑][↓][✕]`  
   - ↑: index > 0 ise swap
   - ↓: index < length-1 ise swap
   - ✕: listeden kaldır
5. Kaydet:
```javascript
addDoc(playlists, {
  firmId, name,
  items: sıralıVideolar.map((vId, i) => ({ videoId: vId, order: i, durationOverride: null })),
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
})
```

**Düzenle:** Aynı modal, mevcut `items` ile açılır → `updateDoc(playlists/id, { name, items, updatedAt })`

**Sil:**
- `query(screens, where("playlistId","==",id))` → bağlı ekran varsa bildir (uyarıyla devam seçeneği)
- `deleteDoc(playlists/id)`

`unsubscribers.playlists` = null.

---

### 3E. Ayarlar (`initSettings`)

**Firma Yönetimi (onSnapshot):**
- Firmalar listesi: ad + düzenle (inline input) + sil butonu
- "Firma Ekle": input + button → `addDoc(firms, { name, createdAt: serverTimestamp() })`
- **Silmeden önce bağımlılık kontrolü:**
  ```
  screens where firmId == id → count
  videos where firmId == id  → count
  ```
  count > 0 → "Bu firmaya bağlı X ekran ve Y video var. Yine de silmek istiyor musunuz?"
- Sil: `deleteDoc(firms/id)`

**Şifre Değiştirme:**
- Mevcut şifre + yeni şifre + tekrar inputları
- `reauthenticateWithCredential(user, EmailAuthProvider.credential(email, mevcutŞifre))`
- `updatePassword(user, yeniŞifre)`
- Başarıda toast, hata mesajı inputun altında

`unsubscribers.settings` = firms listener unsubscribe.

---

## 4. Veri Akışı

### onSnapshot kullanan sayfalar
| Sayfa | Koleksiyon | Neden |
|-------|------------|-------|
| Genel Bakış | screens, videos | Realtime metrik + ekran durumu |
| Ekranlar | screens | Playlist ataması anında görünsün |
| Ayarlar | firms | Firma ekleme/silme anında yansısın |

### getDocs kullanan sayfalar
| Sayfa | Neden |
|-------|-------|
| İçerikler | Upload sonrası refresh yeterli |
| Playlist'ler | Değişim sıklığı düşük |

---

## 5. firebase-config.js Güncellemesi

Eklenecek auth imports/exports:
```javascript
import { ..., updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase-auth.js";
export { ..., updatePassword, reauthenticateWithCredential, EmailAuthProvider };
```

---

## 6. Kapsam Dışı

- `durationOverride` playlist UI'da gösterilmez (veri modelde var, sonraki faz)
- Ekran silince o ekrana atanmış playlistler etkilenmez (Firestore tutarlılığı korunur)
- `css/style.css` silinmez (player.html hâlâ kullanıyor)

---

## 7. CHANGELOG

```
## [2.0.0] — 2026-04-06

### Eklendi
- Sidebar navigasyonlu modern SPA dashboard (5 sayfa, JS tab switching)
- Genel Bakış: realtime metrik kartları ve ekran durumu tablosu
- Ekranlar sayfası: playlist atama, düzenleme, silme, yeni ekran ekleme
- Playlist yönetimi: oluştur, düzenle, ↑↓ sıralama, ekrana ata
- Ayarlar: dinamik firma CRUD + bağımlılık kontrolü + şifre değiştirme
- Toast notification sistemi
- Modal sistemi (overlay click ile kapatma)

### Değiştirildi
- Dashboard tek sayfa yapısından SPA mimarisine geçildi
- Video upload formu sabit görünümden modal'a taşındı
- Genel Bakış ve Ekranlar sayfaları onSnapshot realtime'a geçildi

### Kaldırıldı
- Eski header+main tek sayfa layout
```
