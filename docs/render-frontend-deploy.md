# Render Frontend Deploy

Talepet frontend Vite uygulamasi `frontend/` klasoru icinde yasiyor. Render Static Site kurulumu root yerine bu klasoru hedeflemeli.

## Dogru Render Ayarlari

- Service Type: `Static Site`
- Root Directory: `frontend`
- Build Command: `npm ci && npm run build`
- Publish Directory: `dist`

## Neden Root'ta Build Alinmamali

Repo kokundeki `package.json` backend'e ait. Burada `build` script'i yok.

Yanlis ayar ornegi:

- Root Directory: bos
- Build Command: `npm run build`

Bu durumda Render su hataya dusur:

- `Missing script: "build"`

## Sik Gorulen Timeout Sebepleri

1. Render root dizinde calisiyor.
   Backend klasorunden build almaya calistigi icin dogru frontend script'ine ulasamiyor.

2. Build context gereksiz buyuk.
   `template-sources/`, `template-sources.zip` veya diger buyuk zip dosyalari Render upload suresini uzatabiliyor.

3. `npm install` yerine kilitsiz kurulum kullaniliyor.
   Frontend icinde `package-lock.json` mevcut oldugu icin `npm ci` daha deterministik ve genelde daha hizli.

## Onerilen Cozum

1. Render Static Site olustururken `Root Directory` alanina `frontend` yaz.
2. `Build Command` olarak `npm ci && npm run build` kullan.
3. `Publish Directory` olarak `dist` gir.
4. Repo kokundeki `.renderignore` dosyasinda buyuk template kaynaklarini disarida tut.

## Deploy Oncesi Hizli Kontrol

Lokal dogrulama:

```powershell
cd frontend
npm run build
```

Beklenen sonuc:

- Vite build basarili tamamlanir
- cikti `frontend/dist/` altina yazilir

## Not

Bu ayar yalniz frontend static deploy icin gecerlidir. Backend deploy'u ayri servis olarak konumlandirilmali.
