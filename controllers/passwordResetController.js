import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import PasswordReset from '../models/PasswordReset.js';
import { sendOtpEmail, sendPasswordResetOtpEmail } from '../src/services/email.js';
import { sendOtpSms } from '../src/services/sms.js';
import { normalizeTrPhoneE164 } from '../src/utils/phone.js';
import { logAuthEvent } from '../src/utils/authLog.js';

const RESET_SESSION_EXPIRES_IN = '10m';
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;

const getResetSecret = () =>
  (process.env.SIGNUP_TOKEN_SECRET || process.env.JWT_SECRET || '').trim();

const normalizeEmail = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

const normalizePhone = (value) => normalizeTrPhoneE164(value);

const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

const isExpired = (record) => !record?.expiresAt || record.expiresAt.getTime() < Date.now();

const passwordPolicy = (value) => {
  const text = String(value || '');
  return text.length >= 8;
};

const getOtpTtlMs = () => {
  const minutes = Number(process.env.OTP_TTL_MINUTES || 0);
  const seconds = Number(process.env.OTP_TTL_SECONDS || 0);
  if (minutes > 0) return minutes * 60 * 1000;
  if (seconds > 0) return seconds * 1000;
  return RESET_TOKEN_TTL_MS;
};

const getOtpMaxAttempts = () => {
  const val = Number(process.env.OTP_MAX_ATTEMPTS || 5);
  return Number.isFinite(val) && val > 0 ? val : 5;
};

const getCooldownSeconds = () => {
  const val = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60);
  return Number.isFinite(val) && val > 0 ? val : 60;
};

export const forgotPassword = async (req, res) => {
  try {
    const method = String(req.body?.method || '').trim();
    const email = normalizeEmail(req.body?.email);
    const phone = normalizePhone(req.body?.phone);

    const target = method === 'email' ? email : method === 'sms' ? phone : '';
    if (!target) {
      return res.status(400).json({ ok: false, message: 'Bilgiler eksik.' });
    }

    const user = method === 'email'
      ? await User.findOne({ email })
      : await User.findOne({ phoneE164: phone });

    if (!user) {
      return res.json({ ok: true, message: 'Eğer hesap varsa doğrulama kodu gönderildi.' });
    }

    const last = await PasswordReset.findOne({ channel: method, target }).sort({ lastSentAt: -1 });
    const cooldownSeconds = getCooldownSeconds();
    if (last?.lastSentAt) {
      const elapsedSeconds = (Date.now() - last.lastSentAt.getTime()) / 1000;
      if (elapsedSeconds < cooldownSeconds) {
        return res.status(429).json({
          ok: false,
          message: 'Çok sık deneme. Lütfen biraz sonra tekrar dene.'
        });
      }
    }

    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + getOtpTtlMs());

    if (method === 'email') {
      await (sendPasswordResetOtpEmail
        ? sendPasswordResetOtpEmail({ to: email, code })
        : sendOtpEmail({ to: email, code }));
      await logAuthEvent({ channel: 'email', event: 'password_reset_request', status: 'success', target: email });
    } else {
      await sendOtpSms({ phone, code });
      await logAuthEvent({ channel: 'sms', event: 'password_reset_request', status: 'success', target: phone });
    }

    await PasswordReset.deleteMany({ userId: user._id, channel: method });
    await PasswordReset.create({
      userId: user._id,
      channel: method,
      target,
      codeHash,
      expiresAt,
      lastSentAt: new Date()
    });

    return res.json({ ok: true, message: 'Eğer hesap varsa doğrulama kodu gönderildi.' });
  } catch (error) {
    console.error('PASSWORD_FORGOT_FAIL', error);
    if (String(error?.code || '').startsWith('EMAIL')) {
      console.error('OTP_EMAIL_SEND_FAIL', { message: error?.message, detail: error?.detail });
      return res.status(502).json({ ok: false, message: 'Email gönderilemedi' });
    }
    await logAuthEvent({
      channel: String(req.body?.method || '') === 'sms' ? 'sms' : 'email',
      event: 'password_reset_request',
      status: 'fail',
      target: String(req.body?.email || req.body?.phone || ''),
      errorMessage: error?.message || 'PASSWORD_FORGOT_FAIL'
    });
    if (error?.code === 'TWILIO_TRIAL_UNVERIFIED') {
      return res.status(403).json({
        ok: false,
        code: 'TWILIO_TRIAL_UNVERIFIED',
        message: 'Twilio trial: sadece doğrulanmış numaralara SMS gönderilebilir.',
        detail: error?.message
      });
    }
    if (error?.code === 'TWILIO_GEO_BLOCKED') {
      return res.status(403).json({
        ok: false,
        code: 'TWILIO_GEO_BLOCKED',
        message: 'Bu ülkeye SMS gönderimi kapalı.',
        detail: error?.message
      });
    }
    if (error?.code === 'TWILIO_INVALID_PHONE') {
      return res.status(400).json({
        ok: false,
        code: 'TWILIO_INVALID_PHONE',
        message: 'Numara formatı hatalı (5XXXXXXXXX).',
        detail: error?.message
      });
    }
    return res.status(502).json({ ok: false, message: 'Talimatlar gönderilemedi.' });
  }
};

