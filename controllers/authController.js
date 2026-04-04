import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import Otp from '../models/Otp.js';
import { getListingQuotaSettings, getListingQuotaSnapshot } from '../src/utils/listingQuota.js';
import { sendOtpEmail } from '../src/services/email.js';
import { sendOtpSms } from '../src/services/sms.js';
import PhoneOtp from '../models/PhoneOtp.js';
import { normalizeTrPhoneE164 } from '../src/utils/phone.js';
import { logAuthEvent } from '../src/utils/authLog.js';

const TOKEN_COOKIE_NAME = 'token';
const TOKEN_EXPIRES_IN = '7d';
const TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const GOOGLE_OAUTH_STATE_COOKIE_NAME = 'google_oauth_state';
const GOOGLE_OAUTH_STATE_MAX_AGE = 10 * 60 * 1000;

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

const maskEmailForLog = (email) => {
  const value = normalizeEmail(email);
  if (!value.includes('@')) return value;
  const [name, domain] = value.split('@');
  if (name.length <= 2) return `**@${domain}`;
  return `${name[0]}***${name.slice(-1)}@${domain}`;
};

const buildUserPayload = (user) => ({
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
});

const getAuthCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: TOKEN_MAX_AGE
});

const setAuthCookie = (res, token) => {
  res.cookie(TOKEN_COOKIE_NAME, token, getAuthCookieOptions());
};

const issueAuthToken = (res, user) => {
  const token = signToken({
    id: user._id,
    role: user.role
  });
  setAuthCookie(res, token);
  return token;
};

const getRequestBaseUrl = (req) => {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'http';
  const host = req.get('host');
  if (!host) {
    return '';
  }
  return `${protocol}://${host}`;
};

const getFrontendBaseUrl = () =>
  String(
    process.env.FRONTEND_URL ||
      process.env.CLIENT_ORIGIN ||
      process.env.APP_BASE_URL ||
      'http://localhost:5173'
  )
    .trim()
    .replace(/\/$/, '');

const getGoogleCallbackUrl = (req) => {
  const configured = String(process.env.GOOGLE_CALLBACK_URL || '').trim();
  if (configured && configured.includes('/api/auth/google/callback')) {
    return configured;
  }
  const requestBase = getRequestBaseUrl(req);
  if (!requestBase) {
    return '';
  }
  return `${requestBase}/api/auth/google/callback`;
};

