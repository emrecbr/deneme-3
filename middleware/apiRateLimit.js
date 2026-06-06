import ApiRateLimitCounter from '../models/ApiRateLimitCounter.js';
import SecurityEvent from '../models/SecurityEvent.js';
import AppSetting from '../models/AppSetting.js';

const minute = 60 * 1000;
const hour = 60 * minute;
const day = 24 * hour;

const RATE_LIMIT_DEFAULTS = {
  login: {
    name: 'login',
    windowMs: 15 * minute,
    max: 5,
    keyParts: ['ip'],
    message: 'Çok fazla giriş denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin.'
  },
  register: {
    name: 'register',
    windowMs: hour,
    max: 5,
    keyParts: ['ip'],
    message: 'Çok fazla kayıt denemesi yapıldı. Lütfen daha sonra tekrar deneyin.'
  },
  otpSendShort: {
    name: 'otp_send_short',
    windowMs: 10 * minute,
    max: 3,
    keyParts: ['targetOrUserOrIp'],
    message: 'Çok fazla doğrulama kodu istendi. Lütfen 10 dakika sonra tekrar deneyin.'
  },
  otpSendDaily: {
    name: 'otp_send_daily',
    windowMs: day,
    max: 10,
    keyParts: ['targetOrUserOrIp'],
    message: 'Günlük doğrulama kodu limitine ulaşıldı. Lütfen yarın tekrar deneyin.'
  },
  passwordReset: {
    name: 'password_reset',
    windowMs: hour,
    max: 3,
    keyParts: ['targetOrIp'],
    message: 'Çok fazla şifre sıfırlama isteği gönderildi. Lütfen daha sonra tekrar deneyin.'
  },
  rfqCreate: {
    name: 'rfq_create',
    windowMs: hour,
    max: 10,
    keyParts: ['userOrIp'],
    message: 'Çok fazla talep oluşturma denemesi yapıldı. Lütfen daha sonra tekrar deneyin.'
  },
  offerCreate: {
    name: 'offer_create',
    windowMs: hour,
    max: 30,
    keyParts: ['userOrIp'],
    message: 'Çok fazla teklif gönderildi. Lütfen daha sonra tekrar deneyin.'
  },
  chatMessage: {
    name: 'chat_message',
    windowMs: minute,
    max: 60,
    keyParts: ['userOrIp'],
    message: 'Çok fazla mesaj gönderildi. Lütfen kısa süre sonra tekrar deneyin.'
  },
  upload: {
    name: 'upload',
    windowMs: hour,
    max: 20,
    keyParts: ['userOrIp'],
    message: 'Çok fazla dosya yükleme denemesi yapıldı. Lütfen daha sonra tekrar deneyin.'
  },
  locationReverse: {
    name: 'location_reverse',
    windowMs: hour,
    max: 60,
    keyParts: ['userOrIp'],
    message: 'Çok fazla konum isteği gönderildi. Lütfen daha sonra tekrar deneyin.'
  },
  adminApi: {
    name: 'admin_api',
    windowMs: 15 * minute,
    max: 300,
    keyParts: ['userOrIp'],
    message: 'Admin API limiti aşıldı. Lütfen kısa süre sonra tekrar deneyin.'
  }
};

let settingsCache = { value: null, loadedAt: 0 };
const SETTINGS_TTL_MS = 60 * 1000;

export const clearApiRateLimitSettingsCache = () => {
  settingsCache = { value: null, loadedAt: 0 };
};

const getConfiguredPolicy = async (policy) => {
  const now = Date.now();
  if (now - settingsCache.loadedAt > SETTINGS_TTL_MS) {
    try {
      const doc = await AppSetting.findOne({ key: 'api_rate_limit_settings' }).lean();
      settingsCache = {
        value: doc?.value || {},
        loadedAt: now
      };
    } catch (_error) {
      settingsCache.loadedAt = now;
    }
  }

  const override = settingsCache.value?.[policy.name] || {};
  const nextMax = Number(override.max);
  const nextWindowMs = Number(override.windowMs);
  return {
    ...policy,
    max: Number.isFinite(nextMax) && nextMax > 0 ? nextMax : policy.max,
    windowMs: Number.isFinite(nextWindowMs) && nextWindowMs > 0 ? nextWindowMs : policy.windowMs,
    message: override.message || policy.message
  };
};

