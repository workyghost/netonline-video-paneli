# NetOnline Digital Signage — Proje Kuralları & Bağlam

## Proje Kimliği

TV ekranlarında merkezi video yönetimi sağlayan **Digital Signage** sistemi.
Çok müşterili ajans modeli: firmalar dashboard üzerinden dinamik olarak yönetilir.

**Mevcut sürüm:** v2.2.7 (kararlı, prodüksiyona hazır, anonim API ile CI/CD uyumlu)

---

## Teknoloji Stack'i — Sabit, Değiştirme

| Katman | Teknoloji |
|--------|-----------|
| Arayüz | Vanilla JS, HTML5, TailwindCSS (CDN) |
| Auth | Supabase Auth (Email/Password + Anonymous) |
| Veritabanı | Supabase PostgreSQL |
| Depolama | Supabase Storage |
| Hosting | Statik Sunucu (Nginx, vb.) |

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
│   └── style.css           — Login ve player stilleri
├── js/
│   ├── supabase-config.js  — Supabase config, çift client instance (admin + player)
│   ├── auth.js             — Login + oturum yönlendirme
│   ├── dashboard.js        — SPA mantığı (5 sayfa, realtime channel update, modal)
│   └── player.js           — TV player (screenId, channel, heartbeat)
├── sql/
│   ├── schema.sql          — PostgreSQL şema ve RLS kuralları
│   └── seed.sql            — Geliştirme ilk verileri
└── docs/
    ├── README.md           — Kurulum, deployment, mimari
    └── CHANGELOG.md        — Sürüm geçmişi
```

---

## Mimari — v2 (Supabase)

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
// Neden: Playera yönelik auth (anonim vb) admin session'ını etkilemesin diye.
```

### Dashboard SPA (js/dashboard.js)
- 5 sayfa: Genel Bakış, Ekranlar, İçerikler, Playlist'ler, Ayarlar
- Supabase Channels ile realtime data streaming
- `showPage` sayfa bazlı lifecycle hook'u

### Player Akışı (js/player.js)
- `player.html` `screenId` yi URL'den (`?screen=`) veya localStorage'dan okur.
- Offline'ken ekranın oynatma yeteneğinin kesilmemesine odaklanılır.
- Heartbeat mekanizması Supabase üzerinden işletilir.

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
  orientation: text ('horizontal'|'vertical'|'both')
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
  orientation: text
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
- Silme işlemleri `confirm()` dialog sonrası
- Hata çıktıları toast üzerinden `showToast(msg, "error")` yapısıyla gösterilmelidir.

---

## Changelog Zorunluluğu

`docs/CHANGELOG.md` **her kod değişikliğinde güncellenmelidir.**
Sürümleme: `MAJOR.MINOR.PATCH` (Anlamsal Sürümleme)
**Mevcut sürüm: v2.2.7**
