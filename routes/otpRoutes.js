import { Router } from 'express';
import { getTwilioClient } from '../src/config/twilioClient.js';

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

const normalizePhone = (input) => {
  if (!input) return '';
  const raw = String(input).trim();
  if (raw.startsWith('+')) {
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 15) {
      return `+${digits}`;
    }
    return '';
  }

  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  let normalized = digits;
  if (normalized.startsWith('90')) {
    normalized = normalized.slice(2);
  }
  if (normalized.startsWith('0')) {
    normalized = normalized.slice(1);
  }
  if (normalized.length !== 10 || !normalized.startsWith('5')) {
    return '';
  }
  return `+90${normalized}`;
};

router.post('/start', async (req, res) => {
  try {
    const phoneE164 = normalizePhone(req.body?.phoneE164 || req.body?.phone || req.body?.phoneLocal || '');
    if (!phoneE164) {
      return res.status(400).json({ success: false, message: 'Telefon formatı geçersiz.' });
    }

    const ip = req.ip || 'unknown';
    const limitKey = `start:${ip}`;
    if (hitRateLimit(limitKey, 3, 60 * 1000)) {
      return res.status(429).json({ success: false, message: 'Çok fazla istek. Lütfen bekleyin.' });
    }

    const { client, serviceSid } = getTwilioClient();
    const verification = await client.verify.v2.services(serviceSid).verifications.create({
      to: phoneE164,
      channel: 'sms'
    });

    return res.status(200).json({
      status: verification?.status || 'pending',
      message: 'OTP gönderildi'
    });
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
    const phoneE164 = normalizePhone(req.body?.phoneE164 || req.body?.phone || req.body?.phoneLocal || '');
    const code = String(req.body?.code || '').trim();
    if (!phoneE164) {
      return res.status(400).json({ success: false, message: 'Telefon formatı geçersiz.' });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, message: 'Kod 6 haneli olmalı.' });
    }

    const ip = req.ip || 'unknown';
    const limitKey = `check:${ip}`;
    if (hitRateLimit(limitKey, 10, 60 * 1000)) {
      return res.status(429).json({ success: false, message: 'Çok fazla deneme. Lütfen bekleyin.' });
    }

    const { client, serviceSid } = getTwilioClient();
    const check = await client.verify.v2.services(serviceSid).verificationChecks.create({
      to: phoneE164,
      code
    });

    if (check?.status === 'approved') {
      return res.status(200).json({ verified: true });
    }

    return res.status(401).json({
      verified: false,
      message: 'Kod hatalı veya süresi dolmuş'
    });
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