const redirectToFrontend = (res, path, params = {}) => {
  const frontendBaseUrl = getFrontendBaseUrl();
  const url = new URL(path, `${frontendBaseUrl}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return res.redirect(url.toString());
};

const verifyGoogleIdToken = async (idToken) => {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) {
    throw new Error('GOOGLE_ID_TOKEN_INVALID');
  }
  const payload = await response.json();
  const aud = String(payload.aud || '');
  const iss = String(payload.iss || '');
  if (aud !== String(process.env.GOOGLE_CLIENT_ID || '').trim()) {
    throw new Error('GOOGLE_ID_TOKEN_AUDIENCE_MISMATCH');
  }
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(iss)) {
    throw new Error('GOOGLE_ID_TOKEN_ISSUER_MISMATCH');
  }
  return payload;
};

const fetchGoogleUserInfo = async (accessToken) => {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!response.ok) {
    throw new Error('GOOGLE_USERINFO_FETCH_FAILED');
  }
  return response.json();
};

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
  const token = issueAuthToken(res, user);

  res.status(statusCode).json({
    token,
    user: buildUserPayload(user)
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
  const req = _req;
  if (!isOauthConfigured('google')) {
    console.warn('GOOGLE_AUTH_START_FAIL', { reason: 'missing_google_env' });
    return res.status(501).json({ success: false, code: 'OAUTH_NOT_CONFIGURED' });
  }

  const callbackUrl = getGoogleCallbackUrl(req);
  if (!callbackUrl) {
    console.warn('GOOGLE_AUTH_START_FAIL', { reason: 'invalid_callback_url' });
    return res.status(500).json({ success: false, code: 'INVALID_CALLBACK_URL' });
  }

  const state = crypto.randomBytes(24).toString('hex');
  res.cookie(GOOGLE_OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: GOOGLE_OAUTH_STATE_MAX_AGE
  });

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('prompt', 'select_account');

  console.info('GOOGLE_AUTH_START', {
    callbackUrl,
    frontendBaseUrl: getFrontendBaseUrl()
  });

  return res.redirect(authUrl.toString());
};

export const oauthGoogleCallback = async (req, res) => {
  const fail = (reason) => {
    console.warn('GOOGLE_AUTH_CALLBACK_FAIL', { reason });
    res.clearCookie(GOOGLE_OAUTH_STATE_COOKIE_NAME);
    return redirectToFrontend(res, '/login', {
      error: 'google_auth_failed',
      reason
    });
  };

  if (!isOauthConfigured('google')) {
    return res.status(501).json({ success: false, code: 'OAUTH_NOT_CONFIGURED' });
  }

  console.info('GOOGLE_AUTH_CALLBACK_HIT');

  const callbackUrl = getGoogleCallbackUrl(req);
  if (!callbackUrl) {
    return fail('invalid_callback_url');
  }

  const providerError = String(req.query?.error || '').trim();
  const code = String(req.query?.code || '').trim();
  const state = String(req.query?.state || '').trim();
  const expectedState = String(req.cookies?.[GOOGLE_OAUTH_STATE_COOKIE_NAME] || '').trim();

  if (providerError) {
    return fail(`provider_${providerError}`);
  }
  if (!code) {
    return fail('missing_code');
  }
  if (!state || !expectedState || state !== expectedState) {
    return fail('invalid_state');
  }

  res.clearCookie(GOOGLE_OAUTH_STATE_COOKIE_NAME);

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      console.warn('GOOGLE_AUTH_TOKEN_EXCHANGE_FAIL', { status: tokenResponse.status });
      return fail('token_exchange_failed');
    }

    const tokenData = await tokenResponse.json();
    const idToken = String(tokenData.id_token || '').trim();
    const accessToken = String(tokenData.access_token || '').trim();
    if (!idToken || !accessToken) {
      return fail('missing_google_tokens');
    }

    const idTokenPayload = await verifyGoogleIdToken(idToken);
    const userInfo = await fetchGoogleUserInfo(accessToken);
    const email = normalizeEmail(userInfo.email || idTokenPayload.email);
    const emailVerified =
      String(userInfo.email_verified || idTokenPayload.email_verified || '').toLowerCase() === 'true';

    if (!email) {
      return fail('missing_email');
    }
    if (!emailVerified) {
      return fail('email_not_verified');
    }

    let user = await User.findOne({ email });
    let created = false;

    if (user) {
      user.name = String(userInfo.name || user.name || email.split('@')[0]).trim() || user.name;
      user.emailVerified = true;
      if (userInfo.picture && !user.avatarUrl) {
        user.avatarUrl = userInfo.picture;
      }
      user.lastLoginAt = new Date();
      await user.save();
      console.info('GOOGLE_AUTH_USER_MATCHED', {
        userId: String(user._id),
        email: maskEmailForLog(email)
      });
    } else {
      const generatedPassword = crypto.randomBytes(32).toString('hex');
      user = await User.create({
        name: String(userInfo.name || email.split('@')[0] || 'Kullanici').trim() || 'Kullanici',
        email,
        emailVerified: true,
        avatarUrl: String(userInfo.picture || '').trim() || undefined,
        password: generatedPassword,
        lastLoginAt: new Date()
      });
      created = true;
      console.info('GOOGLE_AUTH_USER_CREATED', {
        userId: String(user._id),
        email: maskEmailForLog(email)
      });
    }

    const token = issueAuthToken(res, user);
    console.info('GOOGLE_AUTH_TOKEN_ISSUED', {
      userId: String(user._id),
      created
    });

    return redirectToFrontend(res, '/auth/callback', { token });
  } catch (error) {
    console.error('GOOGLE_AUTH_CALLBACK_EXCEPTION', {
      message: error?.message || 'unknown_error'
    });
    return fail(error?.message || 'unknown_error');
  }
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
      '_id name firstName lastName phone email role city isPremium premiumUntil trustScore totalCompletedDeals positiveReviews negativeReviews isOnboardingCompleted featuredCredits avatarUrl listingQuotaWindowStart listingQuotaWindowEnd listingQuotaUsedFree paidListingCredits paymentProvider paymentMethod'
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const settings = await getListingQuotaSettings();
    const quota = getListingQuotaSnapshot(user, settings);

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
        featuredCredits: Number(user.featuredCredits || 0),
        avatarUrl: user.avatarUrl || '',
        listingQuota: quota,
        paymentMethod: user.paymentMethod || null,
        paymentProvider: user.paymentProvider || null
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
