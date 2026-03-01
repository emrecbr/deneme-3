# Twilio SMS OTP Kurulum Checklist

Bu doküman Twilio trial kısıtını kaldırıp gerçek kullanıcıların SMS OTP alabilmesi için gerekli adımları içerir.

## 1) Hesap Upgrade (Zorunlu)
- Twilio trial hesaplar **sadece doğrulanmış numaralara** SMS gönderebilir.
- Production’da tüm kullanıcılara SMS göndermek için **Billing/Upgrade** zorunlu.
- Twilio Console → Billing → Upgrade.

## 2) Numara veya Messaging Service

### A) Messaging Service (Önerilen)
1. Twilio Console → Messaging → Services → **Create Messaging Service**
2. Friendly name: `Talepet OTP`
3. **Sender Pool**: Mevcut bir Twilio numarası ekle (yoksa satın al).
4. Oluşan **Messaging Service SID**’i ENV’e koy:
   - `TWILIO_MESSAGING_SERVICE_SID=MG...`

### B) Direkt Numara (Fallback)
1. Twilio Console → Phone Numbers → **Buy a Number**
2. ENV’e koy:
   - `TWILIO_FROM=+1...` (Twilio numaran)

## 3) Geo Permissions (TR için kritik)
- Twilio Console → Messaging → **Settings** → Geo Permissions
- Turkey (TR) için SMS **Enabled** olmalı.
- Eğer kapalıysa SMS gönderimi “geo blocked” hatası verir.

## 4) ENV Değerleri (Backend)
`.env` içine:

```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_VERIFY_SERVICE_SID=VA...

# Tercih: Messaging Service
TWILIO_MESSAGING_SERVICE_SID=MG...
# Fallback (Messaging Service yoksa)
TWILIO_FROM=+1...

OTP_TTL_SECONDS=120
OTP_RESEND_COOLDOWN_SECONDS=60
```

Not:
- Verify Service SID OTP doğrulama için (Twilio Verify).
- Messaging Service SID normal SMS gönderimi için.

## 5) Test Adımları
1. Server çalıştır:
   ```
   npm run dev
   ```
2. Test script:
   ```
   node scripts/testSendOtp.js +905XXXXXXXXX
   ```
3. Twilio Console → Messaging → Logs:
   - Status: `queued` → `sent` → `delivered`

## 6) Hata Kodları
- `TWILIO_TRIAL_UNVERIFIED`: Trial hesap sadece doğrulanmış numaralara SMS gönderebilir.
- `TWILIO_GEO_BLOCKED`: Geo permissions kapalı.
- `TWILIO_INVALID_PHONE`: Telefon formatı hatalı.
