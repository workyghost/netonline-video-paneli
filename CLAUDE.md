# NetOnline Digital Signage — Proje Kuralları & Bağlam

## Proje Kimliği

Bu proje, TV ekranlarında merkezi video yönetimi sağlayan bir **Digital Signage** sistemidir.
Başlangıçta tek şirket iç kullanımı için yapıldı; şu an **çok müşterili ajans modeline** evrilme sürecindedir.

Firmalar artık kodda sabit değil — dashboard üzerinden dinamik olarak eklenir/silinir (Firestore `firms` koleksiyonu).

**Mevcut sürüm:** v1.0.0 → v2.0.0'a geçiş devam ediyor

---

## Teknoloji Stack'i — Sabit, Değiştirme

| Katman | Teknoloji |
|--------|-----------|
| Arayüz | Vanilla JS, HTML5, TailwindCSS (CDN) |
| Auth | Firebase Auth v9 (Email/Password + Anonymous) |
| Veritabanı | Firebase Firestore v9 |
| Depolama | Firebase Storage v9 |
| Hosting | Firebase Hosting |

**Framework ekleme. React, Vue, build tool, npm package yok.**
Her şey plain HTML/JS dosyaları olarak kalır. TailwindCSS sadece CDN üzerinden.

---

## Mimari Geçiş: v1 → v2

### v1'de ne vardı (kırılabilir, sorun değil)
- Tek admin kullanıcı, firmalar kodda hard-coded liste
- player.html her 5 dakikada polling ile güncelleniyor
- TV yapılandırması sadece localStorage'da (firma + yön seçimi)
- Firestore okuma kuralları herkese açık (`allow read: if true`)
- Dashboard tek sayfa, tüm özellikler tek HTML dosyasında

### v2'de ne olacak
- **Dinamik firma yönetimi:** Firmalar Firestore'da yaşar, dashboard üzerinden CRUD yapılır
- **Screen/Device yönetimi:** Her TV'nin Firestore'da kendi kimliği var (`screens` koleksiyonu)
- **Realtime push:** `onSnapshot()` listener, polling yok
- **Heartbeat:** Her TV 60 saniyede bir `lastSeen` + `currentVideo` günceller
- **Playlist yönetimi:** Sıralı video listeleri (`playlists` koleksiyonu)
- **Güvenlik:** Tüm okumalar anonim auth gerektirir, yazma sadece email user
- **Modern dashboard:** Sidebar navigasyonlu SPA (JS tab switching, sayfa yenileme yok)

---

## Firestore Şeması (v2 Hedef)

```
firms/{firmId}
  name: string
  createdAt: timestamp

videos/{videoId}
  title: string
  firmId: string
  orientation: "horizontal" | "vertical" | "both"
  fileUrl: string
  thumbnailUrl: string
  isActive: boolean
  expiresAt: timestamp | null
  uploadedAt: timestamp

screens/{screenId}
  firmId: string
  name: string              // "Kadıköy Şubesi - Giriş TV"
  location: string          // "İstanbul, Kadıköy"
  orientation: "horizontal" | "vertical"
  status: "online" | "offline"
  lastSeen: timestamp
  currentVideoId: string | null
  currentVideoTitle: string | null
  playlistId: string | null
  registeredAt: timestamp

playlists/{playlistId}
  firmId: string
  name: string
  items: [{ videoId: string, order: number, durationOverride: number|null }]
  createdAt: timestamp
  updatedAt: timestamp
```

---

## Güvenlik Kuralları (v2 Hedef)

### firestore.rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /firms/{firmId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.email != null;
    }

    match /videos/{videoId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.email != null;
    }

    match /screens/{screenId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        (request.auth.token.email != null ||
         resource.data.screenId == request.resource.data.screenId);
    }

    match /playlists/{playlistId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.email != null;
    }
  }
}
```

### storage.rules
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /videos/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.email != null;
    }
    match /thumbnails/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.email != null;
    }
  }
}
```

---

## Player Mimarisi (v2)

### Açılış Akışı
```
player.html açılır
  → Firebase Anonymous Auth (signInAnonymously)
  → Auth tamamlanmadan Firestore'a istek yok
  → localStorage'da screenId var mı?
      EVET → screens/{screenId} Firestore'dan getir
               Document var mı?
                 EVET → onSnapshot listener başlat → oynat
                 HAYIR → Setup ekranına git (silinmiş olabilir)
      HAYIR → Setup ekranına git (ilk kurulum)
```

