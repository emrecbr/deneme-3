import { Router } from 'express';
import { sendOtp, verifyOtp } from '../controllers/otpController.js';

const router = Router();

const rateBuckets = new Map();

const hitRateLimit = (key, limit, windowMs) => {
  const now = Date.now();
  const bucket = rateBuckets.get(key) || [];
  const filtered = bucket.filter((ts) => now - ts < windowMs);
  filtered.push(now);
  rateBuckets.set(key, filtered);
  return filtered.length > limit;
};

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

router.post('/start', async (req, res) => {
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

    const ip = req.ip || 'unknown';
    if (hitRateLimit(`verify-start:${ip}`, 3, 60 * 1000)) {
      return res.status(429).json({ success: false, message: 'Çok fazla istek. Lütfen bekleyin.' });
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

router.post('/check', async (req, res) => {
  try {
    const to = String(req.body?.to || '').trim();
    const code = String(req.body?.code || '').trim();
    if (!to) {
      return res.status(400).json({ success: false, message: 'Hedef zorunlu.' });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, message: 'Kod 6 haneli olmalı.' });
    }

    const ip = req.ip || 'unknown';
    if (hitRateLimit(`verify-check:${ip}`, 10, 60 * 1000)) {
      return res.status(429).json({ success: false, message: 'Çok fazla deneme. Lütfen bekleyin.' });
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
