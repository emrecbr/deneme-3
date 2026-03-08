import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import jwt from 'jsonwebtoken';
import Otp from '../models/Otp.js';
import User from '../models/User.js';
import { sendOtpSms } from '../src/services/sms.js';
import { normalizeTrPhoneE164 } from '../src/utils/phone.js';

const TOKEN_EXPIRES_IN = '7d';
const SIGNUP_TOKEN_EXPIRES_IN = '5m';

const normalizePhone = (value) => normalizeTrPhoneE164(value);
const resolvePhone = (body) => normalizePhone(body?.phone || body?.to || body?.target);
const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));
const getOtpTtlSeconds = () => {
  const minutes = Number(process.env.OTP_TTL_MINUTES || 0);
  if (Number.isFinite(minutes) && minutes > 0) return minutes * 60;
  return Number(process.env.OTP_TTL_SECONDS || 120);
};
const getOtpMaxAttempts = () => {
  const val = Number(process.env.OTP_MAX_ATTEMPTS || 5);
  return Number.isFinite(val) ? val : 5;
};

const signToken = (user) => {
  if (!process.env.JWT_SECRET) {
    const error = new Error('JWT_SECRET tanımlı değil.');
    error.statusCode = 500;
    throw error;
  }
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_EXPIRES_IN
  });
};

const getSignupSecret = () =>
  (process.env.SIGNUP_TOKEN_SECRET || process.env.JWT_SECRET || '').trim();

const signSignupToken = (phone) => {
  const signupSecret = getSignupSecret();
  if (!signupSecret) {
    const error = new Error('JWT_SECRET tanımlı değil.');
    error.statusCode = 500;
    throw error;
  }
  return jwt.sign({ phone, purpose: 'sms_signup' }, signupSecret, {
    expiresIn: SIGNUP_TOKEN_EXPIRES_IN
  });
};

const buildUserPayload = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  phoneVerified: Boolean(user.phoneVerified)
});

export const sendSmsOtpController = async (req, res) => {
  try {
    const phone = resolvePhone(req.body);
    if (!phone) {
      return res.status(400).json({ ok: false, message: 'Telefon geçersiz.' });
    }

    const last = await Otp.findOne({ channel: 'sms', target: phone }).sort({ lastSentAt: -1 });
    const cooldownSeconds = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60);
    if (last?.lastSentAt && dayjs().diff(dayjs(last.lastSentAt), 'second') < cooldownSeconds) {
      return res.status(429).json({ ok: false, message: 'Lütfen 60 sn bekleyin.' });
    }

    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const ttlSeconds = getOtpTtlSeconds();
    const expiresAt = dayjs().add(ttlSeconds, 'second').toDate();
    const now = new Date();

    await Otp.deleteMany({ channel: 'sms', target: phone });
    await Otp.create({
      channel: 'sms',
      target: phone,
      codeHash,
      expiresAt,
      lastSentAt: now
    });

    await sendOtpSms({ phone, code });
    return res.json({ ok: true, message: 'Kod gönderildi' });
  } catch (error) {
    console.error('SMS_OTP_SEND_FAIL', {
      status: error?.status || error?.statusCode,
      code: error?.code,
      message: error?.message,
      provider: error?.provider
    });
    return res.status(502).json({ ok: false, message: 'Kod gönderilemedi' });
  }
};

export const verifySmsOtpController = async (req, res) => {
  try {
    const phone = resolvePhone(req.body);
    const code = String(req.body?.code || '').trim();

    if (!phone || !code) {
      return res.status(400).json({ ok: false, message: 'Bilgiler eksik.' });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ ok: false, message: 'Kod 6 haneli olmalı.' });
    }

    const record = await Otp.findOne({ channel: 'sms', target: phone }).sort({ createdAt: -1 });
    if (!record) {
      return res.status(400).json({ ok: false, message: 'Kod bulunamadı.' });
    }
    if (record.usedAt) {
      return res.status(400).json({ ok: false, message: 'Kod zaten kullanıldı.' });
    }
    if (dayjs().isAfter(dayjs(record.expiresAt))) {
      await Otp.deleteMany({ channel: 'sms', target: phone });
      return res.status(400).json({ ok: false, message: 'Kodun süresi doldu.' });
    }
    if (record.attempts >= getOtpMaxAttempts()) {
      await Otp.deleteMany({ channel: 'sms', target: phone });
      return res.status(429).json({ ok: false, message: 'Çok fazla deneme.' });
    }

    const matches = await bcrypt.compare(code, record.codeHash);
    if (!matches) {
      record.attempts += 1;
      await record.save();
      return res.status(400).json({ ok: false, message: 'Kod hatalı.' });
    }

    record.usedAt = new Date();
    await record.save();

    let user = await User.findOne({ phoneE164: phone });
    if (!user) {
      const signupToken = signSignupToken(phone);
      return res.status(200).json({
        ok: true,
        message: 'Numara kayıtlı değil. Hesap oluşturmak ister misin?',
        signup_required: true,
        phone,
        signupToken
      });
    }

    user.phoneVerified = true;
    await user.save();

    const token = signToken(user);
    return res.json({
      ok: true,
      message: 'Doğrulandı',
      token,
      user: buildUserPayload(user)
    });
  } catch (error) {
    console.error('SMS_OTP_VERIFY_FAIL', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ ok: false, message: 'Doğrulama başarısız' });
  }
};

export const completeSmsSignupController = async (req, res) => {
  try {
    const signupToken = String(req.body?.signupToken || '').trim();
    const name = String(req.body?.name || '').trim();
    const password = req.body?.password;
    if (!signupToken || !name) {
      return res.status(400).json({ ok: false, message: 'Bilgiler eksik.' });
    }
    if (!password) {
      return res.status(400).json({ ok: false, message: 'Şifre zorunlu.' });
    }

    const signupSecret = getSignupSecret();
    if (!signupSecret) {
      return res.status(500).json({ ok: false, message: 'Signup secret eksik.' });
    }

    let payload;
    try {
      payload = jwt.verify(signupToken, signupSecret);
    } catch (error) {
      return res.status(400).json({ ok: false, message: 'Signup token geçersiz.' });
    }

    if (payload?.purpose !== 'sms_signup' || !payload?.phone) {
      return res.status(400).json({ ok: false, message: 'Signup token geçersiz.' });
    }

    const phone = normalizePhone(payload.phone);
    if (!phone) {
      return res.status(400).json({ ok: false, message: 'Telefon geçersiz.' });
    }

    const existing = await User.findOne({ phoneE164: phone });
    if (existing) {
      const token = signToken(existing);
      return res.json({
        ok: true,
        message: 'Zaten kayıtlı.',
        token,
        user: buildUserPayload(existing)
      });
    }

    const user = await User.create({
      name,
      email: null,
      password,
      phoneE164: phone,
      phoneVerified: true
    });

    const token = signToken(user);
    return res.json({ ok: true, message: 'Kayıt tamamlandı', token, user: buildUserPayload(user) });
  } catch (error) {
    console.error('SMS_OTP_SIGNUP_FAIL', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ ok: false, message: 'Kayıt tamamlanamadı' });
  }
};
