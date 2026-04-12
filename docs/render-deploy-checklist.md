# Talepet Render Deploy Checklist

## 1. Backend env

Render backend service içinde şu anahtarlar gerçekten kodda okunur:

### Zorunlu

- `NODE_ENV`
- `HOST`
- `PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `APP_SURFACE_URL`
- `WEB_BASE_URL`
- `ADMIN_BASE_URL`
- `API_BASE_URL`

### Özellik kullanıyorsan zorunlu

- Google OAuth:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_CALLBACK_URL`
- Apple OAuth:
  - `APPLE_CLIENT_ID`
  - `APPLE_TEAM_ID`
  - `APPLE_KEY_ID`
  - `APPLE_PRIVATE_KEY`
  - `APPLE_CALLBACK_URL`
- İyzico:
  - `IYZICO_API_KEY`
  - `IYZICO_SECRET_KEY`
  - `IYZICO_BASE_URL`
  - `IYZICO_WEBHOOK_SECRET`

### Opsiyonel

- `SIGNUP_TOKEN_SECRET`
- `OTP_TTL_MINUTES`
- `OTP_TTL_SECONDS`
- `OTP_MAX_ATTEMPTS`
- `OTP_RESEND_COOLDOWN_SECONDS`
- `SEND_OTP_TIMEOUT_MS`
- `MAIL_FROM`
- `EMAIL_FROM`
- `EMAIL_PROVIDER`
- `BREVO_SMTP_HOST`
- `BREVO_SMTP_PORT`
- `BREVO_SMTP_USER`
- `BREVO_SMTP_PASS`
- `BREVO_API_KEY`
- `SENDGRID_API_KEY`
- `EMAIL_SEND_TIMEOUT_MS`
- `SMTP_CONNECTION_TIMEOUT_MS`
- `SMTP_GREETING_TIMEOUT_MS`
- `SMTP_SOCKET_TIMEOUT_MS`
- `SMTP_TLS_REJECT_UNAUTHORIZED`
- `DRY_RUN`
- `SMS_PROVIDER`
- `ILETIMERKEZI_API_KEY`
- `ILETIMERKEZI_API_HASH`
- `ILETIMERKEZI_SENDER`
- `ILETIMERKEZI_BASE_URL`
- `ILETIMERKEZI_IYS`
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`
- `ONESIGNAL_API_URL`
- `REVERSE_GEOCODE_URL`
- `REVERSE_GEOCODE_UA`
- `ADMIN_SEED_EMAIL`
- `ADMIN_SEED_PASSWORD`

### Legacy / geçiş uyumluluğu için hâlâ okunanlar

- `CLIENT_ORIGIN`
- `FRONTEND_URL`
- `APP_BASE_URL`
- `MARKETING_SITE_URL`
- `MONGO_URI`

## 2. Frontend env

Render frontend service içinde şu anahtarlar gerçekten okunur:

### Zorunlu

- `VITE_WEB_URL`
- `VITE_APP_URL`
- `VITE_ADMIN_URL`
- `VITE_API_URL`

### Opsiyonel

- `VITE_SOCKET_URL`
- `VITE_ENABLE_SW`

## 3. Mevcut smoke test endpoint’leri

Repo’da gerçekten bulunan endpoint:

- `GET /health`

Not:
- frontend için ayrı health route yok
- backend için health endpoint [src/server.js](/Users/C1/Desktop/talepet/src/server.js) içinde tanımlı

## 4. Domain ve callback kontrolü

### Web

- `https://talepet.net.tr`

### App

- `https://app.talepet.net.tr/app`

### Admin

- `https://admin.talepet.net.tr/admin`

### API

- `https://api.talepet.net.tr/health`

### OAuth callback

- Google:
  - `https://api.talepet.net.tr/api/auth/google/callback`
- Apple:
  - `https://api.talepet.net.tr/api/auth/apple/callback`

### İyzico dönüş

- `https://app.talepet.net.tr/premium/return`

## 5. Render custom domain sırası

1. Önce backend service için `api.talepet.net.tr` ekle
2. DNS kaydını aç
3. Verify et
4. Sonra frontend service için sırayla:
   - `talepet.net.tr`
   - `app.talepet.net.tr`
   - `admin.talepet.net.tr`
5. DNS kayıtlarını aç
6. Verify et
7. TLS tamamlanmasını bekle

## 6. Türkhost DNS özeti

- `@`
  - `ALIAS/ANAME` destek varsa Render frontend hostuna
  - yoksa `A` → `216.24.57.1`
- `app`
  - `CNAME` → frontend Render hostname
- `admin`
  - `CNAME` → frontend Render hostname
- `api`
  - `CNAME` → backend Render hostname

## 7. Geçiş öncesi kontrol

- `AAAA` kayıtları kaldırılmış mı
- eski test `onrender.com` hostları temizlenmiş mi
- Google callback tam eşleşiyor mu
- Apple callback tam eşleşiyor mu
- iyzico dönüş app surface’e gidiyor mu
- frontend build başarılı mı
- backend syntax check başarılı mı