export const verifyPasswordReset = async (req, res) => {
  try {
    const method = String(req.body?.method || '').trim();
    const email = normalizeEmail(req.body?.email);
    const phone = normalizePhone(req.body?.phone);
    const code = String(req.body?.code || '').trim();

    const target = method === 'email' ? email : method === 'sms' ? phone : '';
    if (!target) {
      return res.status(400).json({ ok: false, message: 'Bilgiler eksik.' });
    }

    const record = await PasswordReset.findOne({ channel: method, target }).sort({ createdAt: -1 });
    if (!record) {
      return res.status(400).json({ ok: false, message: 'Kod doğrulanamadı.' });
    }
    if (record.usedAt) {
      return res.status(400).json({ ok: false, message: 'Kod doğrulanamadı.' });
    }
    if (isExpired(record)) {
      await PasswordReset.deleteMany({ channel: method, target });
      return res.status(400).json({ ok: false, message: 'Kodun süresi doldu.' });
    }
    if (record.attempts >= getOtpMaxAttempts()) {
      await PasswordReset.deleteMany({ channel: method, target });
      return res.status(429).json({ ok: false, message: 'Çok fazla deneme.' });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ ok: false, message: 'Kod 6 haneli olmalı.' });
    }
    const matches = await bcrypt.compare(code, record.codeHash || '');
    if (!matches) {
      record.attempts += 1;
      await record.save();
      return res.status(400).json({ ok: false, message: 'Kod doğrulanamadı.' });
    }

    const resetSecret = getResetSecret();
    if (!resetSecret) {
      return res.status(500).json({ ok: false, message: 'Reset secret eksik.' });
    }
    const resetSessionToken = jwt.sign(
      { userId: record.userId, purpose: 'password_reset' },
      resetSecret,
      { expiresIn: RESET_SESSION_EXPIRES_IN }
    );
    await logAuthEvent({ channel: method, event: 'password_reset_verify', status: 'success', target });
    return res.json({ ok: true, resetSessionToken });
  } catch (error) {
    console.error('PASSWORD_VERIFY_FAIL', error);
    await logAuthEvent({
      channel: String(req.body?.method || '') === 'sms' ? 'sms' : 'email',
      event: 'password_reset_verify',
      status: 'fail',
      target: String(req.body?.email || req.body?.phone || ''),
      errorMessage: error?.message || 'PASSWORD_VERIFY_FAIL'
    });
    return res.status(500).json({ ok: false, message: 'Doğrulama başarısız.' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const resetSessionToken = String(req.body?.resetSessionToken || '').trim();
    const newPassword = req.body?.newPassword;
    if (!resetSessionToken || !newPassword) {
      return res.status(400).json({ ok: false, message: 'Bilgiler eksik.' });
    }
    if (!passwordPolicy(newPassword)) {
      return res.status(400).json({ ok: false, message: 'Şifre kurallarını sağlamıyor.' });
    }

    const resetSecret = getResetSecret();
    if (!resetSecret) {
      return res.status(500).json({ ok: false, message: 'Reset secret eksik.' });
    }

    let payload;
    try {
      payload = jwt.verify(resetSessionToken, resetSecret);
    } catch (error) {
      return res.status(400).json({ ok: false, message: 'Reset token geçersiz.' });
    }

    if (!payload?.userId || payload?.purpose !== 'password_reset') {
      return res.status(400).json({ ok: false, message: 'Reset token geçersiz.' });
    }

    const user = await User.findById(payload.userId).select('+password');
    if (!user) {
      return res.status(404).json({ ok: false, message: 'Kullanıcı bulunamadı.' });
    }

    user.password = newPassword;
    await user.save();

    await PasswordReset.updateMany(
      { userId: user._id, usedAt: null },
      { usedAt: new Date() }
    );
    await logAuthEvent({
      channel: user.email ? 'email' : 'sms',
      event: 'password_reset_complete',
      status: 'success',
      target: user.email || user.phoneE164
    });

    return res.json({ ok: true, message: 'Şifre güncellendi' });
  } catch (error) {
    console.error('PASSWORD_RESET_FAIL', error);
    return res.status(500).json({ ok: false, message: 'Şifre güncellenemedi.' });
  }
};
