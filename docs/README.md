# NetOnline Video Paneli

Web tabanlı Dijital Tabela / Akıllı Yayın Ağı sistemi. Bayi ve şube konumlarındaki TV ekranlarında video yönetimi ve oynatma işlemlerini sağlar.

**Firmalar:** Nethouse · Kıbrısonline · Broadmax · Multimax

---

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Arayüz | Vanilla JS, HTML5, TailwindCSS (CDN) |
| Kimlik Doğrulama | Firebase Auth v9 (Email/Password) |
| Veritabanı | Firebase Firestore v9 |
| Dosya Depolama | Firebase Storage v9 |

---

## Proje Yapısı

```
netonline-video-paneli/
├── index.html              — Login sayfası
├── dashboard.html          — Yönetim paneli (video CRUD)
├── player.html             — TV oynatıcı
├── css/
│   └── style.css           — Custom stiller
├── js/
│   ├── firebase-config.js  — Firebase yapılandırması ve emulator bağlantısı
│   ├── auth.js             — Login mantığı
│   ├── dashboard.js        — Dashboard: video yükleme, listeleme, silme, toggle
│   └── player.js           — TV player: kurulum, video döngüsü, blur fill
├── firebase.json           — Firebase emulator config
├── firestore.rules         — Firestore güvenlik kuralları
├── storage.rules           — Storage güvenlik kuralları
├── seed-emulator.mjs       — Emulator seed script (admin kullanıcı + firmalar)
└── docs/
    └── README.md           — Bu doküman
```

---

## Özellikler

### 1. Login (`index.html`)

- Firebase Auth e-posta/şifre doğrulaması
- Türkçe hata mesajları
- Oturum açıksa otomatik yönlendirme (dashboard'a geçiş)

---

### 2. Yönetim Paneli (`dashboard.html`)

#### Video Yükleme
- Sürükle-bırak ile MP4 yükleme
- Gerçek zamanlı ilerleme çubuğu
- Dosya adından otomatik başlık doldurma (uzantı temizlenir, tire/alt çizgi boşluğa çevrilir)
- Videodan otomatik küçük resim oluşturma (1. saniyede kare yakalanır, Storage'a yüklenir)

#### Video Meta Verisi
- Firma seçimi (Nethouse, Kıbrısonline, Broadmax, Multimax)
- Yön etiketi: **Yatay** / **Dikey** / **Ortak**
- İsteğe bağlı son geçerlilik tarihi (expiry date)

#### Video Listesi
Her video için görüntülenen bilgiler:
- Küçük resim (thumbnail)
- Video adı ve firma
- Yön rozeti
- Son geçerlilik tarihi
- Aktif/Pasif durumu (toggle)
- Silme butonu

---

### 3. TV Oynatıcı (`player.html`)

#### İlk Kurulum Ekranı
- Firma seçimi
- Ekran modu seçimi: **Yatay** / **Dikey** / **İkisi Karışık**
- Seçimler Local Storage'a kaydedilir — sayfa yenilemede kurulum atlanır

#### Oynatma Özellikleri
- Oynatma başlayınca tam ekran modu
- Ana video sesli oynatılır
- **Blur fill efekti:** arka planda bulanık (`bgVideo`) + önde net ve ortalanmış (`mainVideo`) çift katmanlı görüntü
- Video filtreleme: firma + yön + aktif durum + süresi dolmamış
- Kesintisiz çalma listesi döngüsü
- Her 5 dakikada bir otomatik yenileme
- Kurulum ekranına dönmek için sıfırlama butonu (dişli ikonu)

---

## Kurulum (Yerel Geliştirme)

### Gereksinimler

- **Node.js** 18 veya üzeri
- **Java** 21 veya üzeri (Firebase Emulator Suite için)

### Adımlar

```bash
# 1. Firebase CLI'yi global olarak kur
npm install -g firebase-tools

# 2. JAVA_HOME ortam değişkenini Java 21 kurulum dizinine ayarla
#    Örnek (Windows): set JAVA_HOME=C:\Program Files\Java\jdk-21

# 3. Firebase emulatorlarını başlat
firebase emulators:start

# 4. Yeni bir terminalde seed scriptini çalıştır
node seed-emulator.mjs

# 5. Tarayıcıda aç
# http://127.0.0.1:5000

# Giriş bilgileri:
# E-posta : admin@netonline.com
# Şifre   : admin123
```

---

## Canlı Ortama Geçiş (Production)

1. [Firebase Console](https://console.firebase.google.com) üzerinden yeni bir Firebase projesi oluştur.
2. Aşağıdaki servisleri etkinleştir:
   - **Authentication** → E-posta/Şifre yöntemi
   - **Firestore**
   - **Storage**
3. `js/firebase-config.js` dosyasını aç ve `firebaseConfig` nesnesini gerçek proje değerleriyle güncelle.
4. Aynı dosyada `USE_EMULATORS` değerini `false` olarak ayarla.
5. Projeyi deploy et:

```bash
firebase deploy
```

---

## Güvenlik Kuralları

| Dosya | Kapsam |
|-------|--------|
| `firestore.rules` | Firestore okuma/yazma yetkilendirmesi |
| `storage.rules` | Storage dosya erişim kontrolü |

Kurallarda yapılan değişiklikler `firebase deploy --only firestore:rules,storage` komutuyla ayrıca yayınlanabilir.

---

## Lisans

Tüm hakları saklıdır. Bu yazılım Nethouse bünyesinde geliştirilmiştir.
