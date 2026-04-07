# NetOnline Digital Signage

**Sürüm:** v2.1.0

TV ekranlarında merkezi video yönetimi sağlayan web tabanlı **Digital Signage** sistemi.
Çok müşterili (multi-tenant) ajans modeli: farklı firmalar için bağımsız ekran ve içerik yönetimi.

---

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Arayüz | Vanilla JS, HTML5, TailwindCSS (CDN) |
| Auth | Firebase Auth v9 — Email/Password (admin) + Anonymous (TV) |
| Veritabanı | Firebase Firestore v9 (realtime onSnapshot) |
| Depolama | Firebase Storage v9 |
| Hosting | Firebase Hosting **veya** kendi VPS (nginx) |

---

## Mimari

```
┌─────────────────────────────────────────────────────┐
│                    Tarayıcı                          │
│                                                      │
│  index.html          dashboard.html     player.html  │
│  (Login)             (Admin SPA)        (TV Oynatıcı)│
│     │                     │                 │        │
│  auth.js            dashboard.js        player.js   │
│     │                     │                 │        │
│  Firebase Auth       Firebase Auth    Firebase Auth  │
│  (default app)      (default app)   (netonline-player│
│                                       ayrı app)      │
└──────────────────────────┬──────────────────────────┘
                           │
                    Firebase Backend
               ┌──────────┼──────────┐
          Firestore    Storage      Auth
```

**Not:** Player ayrı bir Firebase App instance kullanır (`netonline-player`).
Bu sayede player'ın anonim auth'u admin session'ını etkilemez.

---

## Özellikler

### Admin Dashboard (5 Sekme, SPA)
- **Genel Bakış** — Realtime: toplam/çevrimiçi ekran, toplam/aktif video, ekran durumu tablosu
- **Ekranlar** — Ekran CRUD, playlist atama, online/offline durum takibi, **"Linki Kopyala"** ile TV ekranına doğrudan link oluşturma
- **İçerikler** — Video yükleme (çoklu, drag-drop), otomatik thumbnail, filtreler, aktif/pasif toggle
- **Playlist'ler** — Sıralı playlist oluştur/düzenle, ↑↓ sıralama, ekrana atama
- **Ayarlar** — Firma CRUD (bağımlılık kontrolü), şifre değiştirme

### TV Oynatıcı
- İlk açılışta ekran kayıt formu (firma, ad, konum, yön)
- `screenId` localStorage'a kaydedilir — sayfa yenilense de devam eder
- **URL parametreli link modu:** `player.html?screen=ID` ile setup ekranı atlanır, direkt ekrana bağlanır (stateless, localStorage kullanılmaz)
- **Kontrol çubuğu:** fare hareketiyle görünür, 3 saniye hareketsizlikte kaybolur — play/pause, ses, fullscreen
- Realtime `onSnapshot` ile anlık güncelleme (polling yok)
- Dashboard'dan playlist atanınca player 10 saniyede değişimi algılar
- Heartbeat: her 60 saniyede `lastSeen` + `currentVideo` güncelleme
- Offline: internet kesilince son playlist'i çalmaya devam eder
- Hata dayanıklılığı: 3 ardışık hatada 5 dakika sonra retry

---

## Proje Yapısı

```
netonline-video-paneli/
├── index.html              — Login sayfası
├── dashboard.html          — Admin SPA
├── player.html             — TV oynatıcı
├── css/
│   └── style.css           — Login + player stilleri
├── js/
│   ├── firebase-config.js  — Firebase yapılandırması (çift app instance)
│   ├── auth.js             — Login mantığı
│   ├── dashboard.js        — Dashboard SPA (~1200 satır)
│   └── player.js           — TV player mantığı
├── firebase.json           — Hosting + emülatör config
├── firestore.rules         — Firestore güvenlik kuralları
├── firestore.indexes.json  — Composite index tanımları
├── storage.rules           — Storage güvenlik kuralları
├── seed-emulator.mjs       — ⚠️ SADECE lokal geliştirme için seed scripti
├── test-upload.mjs         — ⚠️ SADECE lokal geliştirme için video yükleme scripti
└── docs/
    ├── README.md           — Bu doküman
    └── CHANGELOG.md        — Sürüm geçmişi
```

---

## Güvenlik

| Alan | Uygulama |
|------|----------|
| XSS | Tüm Firestore verisi `esc()` helper ile DOM'a yazılır |
| Firestore | Okuma: auth zorunlu; Yazma: sadece email kullanıcı; Ekran heartbeat: sadece kendi alanları |
| Storage | Okuma + yazma: auth zorunlu |
| Dashboard | Anonim kullanıcı dashboard'a erişemez, login'e yönlendirilir |
| CSP | `Content-Security-Policy` header ile script injection koruması |
| SEO | `noindex, nofollow` — arama motorları indexlemiyor |

