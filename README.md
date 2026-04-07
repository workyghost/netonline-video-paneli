# NetOnline Digital Signage

**Sürüm:** v2.2.4 (Anonim API Kararlılığı ve CI/CD Geliştirmesi)

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

### Mimarisi ve Gelecek Vizyonu

Sistem, bakım maliyetlerini en aza indiren ve performansı maksimize eden modern bir **Server-less Frontend** mimarisi kullanır. Sunucu tarafında ağır backend dillerine veya framework'lere (Next.js, Node vb.) ihtiyaç duymaz. Doğrudan tarayıcı (client) üzerinden güvenli bir şekilde Supabase (PostgreSQL) veritabanına bağlanır.

### Profesyonel Güvenlik Felsefesi
Projeyi barındıran mimarimiz, tamamen bulut tabanlı bir RLS (*Row Level Security*) kalkanı ile korunmaktadır. API anahtarlarımız yalnızca ortam değişkenleri üzerinden (CI/CD hatlarında enjekte edilmek şartıyla) sistemle ilişkilendirilir ve repolar üzerinden kesinlikle ulu orta barındırılmaz. Veritabanının detaylı `SQL Şeması`, güvenlik trigger'ları ve mimari kurguları tamamen kapalı devre bir şirket IP (Intellectual Property - Fikri Mülkiyet) kuralına bağlanarak Github/Public ağlardan izole edilmiştir.

### Teknolojik Altyapı
- **UI & Stil:** Saf (Vanilla) HTML/JS ve TailwindCSS. (Framework yok, saf performans).
- **Backend & Auth:** Supabase (PostgreSQL Data, Auth Yönetimi ve RLS Kuralları).
- **Veri Barındırma:** Supabase Storage.
- **Gerçek Zamanlılık:** Supabase Realtime (WebSocket bağlantıları ile saniyesinde ekran güncellemeleri).

---

*Geliştiren: NetOnline Ekibi — v2.2.4*

1.  **Giriş:** `index.html` üzerinden yönetici e-posta ve şifrenizle giriş yapın.
2.  **Yönetim (Dashboard):** Ekranlar, Videolar ve Playlistler sekmelerini kullanarak içeriklerinizi yönetin.
3.  **TV Kurulumu (Player):** Yeni bir TV/Ekran cihazında `player.html` dosyasını açın. Setup ekranında firmayı ve ekran adını seçip kaydedin. Ekran bir kez kayıt olduktan sonra sistem ID'sini hatırlar ve yönetici panelinden atanan içerikleri otomatik oynatmaya başlar.
4.  **Cihaz Takibi:** Dashboard'daki "Ekranlar" sayfasından TV'lerin çevrimiçi/çevrimdışı (online/offline) durumlarını gerçek zamanlı takip edebilirsiniz.

*Geliştiren: NetOnline Ekibi — v2.2.4*
