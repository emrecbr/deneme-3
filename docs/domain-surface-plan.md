# Talepet Domain Surface Plan

## Hedef canlı mimari

- `https://talepet.net.tr`
  - web / landing / kurumsal yüzey
- `https://app.talepet.net.tr`
  - kullanıcı uygulama yüzeyi
- `https://admin.talepet.net.tr`
  - admin yüzeyi
- `https://api.talepet.net.tr`
  - backend API hostu

## Faz 1-3 özeti

- mevcut frontend `app surface` mantığıyla konumlandırıldı
- `/` web / landing, `/app` uygulama, `/admin` admin akışı ayrıştırıldı
- frontend ve backend tarafında surface URL/origin/callback çözümü merkezileştirildi
- auth redirect, iyzico return ve CORS tarafı gerçek domain split’e hazırlandı

## Faz 4 deploy kararı

### Önerilen strateji

Bu repo için en düşük riskli strateji:

1. **Tek frontend artifact**
   - aynı `frontend/dist` çıktısı üretilir
   - aynı artifact hem `talepet.net.tr` hem `app.talepet.net.tr` altında yayınlanır
   - route ve surface ayrımı mevcut uygulama kodu içinde çalışır
2. **Ayrı host binding**
   - web host: `talepet.net.tr`
   - app host: `app.talepet.net.tr`
   - admin host: ilk aşamada aynı frontend artifact içinden `/admin`
3. **Ayrı backend host**
   - `api.talepet.net.tr`

Bu yaklaşım şu an için ayrı monorepo / ayrı frontend build zorunluluğu getirmez.

## Env planı

### Frontend public env

- `VITE_WEB_URL=https://talepet.net.tr`
- `VITE_APP_URL=https://app.talepet.net.tr`
- `VITE_ADMIN_URL=https://admin.talepet.net.tr`
- `VITE_API_URL=https://api.talepet.net.tr/api`

### Backend env

- `WEB_BASE_URL=https://talepet.net.tr`
- `APP_SURFACE_URL=https://app.talepet.net.tr`
- `ADMIN_BASE_URL=https://admin.talepet.net.tr`
- `API_BASE_URL=https://api.talepet.net.tr/api`

### OAuth / callback env

- `GOOGLE_CALLBACK_URL=https://api.talepet.net.tr/api/auth/google/callback`
- `APPLE_CALLBACK_URL=https://api.talepet.net.tr/api/auth/apple/callback`

### Ödeme env

- iyzico callback/return zinciri app surface’e dönmelidir
- ödeme dönüş hedefi:
  - `https://app.talepet.net.tr/premium/return`

## DNS açılış planı

### Gerekli hostlar

- `talepet.net.tr`
- `app.talepet.net.tr`
- `admin.talepet.net.tr`
- `api.talepet.net.tr`

### Önerilen bağlama mantığı

- `talepet.net.tr`
  - frontend hosting
- `app.talepet.net.tr`
  - aynı frontend hosting veya aynı static artifact publish hedefi
- `admin.talepet.net.tr`
  - ilk aşamada aynı frontend hosting
- `api.talepet.net.tr`
  - backend hosting

Not:
- `admin.talepet.net.tr` ilk aşamada `/admin` route’unu açacak aynı frontend artifact’e bağlanabilir
- ayrı admin build şu aşamada gerekli değil

## Deploy runbook

1. Backend env alanlarını canlı hostlarla doldur.
2. Frontend env alanlarını canlı hostlarla doldur.
3. Backend deploy al:
   - `api.talepet.net.tr`
   - `/health` ve `/api/auth/*` cevaplarını kontrol et
4. Google ve Apple developer console redirect URL’lerini güncelle:
   - `https://api.talepet.net.tr/api/auth/google/callback`
   - `https://api.talepet.net.tr/api/auth/apple/callback`
5. iyzico panelinde dönüş / callback hedeflerini doğrula.
6. Frontend build al:
   - `npm run build`
7. Aynı frontend artifact’i web/app/admin hostlarına publish et.
8. Önce staging veya preview hostta smoke test yap.
9. DNS yönünü kademeli çevir:
   - önce `api`
   - sonra `app`
   - en son `talepet.net.tr`
10. Auth ve ödeme testleri geçmeden DNS geçişini tamamlanmış sayma.

## Smoke test listesi

### Web

- `https://talepet.net.tr` landing açılıyor mu
- public legal sayfalar açılıyor mu
- landing CTA’ları app yüzeyine gidiyor mu

### App

- `https://app.talepet.net.tr/app` açılıyor mu
- login / register akışı çalışıyor mu
- auth callback app surface’e dönüyor mu
- RFQ list/create/detail çalışıyor mu

### Admin

- `https://admin.talepet.net.tr/admin` açılıyor mu
- admin login sonrası admin panel geliyor mu

### API

- `https://api.talepet.net.tr/health` cevap veriyor mu
- CORS web/app/admin origin’lerinden geçiyor mu

### Ödeme

- checkout başlıyor mu
- iyzico dönüşü app surface’e iniyor mu
- kullanıcı yanlışlıkla web surface’e düşmüyor mu

## Rollback planı

1. Yeni env seti sorun çıkarırsa son çalışan env setine dön.
2. OAuth callback URL değişikliği auth testleri geçmeden kalıcı kabul edilmesin.
3. Önce backend rollback, sonra frontend host yönlendirmesi rollback yapılmalı.
4. DNS TTL düşük tutulursa host geri dönüşü daha hızlı yapılabilir.
5. En kritik rollback tetikleyicileri:
   - Google / Apple login fail
   - iyzico dönüşü yanlış yüzeye düşme
   - `401` / CORS artışı
   - admin login kırılması

## Riskli noktalar

- OAuth provider console ayarları env ile birebir hizalanmazsa login kırılır
- iyzico dönüş URL’si eski yüzeye kalırsa ödeme sonrası yanlış route’a düşülür
- frontend env’leri eski hostlara bakarsa CTA ve auth start yanlış origin’e çıkar
- `frontend/vercel.json` benzeri proxy/rewrite dosyaları güncellenmeden bırakılırsa eski API hostuna istek gidebilir

## Sonraki adım

- gerçek deploy hedefi seçimi
- staging smoke test checklist uygulaması
- prod DNS cutover günü için operasyon checklist’i
