import { sendOtpSms } from '../src/services/sms.js';
import { normalizeTrPhoneE164 } from '../src/utils/phone.js';

const phoneArg = process.argv[2];
const phone = normalizeTrPhoneE164(phoneArg);
if (!phone) {
  console.error('Telefon formatı hatalı. Örn: +905XXXXXXXXX veya 5XXXXXXXXX');
  process.exit(1);
}

const code = String(Math.floor(100000 + Math.random() * 900000));

try {
  await sendOtpSms({ phone, code });
  console.log('SMS gönderildi:', phone, 'KOD:', code);
} catch (error) {
  console.error('SMS gönderilemedi:', error?.code || '', error?.message || error);
  process.exit(1);
}
