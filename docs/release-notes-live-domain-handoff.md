# Release Notes / Ops Handoff

## 1. Ozet

Talepet canli domain gecisi tamamlandi.
Web, app, admin ve API yuzeyleri ayrismis durumda ve temel canli trafik akisi hedeflenen domain yapisina alinmis durumda.

Final canli domainler:

- `https://talepet.net.tr`
- `https://app.talepet.net.tr`
- `https://admin.talepet.net.tr`
- `https://api.talepet.net.tr`

Kapsam dahilinde su basliklar tamamlandi:

- custom domain baglantilari
- SSL/TLS
- static hosting surface ayrimi
- SPA fallback ve rewrite mantigi
- backend API host ayrimi
- CORS ve socket origin uyumu
- temel canli smoke test dogrulamasi

## 2. Final canli domain mimarisi

### Web surface

- `https://talepet.net.tr`
- amac: website / landing / public pages

### App surface

- `https://app.talepet.net.tr`
- amac: kullanici uygulamasi
- backward compatible path:
  - `https://app.talepet.net.tr/app`

### Admin surface

- `https://admin.talepet.net.tr`
- amac: admin paneli
- backward compatible path:
  - `https://admin.talepet.net.tr/admin`

### API surface

- `https://api.talepet.net.tr`
- amac: backend API, auth callback, websocket endpoint

## 3. Render servisleri ve sorumluluklari

### Frontend static site

- root directory: `frontend`
- publish directory: `dist`
- sorumluluk:
  - web surface
  - app surface
  - admin surface
  - SPA artifact dagitimi

Bagli custom domainler:

- `talepet.net.tr`
- `app.talepet.net.tr`
- `admin.talepet.net.tr`

### Backend web service

- root directory: repo root
- start target: Express backend
- sorumluluk:
  - `/health`
  - `/api/*`
  - auth callback endpointleri
  - websocket / socket.io endpointleri

Bagli custom domain:

- `api.talepet.net.tr`

## 4. DNS ozeti

Turkhost tarafinda hedef mantik:

- `@`
  - frontend Render target
- `www`
  - web alias
- `app`
  - frontend Render target
- `admin`
  - frontend Render target
- `api`
  - backend Render target

Operasyon notu:

- DNS panel degisikligi bu repo icinden yonetilmez
- DNS ve SSL aktif durumda kabul edilir
- yeni kesinti durumunda once custom domain verify ve TLS durumlari kontrol edilmelidir

## 5. Rewrite / SPA fallback ozeti

Render frontend service tarafinda SPA routing icin rewrite kurallari gerekir.

Beklenen kurallar:

1. `/api/*` -> `https://api.talepet.net.tr/api/:splat`
2. `/socket.io/*` -> `https://api.talepet.net.tr/socket.io/:splat`
3. `/*` -> `/index.html`

Bu son kural olmazsa su senaryolar refresh veya deep-link sonrasi 404 verebilir:

- `https://app.talepet.net.tr/`
- `https://app.talepet.net.tr/login`
- `https://admin.talepet.net.tr/admin/rfq/expired`

Repo tarafinda ilgili referanslar:

- [render-spa-rewrites.md](/C:/Users/C1/Desktop/talepet/docs/render-spa-rewrites.md)
- [frontend/public/_redirects](/C:/Users/C1/Desktop/talepet/frontend/public/_redirects)
- [frontend/vercel.json](/C:/Users/C1/Desktop/talepet/frontend/vercel.json)

## 6. Callback / auth / payment notlari

### Google callback

- `https://api.talepet.net.tr/api/auth/google/callback`

### Apple callback

- `https://api.talepet.net.tr/api/auth/apple/callback`

### iyzico return hedefi

- `https://app.talepet.net.tr/premium/return`

Operasyon notu:

- callback URL'ler frontend hostuna degil API hostuna bakmalidir
- odeme donusu web surface'e degil app surface'e inmelidir

## 7. Smoke test sonucu

Canli sonrasi dogrulanmasi beklenen basliklar:

- web surface acilisi
- app root acilisi
- app login route acilisi
- admin root acilisi
- admin deep-link refresh
- API health
- representative app API call
- representative admin API call
- websocket baglantisi
- auth callback geri donusu
- payment return hedefi

Detayli checklist:

- [live-smoke-test-checklist.md](/C:/Users/C1/Desktop/talepet/docs/live-smoke-test-checklist.md)

Durum:

- canli domain mimarisi aktif
- static hosting ve SPA fallback mantigi dokumante
- API health akisi korunmus
- mevcut prod davranis bozulmadan ilerlenmis

## 8. Deprecated / legacy alanlar

Kod tabaninda yalniz gecis uyumlulugu icin korunan alanlar:

- `CLIENT_ORIGIN`
- `FRONTEND_URL`
- `APP_BASE_URL`
- `MARKETING_SITE_URL`
- `MONGO_URI`

Backward compatible pathler:

- `/app`
- `/admin`

Not:

- bunlar yeni prod kaynak gercegi degildir
- birincil referans final live domain mimarisidir

## 9. Rollback ve operasyon notlari

Rollback gerekirse:

1. Son bilinen saglikli frontend env setine don
2. Son bilinen saglikli backend env setine don
3. Render rewrite kurallarini tekrar kontrol et
4. Google / Apple / iyzico callback degerlerini kontrol et
5. Web, app, admin ve API smoke testlerini yeniden calistir

Dikkat notlari:

- app/admin deep-link sorunu gorulurse ilk kontrol noktasi Render rewrite kurallaridir
- auth hatasinda ilk kontrol noktasi callback URL ve env uyumudur
- odeme donusunde yanlis surface gorulurse iyzico return hedefi ve app surface env kontrol edilmelidir
- eski test static service veya preview hostlar primary live host gibi kullanilmamalidir

## 10. Sonuc / handoff

Talepet canli domain ayrimi artik tek bir final uretim modeliyle tanimlidir:

- web: `talepet.net.tr`
- app: `app.talepet.net.tr`
- admin: `admin.talepet.net.tr`
- api: `api.talepet.net.tr`

Bu dokuman operasyon ekibi icin final handoff ozetidir.
Gelecek deploy, rollback, smoke test ve callback kontrollerinde birincil referans olarak kullanilabilir.

Ilgili destekleyici dokumanlar:

- [live-domain-architecture.md](/C:/Users/C1/Desktop/talepet/docs/live-domain-architecture.md)
- [render-deploy-checklist.md](/C:/Users/C1/Desktop/talepet/docs/render-deploy-checklist.md)
- [render-spa-rewrites.md](/C:/Users/C1/Desktop/talepet/docs/render-spa-rewrites.md)
- [live-smoke-test-checklist.md](/C:/Users/C1/Desktop/talepet/docs/live-smoke-test-checklist.md)
