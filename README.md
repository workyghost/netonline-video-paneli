# NetOnline Digital Signage

**v3.0.0** · TV ekranlarında merkezi video yönetimi · Çok müşterili ajans modeli

---

## Genel Bakış

NetOnline Digital Signage, tamamen **statik HTML/JS/CSS** dosyaları ve **Supabase** (BaaS) üzerinde çalışan, framework gerektirmeyen bir yönetim panelidir.

- **Multi-tenant:** Tek panel üzerinden birden fazla firmayı yönetin
- **Realtime:** Playlist değişiklikleri saniyeler içinde TV'lere yansır (sayfa yenileme yok)
- **Offline dayanıklı:** Bağlantı kesilince mevcut içerik oynatılmaya devam eder
- **Güvenli:** PostgreSQL RLS — her TV yalnızca kendine ait içeriği görür

---

## Teknoloji

| Katman | Teknoloji |
|--------|-----------|
| Arayüz | Vanilla JS (ES6+), HTML5, TailwindCSS (CDN) |
| Auth | Supabase Auth — e-posta/şifre (admin), anonim (TV) |
| Veritabanı | PostgreSQL via Supabase (Realtime Subscriptions) |
| Depolama | Supabase Storage (`digital-signage` bucket) |
| Hosting | Statik sunucu (Nginx / Easypanel) |
| Lokal Test | Node.js mock-server (Express 5 + WebSocket) |

> Framework yok. React, Vue, build tool veya npm paketi kullanılmaz.

---

## Dosya Yapısı

```
netonline-video-paneli/
├── index.html                  — Login sayfası (e-posta / şifre)
├── dashboard.html              — Admin SPA (5 sekme, sidebar)
├── player.html                 — TV oynatıcı (anonim auth + ?screen= link modu)
├── css/
│   └── style.css               — Login ve player stilleri
├── js/
│   ├── supabase-config.js      — Ortam algılama (local/prod), çift client
│   ├── auth.js                 — Login + oturum yönlendirme
│   ├── dashboard/              — SPA modülleri (shared, overview, screens, contents, playlists, settings)
│   └── player.js               — TV player (playlist/firma modu, heartbeat)
├── mock-server/
│   ├── server.js               — Supabase mock (Express 5 + WebSocket)
│   ├── test-quick.js           — Hızlı test: thumbnail, silme işlemleri
│   ├── test-flow.js            — Uçtan uca: login → firma → video yükleme
│   └── test-player.js          — Player + realtime testi
├── sql/
│   └── migration-v2.9.sql      — Supabase migration (tablolar, RLS, Realtime — idempotent)
├── deploy.sh                   — VPS deploy scripti (credentials inject eder)
└── docs/
    └── CHANGELOG.md            — Sürüm geçmişi
```

---

## Kurulum — Lokal Geliştirme

Gerçek Supabase bağlantısına gerek kalmadan mock server ile test edin:

```bash
cd mock-server
node server.js
# → http://localhost:3001
```

| Alan | Değer |
|------|-------|
| E-posta | `admin@test.com` |
| Şifre | `admin123` |

`supabase-config.js` `localhost`'u otomatik algılar ve mock server'a bağlanır. VPS'e deploy edilince gerçek Supabase'e geçer.

### Mock Server Kapsamı

| Özellik | Durum |
|---------|-------|
| Auth (e-posta/şifre + anonim) | ✅ |
| REST API (firms, videos, screens, playlists) | ✅ |
| `.single()` desteği | ✅ |
| Storage upload/download (thumbnail bellekte, video diske) | ✅ |
| HTTP Range request (video seeking) | ✅ |
| Realtime WebSocket (Phoenix array protokolü) | ✅ |
| `postgres_changes` broadcast + subscription ID | ✅ |

> **Not:** In-memory veritabanı — sunucu kapatılınca veriler sıfırlanır.

### Sunucuyu Yeniden Başlatma (Windows)

```bash
powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 3001 -State Listen).OwningProcess -Force"
node server.js
```

---

## Kurulum — VPS Deployment (Nginx)

### 1. Credentials Inject (deploy.sh)

HTML dosyalarındaki placeholder değerler `deploy.sh` ile gerçek Supabase bilgileriyle doldurulur:

```bash
SUPABASE_URL="https://your-project.supabase.co" \
SUPABASE_ANON_KEY="eyJ..." \
./deploy.sh

# Ardından dosyaları VPS'e kopyalayın:
scp -r ./* user@server:/var/www/netonline-video-paneli/
```

### 2. Nginx Yapılandırması

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/netonline-video-paneli;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
        add_header X-Frame-Options "SAMEORIGIN";
        add_header X-Content-Type-Options "nosniff";
        add_header Referrer-Policy "strict-origin-when-cross-origin";
    }

    location ~* \.html$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location ~* \.(js|css)$ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

### 3. Veritabanı Kurulumu

`sql/migration-v2.9.sql` dosyasını Supabase SQL Editor'e yapıştırıp çalıştırın (idempotent — tekrar çalıştırılabilir).

---

## Kullanım

1. **Giriş:** `index.html` → yönetici e-posta/şifre ile giriş
2. **Firma Yönetimi:** Ayarlar sekmesi → firma ekle / düzenle / sil
3. **Video Yükleme:** İçerikler sekmesi → MP4 veya görsel (JPG/PNG) yükle
4. **Toplu Silme:** İçerikler sekmesi → checkbox ile seç → "Seçilenleri Sil"
5. **Sahipsiz İçerikler:** Firma filtresi → "— Sahipsiz" seçeneği ile filtrele
6. **Playlist:** Playlist'ler sekmesi → video sırala, firma seç, ekrana ata
7. **TV Kurulum (Normal):** TV'de `player.html` → firma ve ekran adı seç → kaydet
8. **TV Kurulum (Link):** Dashboard → "Linki Kopyala" → `player.html?screen=ID` TV'de aç
9. **Canlı Takip:** Ekranlar sekmesi → online/offline durumu gerçek zamanlı izle

---

## Veritabanı Şeması

```sql
firms      — id, name, created_at
videos     — id, title, firm_id (nullable), file_name, file_url, thumbnail_url,
             is_active, expires_at, created_at, updated_at
screens    — id, firm_id, name, location, status, last_seen,
             current_video_id, current_video_title, playlist_id, registered_at
playlists  — id, firm_id, name, items (jsonb), created_at, updated_at

-- items formatı: [{ videoId, order, durationOverride }]
```

Tam şema, RLS politikaları ve migration: [`sql/migration-v2.9.sql`](sql/migration-v2.9.sql)

---

## Sürüm Geçmişi

Detaylı değişiklik günlüğü: [`docs/CHANGELOG.md`](docs/CHANGELOG.md)

---

*NetOnline Ekibi · v3.0.0*
