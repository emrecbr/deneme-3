import { Router } from 'express';
import { sendOtp, verifyOtp } from '../controllers/otpController.js';
import { apiRateLimit, otpSendRateLimit } from '../middleware/apiRateLimit.js';

const router = Router();

const isValidEmail = (value) => /\S+@\S+\.\S+/.test(String(value || '').trim());

const normalizeSms = (value) => {
  const raw = String(value || '').trim();
  if (!raw.startsWith('+')) {
    return '';
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 16) {
    return '';
  }
  return `+${digits}`;
};

router.post('/start', ...otpSendRateLimit, async (req, res) => {
  try {
    const channel = String(req.body?.channel || '').trim();
    const toRaw = String(req.body?.to || '').trim();
    if (!['sms', 'email'].includes(channel)) {
      return res.status(400).json({ success: false, message: 'Kanal gecersiz.' });
    }

    const to = channel === 'sms' ? normalizeSms(toRaw) : toRaw;
    if (channel === 'sms' && !to) {
      return res.status(400).json({ success: false, message: 'Telefon formatı gecersiz.' });
    }
    if (channel === 'email' && !isValidEmail(to)) {
      return res.status(400).json({ success: false, message: 'E-posta formatı gecersiz.' });
    }

    req.body = {
      ...req.body,
      channel,
      ...(channel === 'sms' ? { phone: to } : { email: to })
    };
    return sendOtp(req, res);
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'OTP gönderilemedi',
      code: error.code
    });
  }
});

router.post('/check', apiRateLimit('login'), async (req, res) => {
  try {
    const to = String(req.body?.to || '').trim();
    const code = String(req.body?.code || '').trim();
    if (!to) {
      return res.status(400).json({ success: false, message: 'Hedef zorunlu.' });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, message: 'Kod 6 haneli olmalı.' });
    }

    const inferredChannel = req.body?.channel
      ? String(req.body.channel).trim()
      : to.includes('@')
      ? 'email'
      : 'sms';

    req.body = {
      ...req.body,
      channel: inferredChannel,
      ...(inferredChannel === 'sms' ? { phone: to } : { email: to }),
      code
    };
    return verifyOtp(req, res);
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'OTP doğrulanamadı',
      code: error.code
    });
  }
});

export default router;
