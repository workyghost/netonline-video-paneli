# NetOnline Digital Signage

**Sürüm:** v2.2.0

TV ekranlarında merkezi video yönetimi sağlayan web tabanlı **Digital Signage** sistemi.
PostgreSQL veri tabanı ve Supabase Backend as a Service mimarisi üzerine kurgulanmıştır.

---

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Arayüz | Vanilla JS, HTML5, TailwindCSS (CDN) |
| Auth | Supabase Auth — Email/Password (admin) + Anonymous (TV) |
| Veritabanı | PostgreSQL via Supabase (Realtime Channels) |
| Depolama | Supabase Storage |
| Hosting | Basit Statik Sunucu / VPS (nginx) |

---

## Kurulum ve Deploy

### 1. Supabase Projesi Oluşturma
- [Supabase](https://supabase.com/)'den yeni bir proje yaratın.
- `sql/schema.sql` dosyasındaki tabloları ve RLS (Row Level Security) ayarlarını Supabase SQL Editor'de çalıştırın.
- Proje Settings > API bölümünden URL ve anon key değerlerini alın.
- Storage Settings altından `digital-signage` isminde public bir bucket oluşturun.

### 2. Uygulama Konfigürasyonu
- `js/supabase-config.js` dosyasını kendi Supabase URL ve anon key değerlerinizle güncelleyin.

### 3. Geliştirme (Local)
Dizini herhangi bir HTTP sunucu aracıyla lokalinizde ayağa kaldırabilirsiniz. Dosyalar statiktir (HTML/JS/CSS).
```bash
npx serve .
# veya
python -m http.server 8000
```
(Yerel testleriniz için başlangıç verilerini kurgulamak isterseniz `sql/seed.sql` scriptini Supabase arayüzünden veritabanınızda koşturabilirsiniz.)

### 4. Deploy (VPS / Statik HTML Sunucu vb.)
Uygulamanın çalışması için frontend'den bağımsız bir "arka plan node API sunucusu"na ihtiyaç yoktur. HTML dosyasını basitçe bir statik sunucu ile dışarı açmanız yeterlidir. Bütün database verileri, storage blob dataları ve log-in operasyonları front-end tarafındaki Supabase SDK (`supabase-js`) referansıyla client-side üzerinde çözülmektedir. Bu yüzden bir NGINX bloğu içine statik assetleri yerleştirerek hızlıca deployment alabilirsiniz.
