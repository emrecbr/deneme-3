import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import jwt from 'jsonwebtoken';
import Otp from '../models/Otp.js';
import { sendOtpEmail } from '../src/services/email.js';
import { sendOtpSms } from '../src/services/sms.js';
import User from '../models/User.js';
import { normalizeTrPhoneE164 } from '../src/utils/phone.js';

const SIGNUP_TOKEN_EXPIRES_IN = '5m';
const getSignupSecret = () =>
  (process.env.SIGNUP_TOKEN_SECRET || process.env.JWT_SECRET || '').trim();

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const normalizePhone = (value) => normalizeTrPhoneE164(value);

const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

const resolveTarget = (channel, body) => {
  if (channel === 'email') {
    return normalizeEmail(body?.email);
  }
  if (channel === 'sms') {
    return normalizePhone(body?.phone);
  }
  return '';
};

export const sendOtp = async (req, res) => {
  try {
    const channel = String(req.body?.channel || '').trim();
    if (!['email', 'sms'].includes(channel)) {
      return res.status(400).json({ ok: false, message: 'Kanal geçersiz.' });
    }

    const target = resolveTarget(channel, req.body);
    if (!target) {
      return res.status(400).json({ ok: false, message: 'Hedef zorunlu.' });
    }

    const last = await Otp.findOne({ channel, target }).sort({ lastSentAt: -1 });
    const cooldownSeconds = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60);
    if (last?.lastSentAt && dayjs().diff(dayjs(last.lastSentAt), 'second') < cooldownSeconds) {
      return res.status(429).json({ ok: false, message: 'Lütfen 60 sn bekleyin.' });
    }

    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const ttlSeconds = Number(process.env.OTP_TTL_SECONDS || 120);
    const expiresAt = dayjs().add(ttlSeconds, 'second').toDate();
    const now = new Date();

    await Otp.deleteMany({ channel, target });
    await Otp.create({
      channel,
      target,
      codeHash,
      expiresAt,
      lastSentAt: now
    });

    if (channel === 'email') {
      await sendOtpEmail({ to: target, code });
    } else {
      await sendOtpSms({ phone: target, code });
    }

    return res.json({ ok: true, message: 'Kod gönderildi' });
  } catch (error) {
    console.error('OTP_SEND_FAIL', error);
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
    return res.status(500).json({ ok: false, message: 'Kod gönderilemedi' });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const channel = String(req.body?.channel || '').trim();
    if (!['email', 'sms'].includes(channel)) {
      return res.status(400).json({ ok: false, message: 'Kanal geçersiz.' });
    }

    const target = resolveTarget(channel, req.body);
    const code = String(req.body?.code || '').trim();

    if (!target || !code) {
      return res.status(400).json({ ok: false, message: 'Bilgiler eksik.' });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ ok: false, message: 'Kod 6 haneli olmalı.' });
    }

    const record = await Otp.findOne({ channel, target }).sort({ createdAt: -1 });
    if (!record) {
      return res.status(400).json({ ok: false, message: 'Kod bulunamadı.' });
    }
    if (record.usedAt) {
      return res.status(400).json({ ok: false, message: 'Kod zaten kullanıldı.' });
    }
    if (dayjs().isAfter(dayjs(record.expiresAt))) {
      await Otp.deleteMany({ channel, target });
      return res.status(400).json({ ok: false, message: 'Kodun süresi doldu.' });
    }
    if (record.attempts >= 5) {
      await Otp.deleteMany({ channel, target });
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

    if (channel === 'email') {
      const email = normalizeEmail(target);
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        const token = jwt.sign(
          { id: existingUser._id, role: existingUser.role },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );
        return res.json({
          ok: true,
          message: 'Doğrulandı',
          token,
          user: {
            id: existingUser._id,
            name: existingUser.name,
            email: existingUser.email,
            role: existingUser.role,
            emailVerified: Boolean(existingUser.emailVerified)
          }
        });
      }

      const signupSecret = getSignupSecret();
      if (!signupSecret) {
        return res.status(500).json({ ok: false, message: 'Signup secret eksik.' });
      }
      const signupToken = jwt.sign(
        { email, purpose: 'email_signup' },
        signupSecret,
        { expiresIn: SIGNUP_TOKEN_EXPIRES_IN }
      );
      return res.json({
        ok: true,
        message: 'E-posta kayıtlı değil. Hesap oluşturmak ister misin?',
        signup_required: true,
        email,
        signupToken
      });
    }

    return res.json({ ok: true, message: 'Doğrulandı' });
  } catch (error) {
    console.error('OTP_VERIFY_FAIL', error);
    return res.status(500).json({ ok: false, message: 'Doğrulama başarısız' });
  }
};

export const completeEmailSignup = async (req, res) => {
  try {
    const signupToken = String(req.body?.signupToken || '').trim();
    const name = String(req.body?.name || '').trim();
    const password = req.body?.password;

    if (!signupToken || !name || !password) {
      return res.status(400).json({ ok: false, message: 'Bilgiler eksik.' });
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

    if (!payload?.email || payload?.purpose !== 'email_signup') {
      return res.status(400).json({ ok: false, message: 'Signup token geçersiz.' });
    }

    const email = normalizeEmail(payload.email);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ ok: false, message: 'Bu e-posta zaten kayıtlı' });
    }

    const user = await User.create({
      name,
      email,
      password,
      emailVerified: true
    });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    return res.json({
      ok: true,
      message: 'Kayıt tamamlandı',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: Boolean(user.emailVerified)
      }
    });
  } catch (error) {
    console.error('EMAIL_SIGNUP_FAIL', error);
    return res.status(500).json({ ok: false, message: 'Kayıt tamamlanamadı' });
  }
};
