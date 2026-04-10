# NetOnline Digital Signage — Proje Kuralları & Bağlam

## Proje Kimliği

TV ekranlarında merkezi video yönetimi sağlayan **Digital Signage** sistemi.
Çok müşterili ajans modeli: firmalar dashboard üzerinden dinamik olarak yönetilir.

**Mevcut sürüm:** v3.3.0 (kararlı, prodüksiyona hazır, lokal mock-server ile test edilebilir)

---

## Teknoloji Stack'i — Sabit, Değiştirme

| Katman | Teknoloji |
|--------|-----------|
| Arayüz | Vanilla JS, HTML5, TailwindCSS (CDN) |
| Auth | Supabase Auth (Email/Password + Anonymous) |
| Veritabanı | Supabase PostgreSQL |
| Depolama | Supabase Storage |
| Hosting | Statik Sunucu (Nginx, vb.) |
| Lokal Test | Node.js mock-server (Express 5 + WebSocket) |

**Framework ekleme yok. React, Vue, build tool, npm package yok.**
Her şey plain HTML/JS dosyaları olarak kalır. TailwindCSS sadece CDN üzerinden.

---

## Dosya Yapısı

```
netonline-video-paneli/
├── index.html              — Login sayfası (email/şifre)
├── dashboard.html          — Admin SPA (5 sekme, sidebar) → js/dashboard/shared.js entry
├── player.html             — TV oynatıcı (anonim auth + ?screen= link modu)
├── css/
│   └── style.css           — Login ve player stilleri
├── js/
│   ├── supabase-config.js  — Supabase config, otomatik ortam algılama (local/prod)
│   │                         Prod: window.__SUPABASE_URL / window.__SUPABASE_ANON_KEY global'larından okur
│   ├── auth.js             — Login + oturum yönlendirme
│   ├── dashboard/          — Dashboard SPA modülleri (v2.6.0+)
│   │   ├── shared.js       — Giriş noktası: auth, routing, state, yardımcılar (showToast, openModal, esc…)
│   │   ├── overview.js     — Genel Bakış sayfası
│   │   ├── screens.js      — Ekranlar sayfası + add/edit screen modal'ları
│   │   ├── contents.js     — İçerikler sayfası (upload, bulk delete, thumbnail)
│   │   ├── playlists.js    — Playlist'ler sayfası + playlist modal (durationOverride destekli)
│   │   └── settings.js     — Ayarlar sayfası (firma yönetimi, şifre değiştirme)
│   └── player.js           — TV player (screenId, playlist/firm modu, heartbeat)
├── mock-server/            — Lokal test ortamı (Supabase yerine)
│   ├── server.js           — Express 5 + WebSocket mock server
│   ├── package.json        — express, ws, playwright bağımlılıkları
│   ├── test-quick.js       — Hızlı: thumbnail, video sil, firma sil testi
│   ├── test-flow.js        — Uçtan uca: login → firma → video yükleme testi
│   └── test-player.js      — Player + realtime testi
├── sql/                    — Git'e alınır (tracked). Migration dosyaları burada.
│   └── migration-v2.9.sql  — Supabase SQL Editor'e yapıştırılarak çalıştırılır (idempotent)
├── deploy.sh               — VPS deploy scripti (credentials inject eder)
└── docs/
    ├── README.md           — Bu dosya (kurulum, deployment, mimari)
    └── CHANGELOG.md        — Sürüm geçmişi
```

---

## Mimari — v2 (Supabase)

### Ortam Algılama (supabase-config.js)
```javascript
// localhost veya 127.0.0.1 → mock-server (port 3001) kullanılır
// Diğer tüm hostlar → HTML'deki window global'lardan okur (deploy pipeline doldurur)
const isLocal = window.location.hostname === 'localhost' || ...;
if (isLocal) {
  SUPABASE_URL = 'http://localhost:3001';
  const { key } = await fetch('/local-anon-key').then(r => r.json());
  SUPABASE_ANON_KEY = key;
} else {
  SUPABASE_URL      = window.__SUPABASE_URL;
  SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY;
}
// HTML dosyalarına ekli <script> bloğu deploy sırasında doldurulur:
// window.__SUPABASE_URL = '...'; window.__SUPABASE_ANON_KEY = '...';
```

### Supabase İkili İstemci
```javascript
// js/supabase-config.js
export { SUPABASE_URL, SUPABASE_ANON_KEY };
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const playerSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storageKey: 'netonline-player-auth', persistSession: true }
});
// Neden: Player'a yönelik auth (anonim vb) admin session'ını etkilemesin diye.
```

