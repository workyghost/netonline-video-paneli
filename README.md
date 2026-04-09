# NetOnline Digital Signage

**Sürüm:** v2.2.9

TV ekranlarında merkezi video yönetimi sağlayan, çok müşterili (multi-tenant) ajans modelini destekleyen web tabanlı **Digital Signage** sistemi.

---

## 1. Sistem Tanıtımı ve Mimari Genel Bakış

NetOnline Digital Signage, "Server-less Frontend" felsefesiyle tasarlanmıştır. Tamamen **statik assetler (HTML/JS/CSS)** ve **Backend-as-a-Service (BaaS)** katmanı olan **Supabase** üzerinden çalışır.

### Mimarinin Temel Taşları

- **Multi-Tenancy (Firmalar):** Sistemin merkezinde "Firmalar" yer alır. Bir ajans birden fazla firmayı, her firma da birden fazla ekranı yönetebilir.
- **İzolasyon ve Güvenlik:** PostgreSQL RLS (Row Level Security) sayesinde yönetici tüm verilere erişirken, TV ekranları (Players) yalnızca kendilerine atanmış içerikleri görür.
- **Realtime Güncelleme:** Supabase Realtime (Channels) altyapısı sayesinde panel üzerindeki değişiklikler saniyeler içinde TV ekranlarına yansır; sayfa yenilemesi gerekmez.
- **Çevrimdışı Dayanıklılık:** Player, bağlantı kesintisinde mevcut playlist'i oynatmaya devam eder; bağlantı geldiğinde otomatik senkronize olur.

---

## 2. Teknoloji Yığıtı

| Katman | Teknoloji |
|--------|-----------|
| Arayüz | Vanilla JS (ES6+), HTML5, TailwindCSS (CDN) |
| Auth | Supabase Auth (E-posta/Şifre — Admin, Anonim — Player) |
| Veritabanı | PostgreSQL via Supabase (Realtime Subscriptions) |
| Depolama | Supabase Storage (`digital-signage` bucket) |
| Hosting | Statik Web Sunucusu (Nginx, Apache — VPS) |
| Lokal Test | Node.js mock-server (Express 5 + WebSocket) |

**Framework yok.** React, Vue, build tool ya da npm paketi kullanılmaz. TailwindCSS yalnızca CDN üzerinden yüklenir.

---

## 3. Dosya Yapısı

```
netonline-video-paneli/
├── index.html              — Login sayfası
├── dashboard.html          — Admin SPA (5 sekme)
├── player.html             — TV oynatıcı
├── css/style.css           — Login ve player stilleri
├── js/
│   ├── supabase-config.js  — Ortam algılama (local/prod), çift client instance
│   ├── auth.js             — Login + oturum yönlendirme
│   ├── dashboard.js        — Dashboard SPA mantığı
│   └── player.js           — TV player (playlist/firma modu, heartbeat)
├── mock-server/            — Lokal test ortamı
│   ├── server.js           — Supabase API mock (Express 5 + WebSocket)
│   ├── test-quick.js       — Hızlı test: thumbnail, sil işlemleri
│   ├── test-flow.js        — Uçtan uca test: login → firma → video
│   └── test-player.js      — Player + realtime testi
├── sql/
│   ├── schema.sql          — PostgreSQL şema ve RLS
│   └── seed.sql            — Geliştirme başlangıç verileri
└── docs/
    ├── README.md           — Kurulum ve deployment rehberi (bu dosya)
    └── CHANGELOG.md        — Sürüm geçmişi
```

---

## 4. Lokal Geliştirme (Mock Server)

Gerçek bir Supabase sunucusuna gerek kalmadan lokal ortamda test için:

```bash
cd mock-server
node server.js
```

Tarayıcıda açın: **http://localhost:3001**

| Test Kullanıcısı | Değer |
|-----------------|-------|
| E-posta | `admin@test.com` |
| Şifre | `admin123` |

`supabase-config.js` `localhost`'u otomatik algılar ve mock server'a bağlanır. VPS'e deploy edildiğinde otomatik olarak gerçek Supabase'e geçer.

### Mock Server Özellikleri

- Auth (email/şifre + anonim)
- REST API (firms, videos, screens, playlists) — `.single()` desteği dahil
- Supabase Realtime (Phoenix array protokolü, `postgres_changes` broadcast)
- Storage upload/download (thumbnail'lar bellekte, videolar drain edilir)
- Placeholder PNG thumbnail (bellekte olmayan görseller için)

> **Not:** Mock server in-memory veritabanı kullanır. Sunucu kapatıldığında veriler sıfırlanır.

---

## 5. VPS Deployment (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/netonline-video-paneli;
    index index.html;

    # Statik dosyalar
    location / {
        try_files $uri $uri/ /index.html;
        add_header X-Frame-Options "SAMEORIGIN";
        add_header X-Content-Type-Options "nosniff";
        add_header Referrer-Policy "strict-origin-when-cross-origin";
    }

    # HTML dosyaları cache'lenmesin
    location ~* \.html$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # JS/CSS uzun süreli cache
    location ~* \.(js|css)$ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

Supabase bağlantısı `js/supabase-config.js` içindedir — hostname'e göre otomatik algılama yapar.

---

## 6. Kullanım Kılavuzu

1. **Giriş:** `index.html` üzerinden yönetici e-posta ve şifrenizle giriş yapın.
2. **Firma Yönetimi:** Ayarlar sekmesinden firma ekleyin/düzenleyin/silin.
3. **Video Yükleme:** İçerikler sekmesinden MP4 yükleyin; firma, yön ve bitiş tarihi belirleyin.
4. **Playlist Oluşturma:** Playlist'ler sekmesinden video sıralayarak playlist oluşturun.
5. **Ekran Oluşturma:** Ekranlar sekmesinden ekran ekleyin ve playlist atayın.
6. **TV Kurulumu (Normal Mod):** TV'de `player.html` açın, firma ve ekran adını seçerek kaydedin. Sonraki açılışlarda setup gerekmez.
7. **TV Kurulumu (Link Modu):** Dashboard'dan "Linki Kopyala" butonuyla `player.html?screen=ID` linkini alın. Bu link doğrudan o ekrana bağlanır; localStorage kullanmaz.
8. **Canlı Takip:** Ekranlar sayfasından TV'lerin online/offline durumunu gerçek zamanlı izleyin.

---

## 7. Veritabanı Şeması

```sql
firms        — id, name, created_at
videos       — id, title, firm_id, orientation, file_name, file_url, thumbnail_url,
               is_active, expires_at, created_at, updated_at
screens      — id, firm_id, name, location, orientation, status, last_seen,
               current_video_id, current_video_title, playlist_id, registered_at
playlists    — id, firm_id, name, items (jsonb), created_at, updated_at

-- items formatı: [{ videoId, order, durationOverride }]
```

Tam şema ve RLS politikaları: `sql/schema.sql`

---

*NetOnline Ekibi — v2.2.9*
