# Telepet Backend - OTP

## Environment

Set these in `.env`:

```
SMS_PROVIDER=iletimerkezi
ILETIMERKEZI_API_KEY=
ILETIMERKEZI_API_HASH=
ILETIMERKEZI_SENDER=APITEST
ILETIMERKEZI_BASE_URL=https://api.iletimerkezi.com
ILETIMERKEZI_IYS=0
```

### Credential options

- **Prod:** `ILETIMERKEZI_API_KEY + ILETIMERKEZI_API_HASH + ILETIMERKEZI_SENDER`
- Not: **TALEPET** sender onay bekliyorsa test için **APITEST** kullan.

## Local backend çalıştırma

```
cd /Users/c1/talepet/talepet
npm install
npm run dev
```

Not: `/Users/c1/talepet/backend` bu proje için eski/yanlış klasör.

## Deploy Adımları

### Frontend (Vite)
- `frontend/.env` dosyasında API adresini ayarla:
  - Local: `VITE_API_URL=http://localhost:3001/api`
  - Prod: `VITE_API_URL=https://api.talepet.net.tr/api`
- Not: Client tarafı `/api` yolunu otomatik ekler.
- Socket.io için (opsiyonel):
  - `VITE_SOCKET_URL=https://api.talepet.net.tr`
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
  -d '{"phone":"05394590853"}'
```

### OTP Send (Email/SMS) - Prod (Render)

```
curl -i --max-time 20 -X POST "https://api.talepet.net.tr/api/auth/otp/send" \
  -H "Content-Type: application/json" \
  -d '{"channel":"sms","phone":"+905XXXXXXXXX"}'
```

```
curl -i --max-time 20 -X POST "https://api.talepet.net.tr/api/auth/otp/send" \
  -H "Content-Type: application/json" \
  -d '{"channel":"email","email":"talepet0@gmail.com"}'
```

### SMS Send (Legacy Endpoint) - Prod (Render)

```
curl -i --max-time 20 -X POST "https://api.talepet.net.tr/api/auth/sms/send" \
  -H "Content-Type: application/json" \
  -d '{"phone":"05394590853"}'
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

## Bildirim (OneSignal) - Post-Launch TODO

Bu repo temel OneSignal push altyapisini içerir. Yayina cikis sonrasi yapilacaklar:

1. Gelişmiş bildirim tercih ekranı (kullanıcı segmentleri + detaylı kategoriler)
2. Segment/journey bazlı kampanya gonderimi
3. In-app messaging ve template yönetimi
4. Gelişmiş analytics (open/click oranı) ve dashboard
5. Identity verification sertleştirmeleri
6. Detaylı deep link senaryoları
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
