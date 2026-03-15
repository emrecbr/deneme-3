import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import Otp from '../models/Otp.js';
import { sendOtpEmail } from '../src/services/email.js';
import { sendOtpSms } from '../src/services/sms.js';
import PhoneOtp from '../models/PhoneOtp.js';
import { normalizeTrPhoneE164 } from '../src/utils/phone.js';
import { logAuthEvent } from '../src/utils/authLog.js';

const TOKEN_COOKIE_NAME = 'token';
const TOKEN_EXPIRES_IN = '7d';
const TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const signToken = (payload) => {
  if (!process.env.JWT_SECRET) {
    const error = new Error('JWT_SECRET is not defined in environment variables.');
    error.statusCode = 500;
    throw error;
  }

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: TOKEN_EXPIRES_IN
  });
};

const normalizePhone = (value) => normalizeTrPhoneE164(value);

const normalizeEmail = (value) =>
  String(value || '').trim().toLowerCase().replace(/\s+/g, '');

const generateOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

const isOtpExpired = (otpDoc) => !otpDoc || !otpDoc.expiresAt || otpDoc.expiresAt.getTime() < Date.now();
const getOtpTtlSeconds = () => {
  const minutes = Number(process.env.OTP_TTL_MINUTES || 0);
  if (Number.isFinite(minutes) && minutes > 0) return minutes * 60;
  return Number(process.env.OTP_TTL_SECONDS || 120);
};
const getOtpMaxAttempts = () => {
  const val = Number(process.env.OTP_MAX_ATTEMPTS || 5);
  return Number.isFinite(val) ? val : 5;
};

const isOauthConfigured = (provider) => {
  if (provider === 'google') {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_CALLBACK_URL
    );
  }
  if (provider === 'apple') {
    return Boolean(
      process.env.APPLE_CLIENT_ID &&
        process.env.APPLE_TEAM_ID &&
        process.env.APPLE_KEY_ID &&
        process.env.APPLE_PRIVATE_KEY &&
        process.env.APPLE_CALLBACK_URL
    );
  }
  return false;
};

const sendAuthResponse = (res, statusCode, user) => {
  const token = signToken({
    id: user._id,
    role: user.role
  });

  res.cookie(TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: TOKEN_MAX_AGE
  });

  res.status(statusCode).json({
    token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        emailVerified: Boolean(user.emailVerified),
        role: user.role,
        isPremium: Boolean(user.isPremium),
        premiumUntil: user.premiumUntil || null,
        trustScore: Number(user.trustScore || 50),
      totalCompletedDeals: Number(user.totalCompletedDeals || 0),
      positiveReviews: Number(user.positiveReviews || 0),
      negativeReviews: Number(user.negativeReviews || 0),
      isOnboardingCompleted: Boolean(user.isOnboardingCompleted),
      featuredCredits: Number(user.featuredCredits || 0)
    }
  });
};

export const register = async (req, res, next) => {
  try {
    const { name, password } = req.body;
    const email = normalizeEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email zorunludur.'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const error = new Error('Email already in use.');
      error.statusCode = 409;
      throw error;
    }

    const user = await User.create({ name, email, password, emailVerified: false });
    sendAuthResponse(res, 201, user);
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    console.log('LOGIN BODY:', req.body);
    const email = normalizeEmail(req.body?.email);
    const phoneE164 = normalizePhone(req.body?.phone || '');
    const password = req.body?.password;

    if ((!email && !phoneE164) || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email/telefon ve şifre zorunludur.'
      });
    }

    const query = email ? { email } : { phoneE164 };
    const user = await User.findOne(query).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz email veya şifre'
      });
    }

    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz email veya şifre'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz email veya şifre'
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie(TOKEN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: TOKEN_MAX_AGE
    });

    user.lastLoginAt = new Date();
    await user.save();

    if (user.role === 'admin' || user.role === 'moderator') {
      AdminAuditLog.create({
        adminId: user._id,
        role: user.role,
        action: 'admin_login',
        ip: req.headers['x-forwarded-for'] || req.ip,
        userAgent: req.headers['user-agent'] || '',
        meta: { via: 'main_login' }
      }).catch(() => null);
    }

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        email: user.email,
        emailVerified: Boolean(user.emailVerified),
        role: user.role,
        isPremium: Boolean(user.isPremium),
        premiumUntil: user.premiumUntil || null,
        trustScore: Number(user.trustScore || 50),
        totalCompletedDeals: Number(user.totalCompletedDeals || 0),
        positiveReviews: Number(user.positiveReviews || 0),
        negativeReviews: Number(user.negativeReviews || 0),
        isOnboardingCompleted: Boolean(user.isOnboardingCompleted),
        featuredCredits: Number(user.featuredCredits || 0)
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const logout = async (_req, res) => {
  res.clearCookie(TOKEN_COOKIE_NAME);
  return res.status(200).json({ success: true });
};

