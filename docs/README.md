# NetOnline Digital Signage

**Sürüm:** v2.2.2 (Sıfırıncı Gün Güvenlik Yaması)

TV ekranlarında merkezi video yönetimi sağlayan, çok müşterili (multi-tenant) ajans modelini destekleyen web tabanlı bir **Digital Signage** sistemidir.

---

## 1. Sistem Tanıtımı ve Mimari Genel Bakış

NetOnline Digital Signage, "Server-less Frontend" felsefesiyle tasarlanmıştır. Bu sistem tamamen **statik assetler (HTML/JS/CSS)** ve bir **Backend-as-a-Service (BaaS)** katmanı olan **Supabase** üzerinden çalışır.

### Mimarinin Temel Taşları:
-   **Multi-Tenancy (Firmalar):** Sistemin merkezinde "Firmalar" (Firms) yer alır. Bir ajans birden fazla firmayı, her firma da birden fazla ekranı (Screens) yönetebilir.
-   **İzolasyon ve Güvenlik:** PostgreSQL RLS (Row Level Security) sayesinde, yönetici (Admin) tüm verilere erişebilirken, TV ekranları (Players) sadece kendilerine atanmış içerikleri görebilir ve durum raporu (Heartbeat) gönderebilirler.
-   **Realtime Güncelleme:** Supabase Realtime (Channels) altyapısı sayesinde, panel üzerinden yapılan playlist değişiklikleri veya video güncellemeleri saniyeler içinde TV ekranlarına yansır; sayfa yenileme gerektirmez.
-   **Çevrimdışı Dayanıklılık (Offline Resilience):** Player mimarisi, internet kesintisinden sonra dahi mevcut playlist'i oynatmaya devam edecek ve bağlantı geldiğinde otomatik olarak senkronize olacak şekilde yapılandırılmıştır.

---

## 2. Teknoloji Yığıtı

| Katman          | Teknoloji                                                                 |
| :-------------- | :------------------------------------------------------------------------ |
| **Arayüz (Frontend)** | Vanilla Javascript (ES6+), HTML5, CSS3, TailwindCSS (CDN)                 |
| **Kimlik Doğrulama** | Supabase Auth (E-posta/Şifre - Admin, Anonim Auth - Player)              |
| **Veritabanı**      | PostgreSQL via Supabase (Realtime Subscriptions)                          |
| **Medya Depolama**  | Supabase Storage (Public bucket: `digital-signage`)                      |
| **Host/Sunucu**     | Herhangi bir Statik Web Sunucusu (Nginx, Apache, vb. VPS üzerinde)         |

---

## 3. Kurulum ve Deployment Adımları

Bu sistem, hem **Supabase Cloud** üzerinde hem de kendi **VPS** sunucunuzdaki **self-hosted Supabase** örnekleri üzerinde çalışabilir.

### 1. Adım: Veritabanı ve Şema Kurulumu
1.  Supabase arayüzündeki (Cloud veya Self-hosted) **SQL Editor** bölümüne gidin.
2.  Proje kök dizinindeki `sql/schema.sql` dosyasının içeriğini kopyalayıp buraya yapıştırın ve çalıştırın. Bu işlem tabloları, RLS kurallarını ve realtime replikasyon ayarlarını yapacaktır.
3.  Test verileri isterseniz `sql/seed.sql` dosyasını çalıştırabilirsiniz.

### 2. Adım: Medya Depolama Ayarı
1.  Supabase panelindeki **Storage** sekmesine gidin.
2.  `digital-signage` isminde yeni bir **public** bucket oluşturun. (Bu isim `schema.sql` içerisindeki RLS kuralları ile uyumlu olmalıdır).

### 3. Adım: Uygulama Konfigürasyonu
1.  `js/supabase-config.js` dosyasını açın.
2.  Buraya Supabase instance'ınızın URL ve Anon Key değerlerini girin:
    -   *Self-hosted VPS kullanıyorsanız, buraya sunucunuzun IP/Domain adresini ve oluşturduğunuz anahtarları yazmalısınız.*

### 4. Adım: VPS Üzerine Dağıtım (Nginx)
Proje tamamen statik dosyalardan oluştuğu için dosyaları VPS üzerindeki bir dizine (örn: `/var/www/netonline`) kopyalamanız ve bir NGINX bloğu ile servis etmeniz yeterlidir.

**Örnek Nginx Bloğu:**
```nginx
server {
    listen 80;
    server_name panel.senin-domainin.com;
    root /var/www/netonline;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 4. Kullanım Rehberi

1.  **Giriş:** `index.html` üzerinden yönetici e-posta ve şifrenizle giriş yapın.
2.  **Yönetim (Dashboard):** Ekranlar, Videolar ve Playlistler sekmelerini kullanarak içeriklerinizi yönetin.
3.  **TV Kurulumu (Player):** Yeni bir TV/Ekran cihazında `player.html` dosyasını açın. Setup ekranında firmayı ve ekran adını seçip kaydedin. Ekran bir kez kayıt olduktan sonra sistem ID'sini hatırlar ve yönetici panelinden atanan içerikleri otomatik oynatmaya başlar.
4.  **Cihaz Takibi:** Dashboard'daki "Ekranlar" sayfasından TV'lerin çevrimiçi/çevrimdışı (online/offline) durumlarını gerçek zamanlı takip edebilirsiniz.

---

*Geliştiren: NetOnline Ekibi — v2.2.2*
