import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendSmsOtp, checkSmsOtp } from '../src/services/twilioVerify.js';
import { normalizeTrPhoneE164 } from '../src/utils/phone.js';

const TOKEN_EXPIRES_IN = '7d';
const SIGNUP_TOKEN_EXPIRES_IN = '5m';

const normalizePhone = (value) => normalizeTrPhoneE164(value);

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
    const phone = normalizePhone(req.body?.phone);
    if (!phone) {
      return res.status(400).json({ ok: false, message: 'Telefon geçersiz.' });
    }
    await sendSmsOtp(phone);
    return res.json({ ok: true, message: 'Kod gönderildi' });
  } catch (error) {
    console.error('SMS_OTP_SEND_FAIL', {
      status: error?.status || error?.statusCode,
      code: error?.code,
      message: error?.message,
      moreInfo: error?.moreInfo
    });
    const message = String(error?.message || '');
    const lowerMessage = message.toLowerCase();
    const isTrialUnverified =
      (error?.status === 400 || error?.status === 403 || error?.statusCode === 400 || error?.statusCode === 403) &&
      (lowerMessage.includes('trial') || lowerMessage.includes('verified') || lowerMessage.includes('unverified'));
    if (isTrialUnverified) {
      return res.status(403).json({
        ok: false,
        code: 'TWILIO_TRIAL_UNVERIFIED',
        message: 'Twilio trial: sadece doğrulanmış numaralara SMS gönderilebilir.',
        detail: error?.message
      });
    }
    if (error?.code === 21408 || lowerMessage.includes('permission') || lowerMessage.includes('geo')) {
      return res.status(403).json({
        ok: false,
        code: 'TWILIO_GEO_BLOCKED',
        message: 'Bu ülkeye SMS gönderimi kapalı.',
        detail: error?.message
      });
    }
    if (error?.code === 21211 || lowerMessage.includes('invalid')) {
      return res.status(400).json({
        ok: false,
        code: 'TWILIO_INVALID_PHONE',
        message: 'Numara formatı hatalı (5XXXXXXXXX).',
        detail: error?.message
      });
    }
    const status = error?.statusCode || error?.status || 500;
    return res.status(status).json({ ok: false, message: 'Kod gönderilemedi' });
  }
};

export const verifySmsOtpController = async (req, res) => {
  try {
    const phone = normalizePhone(req.body?.phone);
    const code = String(req.body?.code || '').trim();

    if (!phone || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ ok: false, message: 'Bilgiler eksik.' });
    }

    const check = await checkSmsOtp(phone, code);
    if (check?.status !== 'approved') {
      return res.status(400).json({ ok: false, message: 'Kod hatalı' });
    }

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