---

## Yerel Geliştirme

### Gereksinimler
- **Node.js** 18+
- **Java** 21+ (Firebase Emulator Suite için)
- **Firebase CLI**: `npm install -g firebase-tools`

### Kurulum

```bash
# 1. Emülatörleri başlat
firebase emulators:start

# 2. Yeni terminalde seed verisini yükle
node seed-emulator.mjs

# 3. Test videoları yükle (opsiyonel — 01.mp4 ve 02.mp4 gerekli)
node test-upload.mjs

# 4. Tarayıcıda aç
# http://127.0.0.1:5000
# Giriş: admin@netonline.com / admin123
```

### Emülatör Portları

| Servis | Port |
|--------|------|
| Hosting | 5000 |
| Auth | 9099 |
| Firestore | 8080 |
| Storage | 9199 |
| Emülatör UI | 4000 |

---

## Prodüksiyona Geçiş

### Ön Koşul: Firebase Projesi

[Firebase Console](https://console.firebase.google.com)'da:
1. Yeni proje oluştur (veya mevcut projeyi kullan)
2. **Authentication** → Email/Password ✓, Anonymous ✓ etkinleştir
3. **Firestore Database** oluştur (production mode)
4. **Storage** etkinleştir
5. Proje Ayarları → Web uygulaması → Firebase SDK config'i kopyala

### Firebase Config Güncelle

`js/firebase-config.js` dosyasında `firebaseConfig` nesnesini gerçek değerlerle doldur:

```javascript
const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "proje-id.firebaseapp.com",
  projectId:         "proje-id",
  storageBucket:     "proje-id.firebasestorage.app",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc..."
};
```

`USE_EMULATORS` otomatik: `localhost` → emülatör, diğer → production. Elle değiştirme gerekmez.

### Seçenek A: Firebase Hosting

```bash
firebase login
firebase deploy
```

### Seçenek B: Kendi VPS (nginx)

Statik dosyaları VPS'e kopyala ve nginx ile servis et. Firebase backend (Auth, Firestore, Storage) hâlâ cloud'da çalışır — sadece frontend VPS'te.

#### 1. Firebase Console → Authentication → Authorized Domains
Kendi domain adını ekle: `siteadiniz.com`

#### 2. Dosyaları VPS'e kopyala

```bash
# rsync ile (önerilen)
rsync -av --exclude='.git' --exclude='node_modules' --exclude='*.mp4' \
  --exclude='.claude' --exclude='.superpowers' --exclude='*.log' \
  --exclude='FAZ*.md' --exclude='seed-emulator.mjs' --exclude='test-upload.mjs' \
  ./ user@vps-ip:/var/www/netonline/

# veya git clone
git clone https://github.com/workyghost/netonline-video-paneli /var/www/netonline
```

#### 3. nginx Konfigürasyonu

`/etc/nginx/sites-available/netonline`:

```nginx
server {
    listen 80;
    server_name siteadiniz.com www.siteadiniz.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name siteadiniz.com www.siteadiniz.com;

    root /var/www/netonline;
    index index.html;

    # SSL (Let's Encrypt)
    ssl_certificate     /etc/letsencrypt/live/siteadiniz.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/siteadiniz.com/privkey.pem;

    # Güvenlik başlıkları
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firebasestorage.googleapis.com; img-src 'self' data: https://firebasestorage.googleapis.com; media-src 'self' https://firebasestorage.googleapis.com; frame-ancestors 'none'" always;

    # HTML — önbellekleme yok
    location ~* \.html$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        try_files $uri $uri/ /index.html;
    }

    # JS ve CSS — 1 saat önbellek
    location ~* \.(js|css)$ {
        add_header Cache-Control "public, max-age=3600";
        try_files $uri =404;
    }

    # Diğer statik dosyalar
    location / {
        try_files $uri $uri/ =404;
    }

    # Geliştirme dosyalarını engelle
    location ~* \.(mjs|md|log)$ {
        deny all;
        return 404;
    }
}
```

```bash
# nginx'i etkinleştir
sudo ln -s /etc/nginx/sites-available/netonline /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL sertifikası (Let's Encrypt)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d siteadiniz.com -d www.siteadiniz.com
```

#### 4. Güncelleme

```bash
cd /var/www/netonline
git pull origin main
# nginx yeniden başlatma gerekmez (statik dosyalar)
```

---

## Firestore Koleksiyonları

```
firms/{firmId}        — Firma bilgileri
videos/{videoId}      — Video meta verisi (fileUrl, firmId, orientation...)
screens/{screenId}    — TV ekranı (lastSeen, playlistId, currentVideoTitle...)
playlists/{playlistId}— Playlist (items: [{videoId, order, durationOverride}])
```

---

## Lisans

Tüm hakları saklıdır. Bu yazılım Nethouse bünyesinde geliştirilmiştir.
