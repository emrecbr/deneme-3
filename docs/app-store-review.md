# Talepet App Store Review Notes

## Demo hesaplar

Review icin iki hazir kullanici hesabi desteklenir. Canli veritabaninda olusturmak veya sifirlamak icin:

```bash
node scripts/createReviewerAccounts.js
```

Standart hesap:

- E-posta: `review.user@talepet.net.tr`
- Sifre: `TalepetReview2026!`

Premium demo hesap:

- E-posta: `premium.review@talepet.net.tr`
- Sifre: `TalepetPremium2026!`

## App Store Connect alanlari

- Bundle ID: `com.talepet.app`
- Uygulama adi: `Talepet`
- Production API: `https://api.talepet.net.tr/api`
- Gizlilik URL'si: `https://talepet.net.tr/gizlilik-sozlesmesi`
- Destek URL'si: `https://talepet.net.tr/iletisim`
- Iletisim URL'si: `https://talepet.net.tr/iletisim`

## Dijital hizmet notu

Talepet kullanicilar arasinda odeme araciligi yapmaz, escrow sunmaz ve komisyon toplamaz. Uygulamadaki paket/premium/one cikarilan ilan akislari yalnizca platform ici dijital gorunurluk ve uyelik hizmetleri icindir.

Premium satin alma canli App Store review oncesinde StoreKit/In-App Purchase uyumlulugu tamamlanana kadar frontend production build'de kapali tutulur:

```env
VITE_PREMIUM_PURCHASES_ENABLED=false
```