const normalizeValue = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

const normalizePhone = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('90') && digits.length >= 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return `+90${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith('5')) {
    return `+90${digits}`;
  }
  return raw.startsWith('+') ? `+${digits}` : digits;
};

const getClientIp = (req) => {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)[0];
  return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
};

const getTargetIdentifier = (req) => {
  const source = {
    ...(req.body || {}),
    ...(req.query || {})
  };
  const email = normalizeValue(source.email || source.mail || source.identifier || source.to);
  if (email && email.includes('@')) {
    return `email:${email}`;
  }
  const phone = normalizePhone(
    source.phone ||
      source.phoneNumber ||
      source.phoneE164 ||
      source.phoneLocal ||
      source.identifier ||
      source.to ||
      source.target
  );
  if (phone) {
    return `phone:${phone}`;
  }
  return '';
};

const resolveKeyPart = (part, req) => {
  const ip = getClientIp(req);
  const userId = req.user?.id ? `user:${req.user.id}` : '';
  const target = getTargetIdentifier(req);

  if (part === 'ip') return `ip:${ip}`;
  if (part === 'user') return userId || `ip:${ip}`;
  if (part === 'userOrIp') return userId || `ip:${ip}`;
  if (part === 'targetOrIp') return target || `ip:${ip}`;
  if (part === 'targetOrUserOrIp') return target || userId || `ip:${ip}`;
  return `${part}:unknown`;
};

const getPolicy = (policyName) => {
  const defaults = RATE_LIMIT_DEFAULTS[policyName];
  if (!defaults) {
    throw new Error(`Unknown rate limit policy: ${policyName}`);
  }
  return defaults;
};

const logLimitExceeded = async ({ req, policy, key, count }) => {
  try {
    await SecurityEvent.create({
      type: 'api_rate_limit_exceeded',
      userId: req.user?.id || null,
      role: req.user?.role || req.admin?.role || null,
      ip: getClientIp(req),
      userAgent: req.headers?.['user-agent'] || '',
      path: req.originalUrl,
      method: req.method,
      meta: {
        policy: policy.name,
        key,
        limit: policy.max,
        count,
        windowMs: policy.windowMs
      }
    });
  } catch (_error) {
    // Rate-limit logging must not break request handling.
  }
};

export const apiRateLimit = (policyName) => {
  const policy = getPolicy(policyName);

  return async (req, res, next) => {
    try {
      const activePolicy = await getConfiguredPolicy(policy);
      const now = Date.now();
      const windowBucket = Math.floor(now / activePolicy.windowMs);
      const keyParts = activePolicy.keyParts.map((part) => resolveKeyPart(part, req));
      const key = `${activePolicy.name}:${windowBucket}:${keyParts.join(':')}`;
      const expiresAt = new Date((windowBucket + 1) * activePolicy.windowMs + minute);

      const counter = await ApiRateLimitCounter.findOneAndUpdate(
        { key },
        {
          $setOnInsert: {
            key,
            name: activePolicy.name,
            windowBucket,
            expiresAt
          },
          $inc: { count: 1 }
        },
        { upsert: true, new: true }
      ).lean();

      const remaining = Math.max(activePolicy.max - Number(counter?.count || 0), 0);
      const resetMs = (windowBucket + 1) * activePolicy.windowMs;
      res.setHeader('RateLimit-Limit', String(activePolicy.max));
      res.setHeader('RateLimit-Remaining', String(remaining));
      res.setHeader('RateLimit-Reset', String(Math.ceil(resetMs / 1000)));

      if (Number(counter?.count || 0) > activePolicy.max) {
        await logLimitExceeded({ req, policy: activePolicy, key, count: counter.count });
        return res.status(429).json({
          success: false,
          code: 'RATE_LIMIT_EXCEEDED',
          message: activePolicy.message
        });
      }

      return next();
    } catch (error) {
      console.warn('API_RATE_LIMIT_ERROR', {
        policy: policy.name,
        message: error?.message || 'rate_limit_error'
      });
      return next();
    }
  };
};

export const otpSendRateLimit = [apiRateLimit('otpSendShort'), apiRateLimit('otpSendDaily')];

export default apiRateLimit;