export const requestPhoneOtp = async (req, res) => {
  try {
    const phoneE164 = normalizePhone(req.body?.phoneE164 || req.body?.phone || '');
    if (!phoneE164) {
      return res.status(400).json({ success: false, message: 'Telefon gecersiz. 10 hane olmalı (5xx...).'});
    }

    const existing = await PhoneOtp.findOne({ phoneE164 }).sort({ createdAt: -1 });
    if (existing && !isOtpExpired(existing)) {
      const lastSentAt = existing.updatedAt || existing.createdAt;
      const secondsSince = (Date.now() - lastSentAt.getTime()) / 1000;
      const cooldownSeconds = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60);
      if (secondsSince < cooldownSeconds) {
        return res.status(429).json({ success: false, message: 'Cok fazla istek. Lütfen bekleyin.' });
      }
    }

    const code = generateOtpCode();
    const codeHash = await bcrypt.hash(code, 10);
    const ttlSeconds = getOtpTtlSeconds();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await PhoneOtp.findOneAndUpdate(
      { phoneE164 },
      { codeHash, expiresAt, attempts: 0 },
      { upsert: true, new: true }
    );

    await sendOtpSms({ phone: phoneE164, code });
    await logAuthEvent({ channel: 'sms', event: 'phone_otp_send', status: 'success', target: phoneE164 });

    if (process.env.NODE_ENV !== 'production') {
      console.log('OTP CODE (DEV):', phoneE164, code);
    }

    return res.status(200).json({ success: true, expiresIn: ttlSeconds });
  } catch (error) {
    console.error('PHONE_OTP_SEND_FAIL', {
      status: error?.status || error?.statusCode,
      code: error?.code,
      message: error?.message,
      moreInfo: error?.moreInfo
    });
    await logAuthEvent({
      channel: 'sms',
      event: 'phone_otp_send',
      status: 'failed',
      target: req.body?.phoneE164 || req.body?.phone || '',
      errorMessage: error?.message || 'PHONE_OTP_SEND_FAIL',
      provider: error?.provider
    });
    const message = String(error?.message || '');
    const lowerMessage = message.toLowerCase();
    const isTrialUnverified =
      (error?.status === 400 || error?.status === 403 || error?.statusCode === 400 || error?.statusCode === 403) &&
      (lowerMessage.includes('trial') || lowerMessage.includes('verified') || lowerMessage.includes('unverified'));
    if (isTrialUnverified) {
      return res.status(403).json({
        success: false,
        code: 'TWILIO_TRIAL_UNVERIFIED',
        message: 'Twilio trial: sadece doğrulanmış numaralara SMS gönderilebilir.',
        detail: error?.message
      });
    }
    if (error?.code === 'TWILIO_GEO_BLOCKED') {
      return res.status(403).json({
        success: false,
        code: 'TWILIO_GEO_BLOCKED',
        message: 'Bu ülkeye SMS gönderimi kapalı.',
        detail: error?.message
      });
    }
    if (error?.code === 'TWILIO_INVALID_PHONE') {
      return res.status(400).json({
        success: false,
        code: 'TWILIO_INVALID_PHONE',
        message: 'Numara formatı hatalı (5XXXXXXXXX).',
        detail: error?.message
      });
    }
    return res.status(502).json({ success: false, message: 'OTP gonderilemedi.' });
  }
};

