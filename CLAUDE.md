# NetOnline Digital Signage — Proje Kuralları & Bağlam

## Proje Kimliği

TV ekranlarında merkezi video yönetimi sağlayan **Digital Signage** sistemi.
Çok müşterili ajans modeli: firmalar dashboard üzerinden dinamik olarak yönetilir.

**Mevcut sürüm:** v2.3.1 (kararlı, prodüksiyona hazır, lokal mock-server ile test edilebilir)

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
├── dashboard.html          — Admin SPA (5 sekme, sidebar)
├── player.html             — TV oynatıcı (anonim auth + ?screen= link modu)
├── css/
│   └── style.css           — Login ve player stilleri
├── js/
│   ├── supabase-config.js  — Supabase config, otomatik ortam algılama (local/prod)
│   ├── auth.js             — Login + oturum yönlendirme
│   ├── dashboard.js        — SPA mantığı (5 sayfa, realtime channel, modal)
│   └── player.js           — TV player (screenId, playlist/firm modu, heartbeat)
├── mock-server/            — Lokal test ortamı (Supabase yerine)
│   ├── server.js           — Express 5 + WebSocket mock server
│   ├── package.json        — express, ws, playwright bağımlılıkları
│   ├── test-quick.js       — Hızlı: thumbnail, video sil, firma sil testi
│   ├── test-flow.js        — Uçtan uca: login → firma → video yükleme testi
│   └── test-player.js      — Player + realtime testi
├── sql/
│   ├── schema.sql          — PostgreSQL şema ve RLS kuralları
│   └── seed.sql            — Geliştirme ilk verileri
└── docs/
    ├── README.md           — Bu dosya (kurulum, deployment, mimari)
    └── CHANGELOG.md        — Sürüm geçmişi
```

---

## Mimari — v2 (Supabase)

### Ortam Algılama (supabase-config.js)
```javascript
// localhost veya 127.0.0.1 → mock-server (port 3001) kullanılır
// Diğer tüm hostlar → VPS'teki gerçek Supabase'e bağlanır
const isLocal = window.location.hostname === 'localhost' || ...;
if (isLocal) {
  SUPABASE_URL = 'http://localhost:3001';
  const { key } = await fetch('/local-anon-key').then(r => r.json());
  SUPABASE_ANON_KEY = key;
}
```

### Supabase İkili İstemci
```javascript
// js/supabase-config.js
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const playerSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storageKey: 'netonline-player-auth',
    persistSession: true,
  }
});
// Neden: Player'a yönelik auth (anonim vb) admin session'ını etkilemesin diye.
```

### Dashboard SPA (js/dashboard.js)
- 5 sayfa: Genel Bakış, Ekranlar, İçerikler, Playlist'ler, Ayarlar
- Supabase Channels (realtime) ile anlık veri akışı — sayfa yenilemesi gerekmez
- `showPage` sayfa bazlı lifecycle hook'u — ayrılan sayfanın listener'ları temizlenir

### Player Akışı (js/player.js)
- `player.html?screen=ID` → link modu (localStorage'a yazmaz, stateless)
- `player.html` → setup ekranı → kayıt sonrası localStorage'a screenId yazar
- Playlist atanmışsa playlist modu, atanmamışsa firma modu
- Heartbeat mekanizması: 60sn aralıklarla `last_seen`, `current_video_*` günceller
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
  firm_id: uuid (fk: firms.id)
  orientation: text (kullanılmıyor — v2.3.1'den itibaren UI'dan kaldırıldı, kolon DB'de mevcut)
  file_name: text
  file_url: text
  thumbnail_url: text
  is_active: boolean
  expires_at: timestamptz
  created_at: timestamptz
  updated_at: timestamptz

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
  created_at: timestamptz
  updated_at: timestamptz
```

---

## Kod Kuralları
- Supabase işlemlerinde `error` objesi kontrol edilmelidir.
- Silme işlemleri `confirm()` dialog sonrası yapılır.
- Hata çıktıları toast üzerinden `showToast(msg, "error")` yapısıyla gösterilmelidir.
- `renderVideos()` gibi render fonksiyonları her çağrıda DOM'u baştan oluşturur (innerHTML = "").

---

## Changelog Zorunluluğu

`docs/CHANGELOG.md` **her kod değişikliğinde güncellenmelidir.**
Sürümleme: `MAJOR.MINOR.PATCH` (Anlamsal Sürümleme)
**Mevcut sürüm: v2.2.9**
