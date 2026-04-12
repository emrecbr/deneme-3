# Live Domain Architecture

## Final production domains

- `talepet.net.tr`
  - website / landing surface
- `www.talepet.net.tr`
  - optional alias of website / landing surface
- `app.talepet.net.tr`
  - user application surface
- `admin.talepet.net.tr`
  - admin panel surface
- `api.talepet.net.tr`
  - backend API and websocket host

## Surface behavior

### Web

- `https://talepet.net.tr/` loads the landing surface
- public legal pages also stay on the web surface

### App

- `https://app.talepet.net.tr/` loads the user application surface
- `https://app.talepet.net.tr/login` loads app auth flow
- legacy compatibility path kept:
  - `https://app.talepet.net.tr/app`

### Admin

- `https://admin.talepet.net.tr/` enters the admin surface
- deep links continue under `/admin/...`
- legacy compatibility path kept:
  - `https://admin.talepet.net.tr/admin`

### API

- `https://api.talepet.net.tr/health` is the live health endpoint
- frontend HTTP requests target `https://api.talepet.net.tr/api`
- websocket requests target `https://api.talepet.net.tr/socket.io`

## Callback and payment routing

- Google callback:
  - `https://api.talepet.net.tr/api/auth/google/callback`
- Apple callback:
  - `https://api.talepet.net.tr/api/auth/apple/callback`
- iyzico premium return:
  - `https://app.talepet.net.tr/premium/return`

## Legacy and deprecated areas

Still supported for compatibility:

- `/app`
- `/admin`
- legacy env keys:
  - `CLIENT_ORIGIN`
  - `FRONTEND_URL`
  - `APP_BASE_URL`
  - `MARKETING_SITE_URL`
  - `MONGO_URI`

Deprecated operational patterns:

- old preview or test `onrender.com` frontend hosts as the primary live surface
- using root-domain app behavior on `talepet.net.tr`
- relying on missing SPA rewrite rules in Render
