import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import PasswordReset from '../models/PasswordReset.js';
import { sendPasswordResetEmail } from '../src/services/email.js';
import { sendOtpSms } from '../src/services/sms.js';
import { normalizeTrPhoneE164 } from '../src/utils/phone.js';

const RESET_SESSION_EXPIRES_IN = '10m';
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

const getResetSecret = () =>
  (process.env.SIGNUP_TOKEN_SECRET || process.env.JWT_SECRET || '').trim();

const normalizeEmail = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

const normalizePhone = (value) => normalizeTrPhoneE164(value);

const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

const buildResetLink = ({ token, method, target }) => {
  const base = (process.env.APP_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
  const params = new URLSearchParams();
  params.set('token', token);
  params.set('method', method);
  if (method === 'email') {
    params.set('email', target);
  }
  return `${base}/reset-password?${params.toString()}`;
};

const hashToken = (token) =>
  crypto.createHash('sha256').update(String(token)).digest('hex');

const isExpired = (record) => !record?.expiresAt || record.expiresAt.getTime() < Date.now();

const passwordPolicy = (value) => {
  const text = String(value || '');
  return text.length >= 3 && /[A-Z]/.test(text) && /[0-9]/.test(text) && /[^A-Za-z0-9]/.test(text);
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
      return res.json({ ok: true, message: 'Eğer hesap varsa talimatlar gönderildi.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await PasswordReset.deleteMany({ userId: user._id });

    if (method === 'email') {
      await PasswordReset.create({
        userId: user._id,
        channel: 'email',
        target: email,
        tokenHash,
        expiresAt
      });

      const resetLink = buildResetLink({ token, method: 'email', target: email });
      await sendPasswordResetEmail({ to: email, resetLink });
    } else {
      const code = generateCode();
      const codeHash = await bcrypt.hash(code, 10);
      await PasswordReset.create({
        userId: user._id,
        channel: 'sms',
        target: phone,
        codeHash,
        expiresAt
      });

      await sendOtpSms({ phone, code });
    }

    return res.json({ ok: true, message: 'Eğer hesap varsa talimatlar gönderildi.' });
  } catch (error) {
    console.error('PASSWORD_FORGOT_FAIL', error);
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
    return res.status(500).json({ ok: false, message: 'Talimatlar gönderilemedi.' });
  }
};

export const verifyPasswordReset = async (req, res) => {
  try {
    const method = String(req.body?.method || '').trim();
    const email = normalizeEmail(req.body?.email);
    const phone = normalizePhone(req.body?.phone);
    const token = String(req.body?.token || '').trim();
    const code = String(req.body?.code || '').trim();

    const target = method === 'email' ? email : method === 'sms' ? phone : '';
    if (!target) {
      return res.status(400).json({ ok: false, message: 'Bilgiler eksik.' });
    }

    const record = await PasswordReset.findOne({ channel: method, target }).sort({ createdAt: -1 });
    if (!record) {
      return res.status(400).json({ ok: false, message: 'Talep bulunamadı.' });
    }
    if (record.usedAt) {
      return res.status(400).json({ ok: false, message: 'Kod zaten kullanıldı.' });
    }
    if (isExpired(record)) {
      await PasswordReset.deleteMany({ channel: method, target });
      return res.status(400).json({ ok: false, message: 'Kodun süresi doldu.' });
    }
    if (record.attempts >= 5) {
      await PasswordReset.deleteMany({ channel: method, target });
      return res.status(429).json({ ok: false, message: 'Çok fazla deneme.' });
    }

    if (method === 'email') {
      if (!token) {
        return res.status(400).json({ ok: false, message: 'Token zorunlu.' });
      }
      const tokenHash = hashToken(token);
      if (tokenHash !== record.tokenHash) {
        record.attempts += 1;
        await record.save();
        return res.status(400).json({ ok: false, message: 'Token geçersiz.' });
      }
    } else {
      if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({ ok: false, message: 'Kod 6 haneli olmalı.' });
      }
      const matches = await bcrypt.compare(code, record.codeHash || '');
      if (!matches) {
        record.attempts += 1;
        await record.save();
        return res.status(400).json({ ok: false, message: 'Kod hatalı.' });
      }
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
    return res.json({ ok: true, resetSessionToken });
  } catch (error) {
    console.error('PASSWORD_VERIFY_FAIL', error);
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

    return res.json({ ok: true, message: 'Şifre güncellendi' });
  } catch (error) {
    console.error('PASSWORD_RESET_FAIL', error);
    return res.status(500).json({ ok: false, message: 'Şifre güncellenemedi.' });
  }
};
