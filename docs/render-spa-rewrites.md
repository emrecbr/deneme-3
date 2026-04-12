# Render SPA Rewrites

Talepet frontend React Router ile client-side routing kullaniyor.
Bu nedenle Render Static Site tarafinda deep-link ve refresh senaryolari icin rewrite kurali zorunludur.

## Zorunlu rewrite kurallari

Render frontend service > Redirects/Rewrites alaninda su kurallar bulunmali:

1. Source: `/api/*`
   Destination: `https://api.talepet.net.tr/api/:splat`
   Action: `Rewrite`

2. Source: `/socket.io/*`
   Destination: `https://api.talepet.net.tr/socket.io/:splat`
   Action: `Rewrite`

3. Source: `/*`
   Destination: `/index.html`
   Action: `Rewrite`

## Neden gerekli

Bu son `/* -> /index.html` kuralı yoksa Render su URL'leri fiziksel dosya gibi arar ve 404 doner:

- `https://app.talepet.net.tr/`
- `https://app.talepet.net.tr/login`
- `https://app.talepet.net.tr/app`
- `https://admin.talepet.net.tr/admin/rfq/expired`

## Repo tarafinda eklenen destek

- `frontend/public/_redirects`
- `frontend/vercel.json`

Not:
- `_redirects` dosyasi build artefaktina dahil edilir
- ancak Render tarafinda garantili cozum dashboard rewrite kurallaridir
