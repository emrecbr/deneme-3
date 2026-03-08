# Telepet Backend - OTP

## Environment

Set these in `.env`:

```
SMS_PROVIDER=iletimerkezi
ILETIMERKEZI_API_KEY=
ILETIMERKEZI_API_HASH=
ILETIMERKEZI_SENDER=
ILETIMERKEZI_BASE_URL=https://api.iletimerkezi.com
ILETIMERKEZI_IYS=0
```

### Credential options

- **Prod:** `ILETIMERKEZI_API_KEY + ILETIMERKEZI_API_HASH + ILETIMERKEZI_SENDER`

## Run

```
npm run dev
```

## Deploy Adımları

### Frontend (Vite)
- `frontend/.env` dosyasında API adresini ayarla:
  - Local: `VITE_API_URL=http://localhost:3001/api`
  - Prod: `VITE_API_URL=https://api.talepet.net.tr/api`
- Not: Client tarafı `/api` yolunu otomatik ekler.
- Socket.io için (opsiyonel):
  - `VITE_SOCKET_URL=https://deneme-3-1le0.onrender.com`
- Vercel’de **Root Directory**: `frontend`

### Backend (Express)
- CORS allowlist:
  - `http://localhost:5173`
  - `https://app.talepet.net.tr`
  - `https://talepet.net.tr`
- Health endpoint:
  - `GET /health` → `200 OK`

### MongoDB (Atlas) Notları
- **Database Access** bölümünde bir kullanıcı oluşturduğundan emin ol (username/password).
- Şifre içinde özel karakter varsa URL-encode et (örn: `@` -> `%40`, `:` -> `%3A`, `/` -> `%2F`).
- Örnek URI:
  `mongodb+srv://user:encodedPass@cluster0.xxxxxx.mongodb.net/talepet?retryWrites=true&w=majority`

### Render (Backend)
- **Root Directory:** repo kökü
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- Not: Start komutu `node src/server.js` çalıştırır (package.json).

## OTP Endpoints

### OTP Send (Email/SMS) - Local

```
curl -i --max-time 20 -X POST "http://localhost:3001/api/auth/otp/send" \
  -H "Content-Type: application/json" \
  -d '{"channel":"sms","phone":"+905XXXXXXXXX"}'
```

```
curl -i --max-time 20 -X POST "http://localhost:3001/api/auth/otp/send" \
  -H "Content-Type: application/json" \
  -d '{"channel":"email","email":"talepet0@gmail.com"}'
```

### SMS Send (Legacy Endpoint) - Local

```
curl -i -X POST "http://localhost:3001/api/auth/sms/send" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+905XXXXXXXXX"}'
```

### OTP Send (Email/SMS) - Prod (Render)

```
curl -i --max-time 20 -X POST "https://deneme-3-1le0.onrender.com/api/auth/otp/send" \
  -H "Content-Type: application/json" \
  -d '{"channel":"sms","phone":"+905XXXXXXXXX"}'
```

```
curl -i --max-time 20 -X POST "https://deneme-3-1le0.onrender.com/api/auth/otp/send" \
  -H "Content-Type: application/json" \
  -d '{"channel":"email","email":"talepet0@gmail.com"}'
```

### SMS Send (Legacy Endpoint) - Prod (Render)

```
curl -i --max-time 20 -X POST "https://deneme-3-1le0.onrender.com/api/auth/sms/send" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+905XXXXXXXXX"}'
```

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