export const verifyPhoneOtp = async (req, res) => {
  try {
    const phoneE164 = normalizePhone(req.body?.phoneE164 || req.body?.phone || '');
    const code = String(req.body?.code || '').trim();
    if (!phoneE164 || !code) {
      return res.status(400).json({ success: false, message: 'Telefon ve kod zorunlu.' });
    }

    const otpDoc = await PhoneOtp.findOne({ phoneE164 });
    if (!otpDoc || isOtpExpired(otpDoc)) {
      return res.status(401).json({ success: false, message: 'Kod gecersiz veya suresi doldu.' });
    }
    if (otpDoc.attempts >= getOtpMaxAttempts()) {
      await PhoneOtp.deleteOne({ phoneE164 });
      return res.status(429).json({ success: false, message: 'Çok fazla deneme.' });
    }

    const match = await bcrypt.compare(code, otpDoc.codeHash);
    if (!match) {
      otpDoc.attempts = Number(otpDoc.attempts || 0) + 1;
      await otpDoc.save();
      return res.status(401).json({ success: false, message: 'Kod gecersiz.' });
    }

    await PhoneOtp.deleteOne({ phoneE164 });
    await logAuthEvent({ channel: 'sms', event: 'phone_otp_verify', status: 'success', target: phoneE164 });

    let user = await User.findOne({ phoneE164 });
    if (!user) {
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const safeEmail = `${phoneE164.replace('+', '')}@phone.local`;
      user = await User.create({
        name: 'Kullanici',
        email: safeEmail,
        password: randomPassword,
        phoneE164,
        phoneVerified: true
      });
    } else {
      user.phoneVerified = true;
      await user.save();
    }

    sendAuthResponse(res, 200, user);
  } catch (error) {
    await logAuthEvent({
      channel: 'sms',
      event: 'phone_otp_verify',
      status: 'failed',
      target: req.body?.phoneE164 || req.body?.phone || '',
      errorMessage: error?.message || 'PHONE_OTP_VERIFY_FAIL'
    });
    return res.status(500).json({ success: false, message: 'OTP dogrulanamadi.' });
  }
};

const normalizeRegisterTarget = (method, body) => {
  if (method === 'email') {
    return normalizeEmail(body?.email);
  }
  if (method === 'sms') {
    return normalizePhone(body?.phone);
  }
  return '';
};

export const sendRegisterOtp = async (req, res) => {
  try {
    const method = String(req.body?.method || '').trim();
    if (!['email', 'sms'].includes(method)) {
      return res.status(400).json({ ok: false, message: 'Yöntem geçersiz.' });
    }

    const target = normalizeRegisterTarget(method, req.body);
    if (!target) {
      return res.status(400).json({
        ok: false,
        message: method === 'email' ? 'E-posta zorunlu.' : 'Telefon zorunlu.'
      });
    }

    const existingUser =
      method === 'email'
        ? await User.findOne({ email: target })
        : await User.findOne({ phoneE164: target });
    if (existingUser) {
      return res.status(400).json({
        ok: false,
        message: method === 'email' ? 'Bu e-posta zaten kayıtlı' : 'Bu telefon numarası zaten kayıtlı'
      });
    }

    const last = await Otp.findOne({ channel: method, target }).sort({ lastSentAt: -1 });
    if (last?.lastSentAt) {
      const secondsSince = (Date.now() - last.lastSentAt.getTime()) / 1000;
      const cooldownSeconds = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60);
      if (secondsSince < cooldownSeconds) {
        return res.status(429).json({ ok: false, message: 'Lütfen 60 sn bekleyin.' });
      }
    }

    const code = generateOtpCode();
    const codeHash = await bcrypt.hash(code, 10);
    const ttlSeconds = getOtpTtlSeconds();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const now = new Date();

    if (method === 'email') {
      await sendOtpEmail({ to: target, code });
      await logAuthEvent({ channel: 'email', event: 'register_otp_send', status: 'success', target });
    } else {
      await sendOtpSms({ phone: target, code });
      await logAuthEvent({ channel: 'sms', event: 'register_otp_send', status: 'success', target });
    }

    await Otp.deleteMany({ channel: method, target });
    await Otp.create({
      channel: method,
      target,
      codeHash,
      expiresAt,
      lastSentAt: now
    });

    return res.json({ ok: true, message: 'Kod gönderildi' });
  } catch (error) {
    console.error('REGISTER_OTP_SEND_FAIL', {
      status: error?.status || error?.statusCode,
      code: error?.code,
      message: error?.message,
      moreInfo: error?.moreInfo
    });
    await logAuthEvent({
      channel: req.body?.method,
      event: 'register_otp_send',
      status: 'failed',
      target: normalizeRegisterTarget(req.body?.method, req.body),
      errorMessage: error?.message || 'REGISTER_OTP_SEND_FAIL',
      provider: error?.provider
    });
    if (
      String(error?.code || '').startsWith('EMAIL') ||
      String(error?.code || '').startsWith('CONFIG_MISSING') ||
      error?.code === 'ETIMEDOUT' ||
      error?.code === 'ECONNREFUSED'
    ) {
      console.error('OTP_EMAIL_SEND_FAIL', { message: error?.message, detail: error?.detail, code: error?.code });
      if (error?.code === 'ETIMEDOUT' || error?.code === 'ECONNREFUSED') {
        return res.status(502).json({ ok: false, message: 'E-posta sağlayıcısına bağlanılamadı. Lütfen daha sonra tekrar deneyin.' });
      }
      if (String(error?.code || '').startsWith('CONFIG_MISSING')) {
        return res.status(502).json({ ok: false, message: 'E-posta servis ayarları eksik. Lütfen destek ile iletişime geçin.' });
      }
      return res.status(502).json({ ok: false, message: 'Email gönderilemedi' });
    }
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
    return res.status(502).json({ ok: false, message: 'Kod gönderilemedi' });
  }
};

