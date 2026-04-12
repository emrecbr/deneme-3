# Render SPA Rewrites

Talepet frontend uses React Router and a single static artifact for web, app, and admin surfaces.
Because of that, deep-link and refresh requests must be rewritten to `index.html`.

## Required rewrites

In the Render Static Site dashboard, add these rules in this order:

1. Source: `/api/*`
   Destination: `https://api.talepet.net.tr/api/:splat`
   Action: `Rewrite`

2. Source: `/socket.io/*`
   Destination: `https://api.talepet.net.tr/socket.io/:splat`
   Action: `Rewrite`

3. Source: `/*`
   Destination: `/index.html`
   Action: `Rewrite`

## Why this matters

Without the final `/* -> /index.html` rewrite, Render treats these as physical files and returns 404:

- `https://app.talepet.net.tr/`
- `https://app.talepet.net.tr/login`
- `https://app.talepet.net.tr/app`
- `https://admin.talepet.net.tr/admin/rfq/expired`

## Repo support already included

These files are kept in the repo for compatibility:

- [frontend/public/_redirects](/C:/Users/C1/Desktop/talepet/frontend/public/_redirects)
- [frontend/vercel.json](/C:/Users/C1/Desktop/talepet/frontend/vercel.json)

They help document the intended behavior, but the Render dashboard rewrite rule remains the authoritative control point for live traffic.

## Asset safety

The rewrite applies only after the explicit API and socket rules.
Static asset requests continue to resolve from the built `dist/assets` output normally.
