# Live Smoke Test Checklist

Run this after deploy, rewrite updates, or domain changes.

## Web surface

- Open `https://talepet.net.tr`
- Confirm landing page loads
- Confirm legal pages open:
  - `/hakkimizda`
  - `/gizlilik-sozlesmesi`
  - `/mesafeli-satis-sozlesmesi`
  - `/teslimat-ve-iade`
  - `/iletisim`
- Confirm landing CTA links go to `app.talepet.net.tr`

## App surface

- Open `https://app.talepet.net.tr`
- Refresh the page
- Open `https://app.talepet.net.tr/login`
- Refresh the page
- Confirm no 404 on root or login
- Confirm login/register flow opens correctly
- Confirm authenticated user lands in the app surface

## Admin surface

- Open `https://admin.talepet.net.tr`
- Confirm admin shell loads
- Open `https://admin.talepet.net.tr/admin/rfq/expired`
- Refresh the page
- Confirm no 404 on deep-link refresh
- Confirm admin API requests succeed
- Confirm websocket connection is established

## API surface

- Open `https://api.talepet.net.tr/health`
- Expect HTTP 200 / `OK`
- Verify a representative app API request
- Verify a representative admin API request

## Auth callbacks

- Start Google auth from app login
- Confirm callback returns through `https://api.talepet.net.tr/api/auth/google/callback`
- Confirm browser lands back on app surface

- If Apple auth is enabled:
  - confirm callback uses `https://api.talepet.net.tr/api/auth/apple/callback`

## Payment flow

- Start premium checkout
- Confirm return lands on `https://app.talepet.net.tr/premium/return`
- Confirm user does not fall back to the web surface after payment

## Realtime

- Open an app screen with socket usage
- Open an admin screen with socket usage
- Confirm websocket connects to `wss://api.talepet.net.tr`

## Regression guard

- Confirm `https://talepet.net.tr` still opens the web surface
- Confirm `https://app.talepet.net.tr/app` still works for backward compatibility
- Confirm `https://admin.talepet.net.tr/admin` still works for backward compatibility
