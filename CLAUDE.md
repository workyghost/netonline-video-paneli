# NetOnline Digital Signage — Proje Kuralları & Bağlam

## Proje Kimliği

TV ekranlarında merkezi video yönetimi sağlayan **Digital Signage** sistemi.
Çok müşterili ajans modeli: firmalar dashboard üzerinden dinamik olarak yönetilir.

**Mevcut sürüm:** v2.1.0 (kararlı, prodüksiyona hazır)

---

## Teknoloji Stack'i — Sabit, Değiştirme

| Katman | Teknoloji |
|--------|-----------|
| Arayüz | Vanilla JS, HTML5, TailwindCSS (CDN) |
| Auth | Firebase Auth v9 (Email/Password + Anonymous) |
| Veritabanı | Firebase Firestore v9 |
| Depolama | Firebase Storage v9 |
| Hosting | Firebase Hosting veya VPS (nginx) |

**Framework ekleme yok. React, Vue, build tool, npm package yok.**
Her şey plain HTML/JS dosyaları olarak kalır. TailwindCSS sadece CDN üzerinden.

---

## Dosya Yapısı

```
netonline-video-paneli/
├── index.html              — Login sayfası (email/şifre)
├── dashboard.html          — Admin SPA (5 sekme, sidebar)
├── player.html             — TV oynatıcı (anonim auth)
├── css/
│   └── style.css           — Login ve player stilleri (glassmorphism, spinner, toggle)
├── js/
│   ├── firebase-config.js  — Firebase v9 config, çift app instance (admin + player)
│   ├── auth.js             — Login + oturum yönlendirme
│   ├── dashboard.js        — SPA mantığı (5 sayfa, onSnapshot, toast, modal)
│   └── player.js           — TV player (screenId, onSnapshot, heartbeat)
├── firebase.json           — Hosting config + cache headers + emülatör portları
├── firestore.rules         — Güvenlik kuralları
├── firestore.indexes.json  — Composite index (firmId + isActive + createdAt)
├── storage.rules           — Storage güvenlik kuralları
├── seed-emulator.mjs       — Lokal geliştirme seed scripti (⚠️ prod'da çalıştırma)
├── test-upload.mjs         — Lokal geliştirme video yükleme scripti
└── docs/
    ├── README.md           — Kurulum, deployment, mimari
    └── CHANGELOG.md        — Sürüm geçmişi
```

**`css/style.css`**: Dashboard artık Tailwind utility sınıfları kullanıyor. `style.css` sadece `index.html` (login) ve `player.html` tarafından kullanılıyor.

---

## Mimari — v2 (Mevcut)

### Firebase Çift App Instance
```javascript
// js/firebase-config.js
const app       = initializeApp(firebaseConfig);           // Admin dashboard
const playerApp = initializeApp(firebaseConfig, 'netonline-player'); // TV player

// Neden: Firebase Auth IndexedDB'yi aynı origin'deki tüm tablar arasında paylaşır.
// Ayrı app adı → player'ın anonim auth'u admin session'ını etkilemez.
```

### Dashboard SPA (js/dashboard.js)
- 5 sayfa: Genel Bakış, Ekranlar, İçerikler, Playlist'ler, Ayarlar
- `showPage(pageId)` → önceki listener unsubscribe → yeni sayfa init
- `unsubscribers[pageId]` → her sayfanın cleanup fonksiyonu
- `onSnapshot` → Genel Bakış + Ekranlar + Ayarlar sayfaları realtime
- `getDocs` → İçerikler + Playlist'ler sayfaları (upload/CRUD sonrası manual refresh)

### Player Akışı (js/player.js)
```
player.html açılır
  → signInAnonymously(playerAuth)
  → localStorage'da screenId var mı?
      EVET → getDoc(screens/screenId) → exists? → onSnapshot listener → oynat
      HAYIR → showSetupScreen()
Setup: firma seç → ad/konum/yön gir → addDoc(screens) → localStorage'a screenId yaz → oynat
Heartbeat: 60s interval → updateDoc(screens/id, {lastSeen, status, currentVideoId, currentVideoTitle})
```

---

## Firestore Şeması (v2 Mevcut)

```
firms/{firmId}
  name: string
  createdAt: timestamp

videos/{videoId}
  title: string
  firmId: string
  orientation: "horizontal" | "vertical" | "both"
  fileName: string          // Storage'daki dosya adı (silme için)
  fileUrl: string           // Firebase Storage download URL
  thumbnailUrl: string
  isActive: boolean
  expiresAt: timestamp | null
  createdAt: timestamp
  updatedAt: timestamp

screens/{screenId}
  firmId: string
  name: string
  location: string
  orientation: "horizontal" | "vertical"
  status: "online" | "offline"
  lastSeen: timestamp
  currentVideoId: string | null
  currentVideoTitle: string | null
  playlistId: string | null
  registeredAt: timestamp

playlists/{playlistId}
  firmId: string
  name: string
  items: [{ videoId: string, order: number, durationOverride: null }]
  createdAt: timestamp
  updatedAt: timestamp
```

---

## Güvenlik Kuralları (Mevcut)

### firestore.rules
```
firms, videos, playlists:
  read:  request.auth != null
  write: request.auth != null && request.auth.token.email != null

screens:
  read:   request.auth != null
  create: request.auth != null                          // player ekran kaydedebilir
  update: request.auth != null &&
    (email != null ||                                   // admin her alanı güncelleyebilir
     affectedKeys.hasOnly([                             // player sadece heartbeat alanlarını
       'lastSeen','status','currentVideoId','currentVideoTitle']))
  delete: email != null
```

### storage.rules
```
videos/**, thumbnails/**:
  read:  request.auth != null
  write: request.auth != null && request.auth.token.email != null
```

---

## Dashboard Sayfaları

| Sayfa | Veri | Özellikler |
|-------|------|-----------|
| Genel Bakış | onSnapshot (screens + videos) | 4 metrik kart, ekran durumu tablosu |
| Ekranlar | onSnapshot (screens) | Playlist atama, düzenle, sil, yeni ekran |
| İçerikler | getDocs (videos) | Upload modal, filtreler, toggle, sil |
| Playlist'ler | getDocs (playlists) | CRUD modal, ↑↓ sıralama, bağımlılık kontrol |
| Ayarlar | onSnapshot (firms) | Firma CRUD, şifre değiştirme |

---

## Kod Kuralları

- Tüm Firestore işlemleri `try/catch` içinde → hata: `showToast(msg, "error")`
- Kullanıcı verisi DOM'a `esc()` ile yazılır (XSS koruması)
- Silme işlemleri `confirm()` dialog sonrası
- Tarih/saat: `toLocaleDateString('tr-TR')` ve `toLocaleTimeString('tr-TR')`
- Sayfa geçişinde `unsubscribers[pageId]()` ile listener temizlenir
- `isUploading = true/false` upload sırasında modal kapanmasını engeller

---

## Geliştirme Ortamı

```bash
firebase emulators:start    # Auth:9099, Firestore:8080, Storage:9199, Hosting:5000
node seed-emulator.mjs      # Admin user + 4 firma + 2 ekran + 1 playlist
node test-upload.mjs        # 01.mp4 + 02.mp4 → Nethouse firmasına yükle
# http://127.0.0.1:5000 → admin@netonline.com / admin123
```

---

## Changelog Zorunluluğu

`docs/CHANGELOG.md` **her kod değişikliğinde güncellenmelidir.**
Sürümleme: `MAJOR.MINOR.PATCH` (Anlamsal Sürümleme)
**Mevcut sürüm: v2.1.0**