### Dashboard SPA (js/dashboard/)
- Giriş noktası: `dashboard.html` → `<script type="module" src="js/dashboard/shared.js">`
- `shared.js` state ve yardımcıları export eder; page modülleri circular-safe import ile bağlanır
- 5 sayfa modülü: `overview.js`, `screens.js`, `contents.js`, `playlists.js`, `settings.js`
- Modal pattern: `openModal(renderFn)` — renderFn, modal-box DOM elementini alır, innerHTML'i set eder,
  tüm event listener'ları `addEventListener` ile bağlar (inline onclick kullanılmaz)
- `modalState.isUploading` paylaşılan nesne üzerinden contents.js ↔ shared.js arasında koordine edilir
- `showPage` sayfa bazlı lifecycle hook'u — ayrılan sayfanın listener'ları temizlenir

### Player Akışı (js/player.js)
- `player.html?screen=ID` → link modu (localStorage'a yazmaz, stateless)
- `player.html` → setup ekranı → kayıt sonrası localStorage'a screenId yazar
- Playlist atanmışsa playlist modu, atanmamışsa firma modu
- Playlist sorgusu: tüm video ID'leri tek `.in("id", ids)` sorgusuyla çekilir (N+1 yok)
- Her playlist video objesine `_playlistItem` metadata'sı eklenir (durationOverride için)
- Görsel (JPG/PNG) gösterim süresi: `_playlistItem.durationOverride` saniye (varsayılan: 30s)
- Heartbeat mekanizması: 60sn aralıklarla `last_seen`, `current_video_*` günceller
- Offline güncelleme: `visibilitychange` (birincil) + `beforeunload + sendBeacon` (ikincil)
- Hata dayanıklılığı: 3 ardışık hata → "İçerik yüklenemiyor" + 5dk retry

---

## Lokal Test Ortamı (mock-server)

Gerçek Supabase bağlantısına gerek kalmadan geliştirme ve test için kullanılır.

### Başlatma
```bash
cd mock-server
node server.js
# → http://localhost:3001
# → Email: admin@test.com  |  Şifre: admin123
```

### Mock Server Kapsamı
| Özellik | Durum |
|---------|-------|
| Auth (email/şifre login) | ✅ |
| Anonymous auth (player) | ✅ |
| REST API (firms, videos, screens, playlists) | ✅ |
| `.single()` — tek nesne dönüşü | ✅ |
| Storage upload (görseller bellekte, videolar geçici diske) | ✅ |
| Video serve — HTTP Range request (seeking destekli) | ✅ |
| Thumbnail serve (gerçek JPEG veya placeholder PNG) | ✅ |
| Realtime WebSocket (Phoenix array protokolü) | ✅ |
| `postgres_changes` broadcast + subscription ID eşleşmesi | ✅ |

### Önemli Davranışlar
- **In-memory DB**: Sunucu kapatıldığında tüm veriler sıfırlanır
- **Video dosyaları** geçici diske kaydedilir (`%TEMP%/netonline-mock-storage`), sunucu yeniden başlatmada silinir
- **Görsel dosyaları** bellekte saklanır, player tarafından serve edilebilir
- **Sunucu yeniden başlatmak için** (Windows):
  ```bash
  powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 3001 -State Listen).OwningProcess -Force"
  node server.js
  ```

---

## Veritabanı Şeması (PostgreSQL)

```sql
firms
  id: uuid
  name: text
  created_at: timestamptz

videos
  id: uuid
  title: text
  firm_id: uuid (fk: firms.id, ON DELETE SET NULL — nullable)
  orientation: text (kullanılmıyor — v2.3.1'den itibaren UI'dan kaldırıldı, kolon DB'de mevcut)
  file_name: text
  file_url: text
  thumbnail_url: text
  is_active: boolean
  starts_at:  timestamptz (nullable — yayın başlangıç zamanı; null = hemen)
  expires_at: timestamptz (nullable — kalıcı bitiş tarihi; starts_at ile karıştırma)
  schedule_days:       jsonb (nullable — [1..7], 1=Pzt...7=Paz; null = her gün)
  schedule_time_start: text  (nullable — "HH:MM" formatı; null = tüm gün)
  schedule_time_end:   text  (nullable — "HH:MM" formatı; null = tüm gün)
  created_at: timestamptz
  updated_at: timestamptz

-- v2.8.0: yeni kolon ekleme migration
ALTER TABLE videos ADD COLUMN IF NOT EXISTS starts_at timestamptz;

screens
  id: uuid
  firm_id: uuid (fk: firms.id)
  name: text
  location: text
  orientation: text (kullanılmıyor — v2.3.1'den itibaren, kolon DB'de mevcut)
  status: text ('online'|'offline')
  last_seen: timestamptz
  current_video_id: uuid
  current_video_title: text
  playlist_id: uuid (fk: playlists.id)
  registered_at: timestamptz

playlists
  id: uuid
  firm_id: uuid (fk: firms.id)
  name: text
  items: jsonb -- [{ videoId, order, durationOverride }]
         durationOverride: saniye cinsinden görsel gösterim süresi (null = 30s varsayılan)
  created_at: timestamptz
  updated_at: timestamptz

play_logs  -- Proof of Play kaydı (v2.8.0+)
  id: uuid DEFAULT gen_random_uuid() PRIMARY KEY
  screen_id:       uuid (fk: screens.id ON DELETE CASCADE)
  video_id:        uuid (fk: videos.id  ON DELETE SET NULL, nullable)
  video_title:     text
  firm_id:         uuid (fk: firms.id   ON DELETE SET NULL, nullable)
  started_at:      timestamptz DEFAULT now()
  ended_at:        timestamptz (nullable — null ise oynatma henüz bitmedi)
  duration_seconds integer    (nullable)
-- RLS: authenticated okuyabilir, anon yazabilir (player)
-- Migration:
CREATE TABLE IF NOT EXISTS play_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  screen_id uuid REFERENCES screens(id) ON DELETE CASCADE,
  video_id uuid REFERENCES videos(id) ON DELETE SET NULL,
  video_title text,
  firm_id uuid REFERENCES firms(id) ON DELETE SET NULL,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer
);
```

---

## Kod Kuralları

- Tüm yeni UI metinleri **Türkçe** olmalı.
- Supabase işlemlerinde `error` objesi kontrol edilmelidir.
- Silme işlemleri `confirm()` dialog sonrası yapılır.
- Hata çıktıları toast üzerinden `showToast(msg, "error")` yapısıyla gösterilmelidir.
- `renderVideos()` gibi render fonksiyonları her çağrıda DOM'u baştan oluşturur (innerHTML = "").
- Kullanıcıdan gelen tüm veriler `esc()` fonksiyonundan geçirilerek render edilir.
- `console.log` production'da bırakılmaz; geliştirme logları `console.debug` olur.
- Modal event binding: `openModal(renderFn)` pattern — inline `onclick` kullanılmaz.
- npm paketi eklenmez (frontend). Mock server tarafı hariç.

---

## Deploy Flow (VPS)

### Credentials Sistemi
- `index.html`, `dashboard.html`, `player.html` içindeki `window.__SUPABASE_URL` ve `window.__SUPABASE_ANON_KEY` değerleri artık **placeholder**'dır (`%%SUPABASE_URL%%`, `%%SUPABASE_ANON_KEY%%`).
- Lokal geliştirmede bu değerler kullanılmaz — `supabase-config.js` localhost'u algılar ve mock-server'a yönlendirir.
- Prodüksiyon'da `deploy.sh` bu placeholder'ları gerçek değerlerle değiştirir.

### Deploy Adımları
```bash
# 1. Repoyu VPS'e çek veya kopyala
git clone <repo-url> /tmp/netonline-build
cd /tmp/netonline-build

# 2. Credentials inject et ve deploy et
SUPABASE_URL="https://..." SUPABASE_ANON_KEY="eyJ..." ./deploy.sh

# 3. Dosyaları sunucuya kopyala
scp -r ./* user@server:/var/www/netonline-video-paneli/
```

### sql/ Klasörü
- `sql/` artık `.gitignore`'da değil — migration dosyaları repoya dahildir.
- `sql/migration-v2.9.sql` → Supabase SQL Editor'e yapıştırılarak çalıştırılır (idempotent).
- Yeni tablo/kolon eklendiğinde bu dosya güncellenir.

---

## Changelog Zorunluluğu

`docs/CHANGELOG.md` **her kod değişikliğinde güncellenmelidir.**
Sürümleme: `MAJOR.MINOR.PATCH` (Anlamsal Sürümleme)
**Mevcut sürüm: v3.3.0**