export const verifyRegisterOtp = async (req, res) => {
  try {
    const method = String(req.body?.method || '').trim();
    if (!['email', 'sms'].includes(method)) {
      return res.status(400).json({ ok: false, message: 'Yöntem geçersiz.' });
    }

    const target = normalizeRegisterTarget(method, req.body);
    const code = String(req.body?.code || '').trim();
    const name = String(req.body?.name || 'Kullanici').trim();
    const password = req.body?.password;

    if (!target || !code) {
      return res.status(400).json({ ok: false, message: 'Bilgiler eksik.' });
    }
    if (!password) {
      return res.status(400).json({ ok: false, message: 'Şifre zorunlu.' });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ ok: false, message: 'Kod 6 haneli olmalı.' });
    }

    const existingUser =
      method === 'email'
        ? await User.findOne({ email: target })
        : await User.findOne({ phoneE164: target });
    if (existingUser) {
      return res.status(400).json({
        ok: false,
        message: method === 'email' ? 'Bu e-posta zaten kayıtlı' : 'Bu telefon numarası zaten kayıtlı'
      });
    }

    const record = await Otp.findOne({ channel: method, target }).sort({ createdAt: -1 });
    if (!record) {
      return res.status(400).json({ ok: false, message: 'Kod bulunamadı.' });
    }
    if (record.usedAt) {
      return res.status(400).json({ ok: false, message: 'Kod zaten kullanıldı.' });
    }
    if (isOtpExpired(record)) {
      await Otp.deleteMany({ channel: 'email', target: email });
      return res.status(400).json({ ok: false, message: 'Kodun süresi doldu.' });
    }
    if (record.attempts >= getOtpMaxAttempts()) {
      await Otp.deleteMany({ channel: method, target });
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
    await logAuthEvent({ channel: method, event: 'register_otp_verify', status: 'success', target });

    const userPayload =
      method === 'email'
        ? { name, email: target, password, emailVerified: true }
        : { name, phoneE164: target, phoneVerified: true, password, email: null };

    const user = await User.create(userPayload);

    sendAuthResponse(res, 201, user);
  } catch (error) {
    console.error('REGISTER_OTP_VERIFY_FAIL', error);
    await logAuthEvent({
      channel: req.body?.method,
      event: 'register_otp_verify',
      status: 'failed',
      target: req.body?.email || req.body?.phone || '',
      errorMessage: error?.message || 'REGISTER_OTP_VERIFY_FAIL'
    });
    return res.status(500).json({ ok: false, message: 'Doğrulama başarısız' });
  }
};

export const sendLoginOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ ok: false, message: 'E-posta zorunlu.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ ok: false, message: 'Bu e-posta kayıtlı değil' });
    }

    const last = await Otp.findOne({ channel: 'email', target: email }).sort({ lastSentAt: -1 });
    if (last?.lastSentAt) {
      const secondsSince = (Date.now() - last.lastSentAt.getTime()) / 1000;
      if (secondsSince < 60) {
        return res.status(429).json({ ok: false, message: 'Lütfen 60 sn bekleyin.' });
      }
    }

    const code = generateOtpCode();
    const codeHash = await bcrypt.hash(code, 10);
    const ttlSeconds = getOtpTtlSeconds();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const now = new Date();

    await Otp.deleteMany({ channel: 'email', target: email });
    await Otp.create({
      channel: 'email',
      target: email,
      codeHash,
      expiresAt,
      lastSentAt: now
    });

    await sendOtpEmail({ to: email, code });
    await logAuthEvent({ channel: 'email', event: 'login_otp_send', status: 'success', target: email });

    return res.json({ ok: true, message: 'Kod gönderildi' });
  } catch (error) {
    console.error('LOGIN_OTP_SEND_FAIL', error);
    await logAuthEvent({
      channel: 'email',
      event: 'login_otp_send',
      status: 'failed',
      target: req.body?.email || '',
      errorMessage: error?.message || 'LOGIN_OTP_SEND_FAIL'
    });
    if (String(error?.code || '').startsWith('EMAIL')) {
      console.error('OTP_EMAIL_SEND_FAIL', { message: error?.message, detail: error?.detail });
      return res.status(502).json({ ok: false, message: 'Email gönderilemedi' });
    }
    return res.status(502).json({ ok: false, message: 'Kod gönderilemedi' });
  }
};

