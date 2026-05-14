# Render Static Frontend

Talepet frontend statik deploy'u yalnizca `frontend/` klasorunden alinmali.

## Dogru Render Static Site Ayarlari

- Root Directory: `frontend`
- Build Command: `npm ci && npm run build`
- Publish Directory: `dist`

## Yanlis Ayar Belirtileri

### 1. Root'ta build alma

Belirti:

- Render repo kokunde build calistirir
- frontend yerine backend `package.json` okunur

Sonuc:

- `npm run build` dogru Vite script'ine ulasamaz
- deploy timeout veya script hatasi gorulebilir

### 2. `Missing script: build`

Belirti:

- Loglarda `Missing script: "build"` gorunur

Neden:

- Render `frontend/` yerine repo kokunde calisiyordur
- repo kokundeki `package.json` backend'e aittir ve `build` script'i yoktur

Cozum:

- Root Directory ayarini `frontend` yap

### 3. Timeout

Belirti:

- Build lokal olarak hizli olsa da Render deploy `Süre doldu` ile fail olur

Olası nedenler:

- Yanlis build dizini
- Gereksiz buyuk build context
- Root package yerine frontend package okunmasi

Cozum:

- `Root Directory: frontend`
- `Build Command: npm ci && npm run build`
- Buyuk template/zip artefaktlarini ignore et

## Hizli Dogrulama

Lokal komut:

```powershell
cd frontend
npm run build
```

Beklenen:

- Vite build basariyla tamamlanir
- cikti `frontend/dist/` altina olusur