### Setup Ekranı (v2)
Firma seç (Firestore'dan dinamik liste) → Ekran adı gir → Konum gir → Yön seç → "Ekranı Kaydet"
→ Firestore'a screens document yaz
→ Oluşturulan screenId'yi localStorage'a kaydet
→ Oynatmaya geç

### Realtime Listeners
```javascript
// Ekranın kendi config'ini dinle
onSnapshot(doc(db, "screens", screenId), (snap) => {
  const screen = snap.data();
  if (screen.playlistId) {
    loadPlaylist(screen.playlistId); // Playlist modu
  } else {
    loadVideosByFirm(screen.firmId, screen.orientation); // Otomatik mod
  }
});

// Playlist değişince
onSnapshot(doc(db, "playlists", playlistId), (snap) => {
  updateQueue(snap.data().items);
});
```

### Heartbeat (60 saniyede bir)
```javascript
updateDoc(doc(db, "screens", screenId), {
  lastSeen: serverTimestamp(),
  status: "online",
  currentVideoId: currentVideo.id,
  currentVideoTitle: currentVideo.title
});

// Sayfa kapatılırken
window.addEventListener("beforeunload", () => {
  updateDoc(doc(db, "screens", screenId), { status: "offline" });
});
```

### Hata Dayanıklılığı
- Video yüklenemezse: 3 saniye bekle, sonraki videoya geç
- Tüm videolar hatalıysa: "İçerik yüklenemiyor" göster, 5 dakikada retry
- Firestore bağlantısı kesilirse: son playlist'i memory'de tut, çalmaya devam et

---

## Dashboard Mimarisi (v2)

Sidebar (220px sabit) + Ana içerik alanı (flex-1). Sayfa yenileme yok, JS tab switching.

### Sayfalar
| Sayfa | İçerik |
|-------|--------|
| Genel Bakış | 4 metrik kartı + ekran durumu listesi (realtime) |
| Ekranlar | Tablo: ekran adı, firma, konum, yön, durum, playlist, işlemler |
| İçerikler | Video CRUD — yükleme, listeleme, aktif/pasif, silme |
| Playlist'ler | Liste + oluştur/düzenle modalı |
| Ayarlar | Firma CRUD + şifre değiştirme |

### Genel Bakış Metrikleri (realtime, onSnapshot)
- Toplam Ekran sayısı
- Çevrimiçi Ekran (lastSeen < 2 dakika ise online — yeşil badge)
- Toplam Video
- Aktif Video (isActive: true)
- Her ekran satırı: ad, firma, durum badge, şu an oynayan video, son görülme zamanı

### Ayarlar → Firma Yönetimi
Firmalar Firestore'dan gelir. Admin buradan:
- Yeni firma ekler (isim → firms koleksiyonuna yaz)
- Firma adını düzenler
- Firmayı siler (o firmaya bağlı screen/video varsa önce uyar)

### Kod Kuralları (dashboard)
- Tüm Firestore işlemleri try/catch içinde, hata → toast notification
- Silme işlemleri confirm dialog sonrası yapılır
- Tüm listeler onSnapshot ile realtime dinlenir
- Loading: veri gelene kadar skeleton veya spinner göster
- Tarih/saat: `toLocaleDateString('tr-TR')` ve `toLocaleTimeString('tr-TR')`

---

## Geliştirme Ortamı

### Emülatör (localhost)
```bash
firebase emulators:start    # Emülatörleri başlat
node seed-emulator.mjs      # Test verisi yükle (admin user + örnek firmalar + ekranlar)
# http://127.0.0.1:5000
# Giriş: admin@netonline.com / admin123
```

### Environment-Aware Config (firebase-config.js)
```javascript
const USE_EMULATORS = window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';
```

### Prodüksiyon Deploy
```bash
firebase deploy
```

---

## Changelog Zorunluluğu

`docs/CHANGELOG.md` **her kod değişikliğinde otomatik olarak güncellenmelidir.**

### Kural
Her değişiklik öncesinde:
1. `docs/CHANGELOG.md` dosyasını aç
2. En üste uygun sürüm başlığı ekle
3. Değişiklikleri kategorize et:
   - **Eklendi** — yeni özellik
   - **Değiştirildi** — mevcut özellikte güncelleme
   - **Düzeltildi** — hata düzeltmesi
   - **Kaldırıldı** — silinen özellik
   - **Güvenlik** — güvenlik düzeltmesi
4. Aynı commit'e CHANGELOG değişikliğini dahil et
5. Commit tag'i ile sürüm numarasını eşleştir (`git tag vX.Y.Z`)

### Sürümleme (Anlamsal Sürümleme)
```
MAJOR.MINOR.PATCH
  │      │     └── Geriye uyumlu hata düzeltmeleri
  │      └──────── Geriye uyumlu yeni özellik
  └─────────────── Geriye uyumsuz kırıcı değişiklik
```

**Mevcut sürüm: v1.0.0**
**Hedef sürüm: v2.0.0** (ajans modeli geçişi tamamlandığında)

### Örnek
```
Kullanıcı: "şu hatayı düzelt"
→ Kodu düzelt
→ CHANGELOG.md'ye [1.0.1] ekle (Düzeltildi bölümüne)
→ git commit + git tag v1.0.1
```