export const verifyLoginOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();

    if (!email || !code) {
      return res.status(400).json({ ok: false, message: 'Bilgiler eksik.' });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ ok: false, message: 'Kod 6 haneli olmalı.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ ok: false, message: 'Bu e-posta kayıtlı değil' });
    }

    const record = await Otp.findOne({ channel: 'email', target: email }).sort({ createdAt: -1 });
    if (!record) {
      return res.status(400).json({ ok: false, message: 'Kod bulunamadı.' });
    }
    if (record.usedAt) {
      return res.status(400).json({ ok: false, message: 'Kod zaten kullanıldı.' });
    }
    if (isOtpExpired(record)) {
      await Otp.deleteMany({ channel: 'email', target: email });
      return res.status(400).json({ ok: false, message: 'Kodun süresi doldu.' });
    }
    if (record.attempts >= getOtpMaxAttempts()) {
      await Otp.deleteMany({ channel: 'email', target: email });
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
    await logAuthEvent({ channel: 'email', event: 'login_otp_verify', status: 'success', target: email });

    user.emailVerified = true;
    await user.save();

    sendAuthResponse(res, 200, user);
  } catch (error) {
    console.error('LOGIN_OTP_VERIFY_FAIL', error);
    await logAuthEvent({
      channel: 'email',
      event: 'login_otp_verify',
      status: 'failed',
      target: req.body?.email || '',
      errorMessage: error?.message || 'LOGIN_OTP_VERIFY_FAIL'
    });
    return res.status(500).json({ ok: false, message: 'Doğrulama başarısız' });
  }
};

export const oauthGoogle = async (_req, res) => {
  if (!isOauthConfigured('google')) {
    return res.status(501).json({ success: false, code: 'OAUTH_NOT_CONFIGURED' });
  }
  return res.status(501).json({ success: false, code: 'OAUTH_NOT_CONFIGURED' });
};

export const oauthGoogleCallback = async (_req, res) => {
  if (!isOauthConfigured('google')) {
    return res.status(501).json({ success: false, code: 'OAUTH_NOT_CONFIGURED' });
  }
  return res.status(501).json({ success: false, code: 'OAUTH_NOT_CONFIGURED' });
};

export const oauthApple = async (_req, res) => {
  if (!isOauthConfigured('apple')) {
    return res.status(501).json({ success: false, code: 'OAUTH_NOT_CONFIGURED' });
  }
  return res.status(501).json({ success: false, code: 'OAUTH_NOT_CONFIGURED' });
};

export const oauthAppleCallback = async (_req, res) => {
  if (!isOauthConfigured('apple')) {
    return res.status(501).json({ success: false, code: 'OAUTH_NOT_CONFIGURED' });
  }
  return res.status(501).json({ success: false, code: 'OAUTH_NOT_CONFIGURED' });
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select(
      '_id name firstName lastName phone email role city isPremium premiumUntil trustScore totalCompletedDeals positiveReviews negativeReviews isOnboardingCompleted featuredCredits'
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        email: user.email,
        role: user.role,
        city: user.city || null,
        isPremium: Boolean(user.isPremium),
        premiumUntil: user.premiumUntil || null,
        trustScore: Number(user.trustScore || 50),
        totalCompletedDeals: Number(user.totalCompletedDeals || 0),
        positiveReviews: Number(user.positiveReviews || 0),
        negativeReviews: Number(user.negativeReviews || 0),
        isOnboardingCompleted: Boolean(user.isOnboardingCompleted),
        featuredCredits: Number(user.featuredCredits || 0)
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const precheckAuth = async (req, res) => {
  try {
    const method = String(req.body?.method || '').trim();
    if (method === 'sms') {
      const phoneE164 = normalizePhone(req.body?.phone || '');
      if (!phoneE164) {
        return res.status(400).json({ ok: false, message: 'Telefon geçersiz.' });
      }
      const user = await User.findOne({ phoneE164 });
      return res.json({ ok: true, exists: Boolean(user) });
    }
    if (method === 'email') {
      const email = normalizeEmail(req.body?.email || '');
      if (!email) {
        return res.status(400).json({ ok: false, message: 'E-posta geçersiz.' });
      }
      const user = await User.findOne({ email });
      return res.json({ ok: true, exists: Boolean(user) });
    }
    return res.status(400).json({ ok: false, message: 'Yöntem geçersiz.' });
  } catch (error) {
    console.error('PRECHECK_FAIL', error);
    return res.status(500).json({ ok: false, message: 'Kontrol başarısız' });
  }
};
