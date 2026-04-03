# Proje Kuralları

## Changelog Zorunluluğu

`docs/CHANGELOG.md` dosyası **her kod değişikliğinde otomatik olarak güncellenmelidir** — kullanıcı hatırlatmak zorunda kalmamalıdır.

### Kural

Herhangi bir dosyayı değiştiren her PR / commit öncesinde:

1. `docs/CHANGELOG.md` dosyasını aç
2. En üste uygun sürüm başlığı ekle (mevcut en yüksek sürümün üstüne `PATCH` ya da `MINOR` artır)
3. Yapılan değişiklikleri ilgili kategoriye yaz:
   - **Eklendi** — yeni özellik
   - **Değiştirildi** — mevcut özellikte güncelleme
   - **Düzeltildi** — hata düzeltmesi
   - **Kaldırıldı** — silinen özellik
   - **Güvenlik** — güvenlik düzeltmesi
4. Aynı commit'e `docs/CHANGELOG.md` değişikliğini de dahil et
5. Commit tag'i ile sürüm numarasını eşleştir (`git tag vX.Y.Z`)

### Sürümleme (Anlamsal Sürümleme)

```
MAJOR.MINOR.PATCH
  │      │     └── Geriye uyumlu hata düzeltmeleri
  │      └──────── Geriye uyumlu yeni özellik
  └─────────────── Geriye uyumsuz kırıcı değişiklik
```

Mevcut sürüm: **v1.0.0**

### Örnek iş akışı

```
Kullanıcı: "şu hatayı düzelt"
→ Kodu düzelt
→ CHANGELOG.md'ye [1.0.1] ekle (Düzeltildi bölümüne)
→ git commit + git tag v1.0.1
```
