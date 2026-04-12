# Render Deploy Checklist

## Final live architecture

- `https://talepet.net.tr`
  - web / landing surface
- `https://www.talepet.net.tr`
  - optional alias to web / landing surface
- `https://app.talepet.net.tr`
  - user app surface
- `https://admin.talepet.net.tr`
  - admin surface
- `https://api.talepet.net.tr`
  - backend API host

## Render service mapping

### Backend service

- Service type: Web Service
- Root directory: repo root
- Build command: `npm install`
- Start command: `npm start`
- Custom domain:
  - `api.talepet.net.tr`

### Frontend service

- Service type: Static Site
- Root directory: `frontend`
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Custom domains:
  - `talepet.net.tr`
  - `app.talepet.net.tr`
  - `admin.talepet.net.tr`

## Backend env summary

Required:

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `PORT=3001`
- `MONGODB_URI`
- `JWT_SECRET`
- `APP_SURFACE_URL=https://app.talepet.net.tr`
- `WEB_BASE_URL=https://talepet.net.tr`
- `ADMIN_BASE_URL=https://admin.talepet.net.tr`
- `API_BASE_URL=https://api.talepet.net.tr/api`

Provider callbacks:

- `GOOGLE_CALLBACK_URL=https://api.talepet.net.tr/api/auth/google/callback`
- `APPLE_CALLBACK_URL=https://api.talepet.net.tr/api/auth/apple/callback`

Payment return:

- iyzico return target should land on:
  - `https://app.talepet.net.tr/premium/return`

## Frontend env summary

Required:

- `VITE_WEB_URL=https://talepet.net.tr`
- `VITE_APP_URL=https://app.talepet.net.tr`
- `VITE_ADMIN_URL=https://admin.talepet.net.tr`
- `VITE_API_URL=https://api.talepet.net.tr/api`

Optional:

- `VITE_SOCKET_URL=https://api.talepet.net.tr`
- `VITE_ENABLE_SW=false`

## DNS summary

Expected host mapping:

- `@`
  - Render frontend target
- `www`
  - alias to frontend
- `app`
  - frontend custom domain
- `admin`
  - frontend custom domain
- `api`
  - backend custom domain

## Rewrite and fallback

See:

- [render-spa-rewrites.md](/C:/Users/C1/Desktop/talepet/docs/render-spa-rewrites.md)

Required Render rewrites:

1. `/api/*` -> `https://api.talepet.net.tr/api/:splat`
2. `/socket.io/*` -> `https://api.talepet.net.tr/socket.io/:splat`
3. `/*` -> `/index.html`

Without the last rule, app/admin deep-link refreshes will 404.

## OAuth and payment notes

- Google and Apple provider dashboards must point to the API host callbacks, not the frontend host.
- iyzico return must land on the app surface, not the web surface.
- If auth succeeds but user lands on the wrong surface, check frontend env first.

## Deprecated and legacy env

These are still read only for compatibility and should not be used as the primary prod config:

- `CLIENT_ORIGIN`
- `FRONTEND_URL`
- `APP_BASE_URL`
- `MARKETING_SITE_URL`
- `MONGO_URI`

## Old broken frontend service

If an older Render static site still exists from pre-cutover testing, keep it disabled or clearly marked as deprecated.
Do not reuse it as the live frontend origin unless its rewrite rules and custom domains fully match the final architecture.

## Rollback notes

If rollback is needed:

1. Restore the last known-good frontend env set.
2. Restore the last known-good backend env set.
3. Verify callback URLs in Google, Apple, and iyzico dashboards.
4. Confirm Render rewrites before switching traffic back.
5. Smoke test web, app, admin, and API again.
