# Telepet Backend - OTP (Twilio Verify)

## Environment

Set these in `.env`:

```
TWILIO_ACCOUNT_SID=
TWILIO_VERIFY_SERVICE_SID=
TWILIO_AUTH_TOKEN=
TWILIO_API_KEY_SID=
TWILIO_API_KEY_SECRET=
```

### Credential options

- **Dev/Test (simple):** `TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_VERIFY_SERVICE_SID`
- **Prod (recommended):** `TWILIO_ACCOUNT_SID + TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET + TWILIO_VERIFY_SERVICE_SID`

## Where to find Twilio values (Console)

- **Account SID:** Twilio Console → Account Dashboard (starts with `AC...`)
- **Auth Token:** Twilio Console → Account Dashboard → Reveal Token
- **API Key SID / Secret:** Twilio Console → Account → API keys & tokens (SID starts with `SK...`)
- **Verify Service SID:** Twilio Console → Verify → Services (SID starts with `VA...`)
- **Email OTP (SendGrid):** Twilio Console → Verify → Services → Email → set up SendGrid integration

## Twilio Verify Email (SendGrid) Setup

Twilio Verify Email requires SendGrid integration.  
In Twilio Console: Verify Service → Email → configure SendGrid integration.

## Create Twilio Verify Service (optional)

If `TWILIO_VERIFY_SERVICE_SID` is empty, create one:

```
node scripts/twilioCreateVerifyService.js
```

Copy the printed `TWILIO_VERIFY_SERVICE_SID` into `.env`.

## Run

```
npm run dev
```

## Deploy Adımları

### Frontend (Vite)
- `frontend/.env` dosyasında API adresini ayarla:
  - Local: `VITE_API_BASE_URL=http://localhost:3001`
  - Prod: `VITE_API_BASE_URL=https://api.talepet.net.tr`
- Not: Client tarafı `/api` yolunu otomatik ekler.

### Backend (Express)
- CORS allowlist:
  - `http://localhost:5173`
  - `https://app.talepet.net.tr`
  - `https://talepet.net.tr`
- Health endpoint:
  - `GET /health` → `200 OK`

## OTP Endpoints

### Start OTP

```
curl -X POST http://localhost:3001/api/auth/otp/start \
  -H "Content-Type: application/json" \
  -d '{"phone":"+905551112233"}'
```

### Verify Start (SMS/Email)

```
curl -X POST http://localhost:3001/api/auth/verify/start \
  -H "Content-Type: application/json" \
  -d '{"channel":"sms","to":"+905551112233"}'
```

```
curl -X POST http://localhost:3001/api/auth/verify/start \
  -H "Content-Type: application/json" \
  -d '{"channel":"email","to":"user@example.com"}'
```

### Check OTP

```
curl -X POST http://localhost:3001/api/auth/otp/check \
  -H "Content-Type: application/json" \
  -d '{"phone":"+905551112233","code":"123456"}'
```

### Verify Check

```
curl -X POST http://localhost:3001/api/auth/verify/check \
  -H "Content-Type: application/json" \
  -d '{"to":"+905551112233","code":"123456"}'
```

## Şifre Sıfırlama

### Şifre Sıfırlama Başlat (Email)

```
curl -X POST http://localhost:3001/api/auth/password/forgot \
  -H "Content-Type: application/json" \
  -d '{"method":"email","email":"user@example.com"}'
```

### Şifre Sıfırlama Başlat (SMS)

```
curl -X POST http://localhost:3001/api/auth/password/forgot \
  -H "Content-Type: application/json" \
  -d '{"method":"sms","phone":"+905551112233"}'
```

### Şifre Sıfırlama Doğrula (Email Token)

```
curl -X POST http://localhost:3001/api/auth/password/verify \
  -H "Content-Type: application/json" \
  -d '{"method":"email","email":"user@example.com","token":"TOKEN"}'
```

### Şifre Sıfırlama Doğrula (SMS Kod)

```
curl -X POST http://localhost:3001/api/auth/password/verify \
  -H "Content-Type: application/json" \
  -d '{"method":"sms","phone":"+905551112233","code":"123456"}'
```

### Yeni Şifreyi Kaydet

```
curl -X POST http://localhost:3001/api/auth/password/reset \
  -H "Content-Type: application/json" \
  -d '{"resetSessionToken":"RESET_SESSION","newPassword":"Test1!"}'
```
