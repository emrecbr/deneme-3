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
import {
  buildSurfaceUrl,
  getAdminSurfaceConfig,
  getApiSurfaceConfig,
  getAppSurfaceConfig,
  getWebSurfaceConfig
} from '../src/config/surfaceConfig.js';

const TOKEN_COOKIE_NAME = 'token';
const TOKEN_EXPIRES_IN = '7d';
const TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const GOOGLE_OAUTH_STATE_COOKIE_NAME = 'google_oauth_state';
const GOOGLE_OAUTH_SOURCE_COOKIE_NAME = 'google_oauth_source';
const GOOGLE_OAUTH_STATE_MAX_AGE = 10 * 60 * 1000;
const APPLE_OAUTH_STATE_COOKIE_NAME = 'apple_oauth_state';
const APPLE_OAUTH_SOURCE_COOKIE_NAME = 'apple_oauth_source';
const APPLE_OAUTH_STATE_MAX_AGE = 10 * 60 * 1000;
const OAUTH_SURFACE_SOURCES = new Set(['web', 'app', 'admin']);

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

const normalizeOauthSurfaceSource = (value, fallback = 'app') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (OAUTH_SURFACE_SOURCES.has(normalized)) {
    return normalized;
  }
  return fallback;
};

const getSurfaceBaseConfig = (surface = 'app') => {
  const normalizedSurface = normalizeOauthSurfaceSource(surface);
  if (normalizedSurface === 'web') {
    return getWebSurfaceConfig();
  }
  if (normalizedSurface === 'admin') {
    return getAdminSurfaceConfig();
  }
  return getAppSurfaceConfig();
};

const getFrontendBaseConfig = (surface = 'app') => {
  const resolved = getSurfaceBaseConfig(surface);
  if (resolved.value) {
    return resolved;
  }

  if (process.env.NODE_ENV !== 'production') {
    return {
      value: 'http://localhost:5173',
      source: 'dev_fallback'
    };
  }

  return {
    value: '',
    source: 'missing'
  };
};

const getFrontendBaseUrl = (surface = 'app') => getFrontendBaseConfig(surface).value;

const getSurfaceSourceFromUrl = (value) => {
  const host = getHostnameOnly(getHostFromUrl(value));
  if (!host) {
    return '';
  }

  const webHost = getHostnameOnly(getHostFromUrl(getWebSurfaceConfig().value));
  const appHost = getHostnameOnly(getHostFromUrl(getAppSurfaceConfig().value));
  const adminHost = getHostnameOnly(getHostFromUrl(getAdminSurfaceConfig().value));

  if (host === webHost || host === 'talepet.net.tr' || host === 'www.talepet.net.tr') {
    return 'web';
  }
  if (host === adminHost || host === 'admin.talepet.net.tr') {
    return 'admin';
  }
  if (host === appHost || host === 'app.talepet.net.tr') {
    return 'app';
  }

  return '';
};

const resolveAuthSourceSurface = (req, fallback = 'app') => {
  const explicitSource = normalizeOauthSurfaceSource(
    req.query?.source || req.body?.source || req.cookies?.oauth_source_surface,
    ''
  );
  if (explicitSource) {
    return explicitSource;
  }

  const originSurface = getSurfaceSourceFromUrl(req.get('origin'));
  if (originSurface) {
    return originSurface;
  }

  const refererSurface = getSurfaceSourceFromUrl(req.get('referer'));
  if (refererSurface) {
    return refererSurface;
  }

  return normalizeOauthSurfaceSource(fallback);
};

const getApiBaseConfig = (req) => {
  const resolved = getApiSurfaceConfig();
  if (resolved.value) {
    return resolved;
  }

  if (process.env.NODE_ENV !== 'production') {
    const requestBase = getRequestBaseUrl(req);
    if (requestBase) {
      return {
        value: `${requestBase}/api`,
        source: 'request_fallback'
      };
    }
  }

  return {
    value: '',
    source: 'missing'
  };
};

const getGoogleCallbackConfig = (req) => {
  const configured = String(process.env.GOOGLE_CALLBACK_URL || '').trim();
  if (configured && configured.includes('/api/auth/google/callback')) {
    return {
      value: configured,
      source: 'GOOGLE_CALLBACK_URL'
    };
  }

  const apiBaseConfig = getApiBaseConfig(req);
  if (apiBaseConfig.value) {
    return {
      value: `${apiBaseConfig.value}/auth/google/callback`,
      source: `${apiBaseConfig.source}_google_callback`
    };
  }

  if (process.env.NODE_ENV !== 'production') {
    const requestBase = getRequestBaseUrl(req);
    if (requestBase) {
      return {
        value: `${requestBase}/api/auth/google/callback`,
        source: 'request_fallback'
      };
    }
  }

  return {
    value: '',
    source: configured ? 'invalid_env_value' : 'missing'
  };
};

const getGoogleCallbackUrl = (req) => getGoogleCallbackConfig(req).value;

const getAppleCallbackEnvValue = () =>
  String(process.env.APPLE_REDIRECT_URI || process.env.APPLE_CALLBACK_URL || '').trim();

const getAppleCallbackConfig = (req) => {
  const configured = getAppleCallbackEnvValue();
  if (configured && configured.includes('/api/auth/apple/callback')) {
    return {
      value: configured,
      source: process.env.APPLE_REDIRECT_URI ? 'APPLE_REDIRECT_URI' : 'APPLE_CALLBACK_URL'
    };
  }

  const apiBaseConfig = getApiBaseConfig(req);
  if (apiBaseConfig.value) {
    return {
      value: `${apiBaseConfig.value}/auth/apple/callback`,
      source: `${apiBaseConfig.source}_apple_callback`
    };
  }

  if (process.env.NODE_ENV !== 'production') {
    const requestBase = getRequestBaseUrl(req);
    if (requestBase) {
      return {
        value: `${requestBase}/api/auth/apple/callback`,
        source: 'request_fallback'
      };
    }
  }

  return {
    value: '',
    source: configured ? 'invalid_env_value' : 'missing'
  };
};

const getAppleCallbackUrl = (req) => getAppleCallbackConfig(req).value;

const buildGoogleAuthEnvSnapshot = (req, sourceSurface = 'app') => {
  const frontendConfig = getFrontendBaseConfig(sourceSurface);
  const callbackConfig = getGoogleCallbackConfig(req);

  return {
    sourceSurface: normalizeOauthSurfaceSource(sourceSurface),
    nodeEnv: process.env.NODE_ENV || 'undefined',
    requestBaseUrl: getRequestBaseUrl(req),
    requestHost: req.get('host') || '',
    forwardedProto: String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || '',
    googleClientIdConfigured: Boolean(String(process.env.GOOGLE_CLIENT_ID || '').trim()),
    googleClientSecretConfigured: Boolean(String(process.env.GOOGLE_CLIENT_SECRET || '').trim()),
    googleCallbackUrl: callbackConfig.value,
    googleCallbackUrlSource: callbackConfig.source,
    frontendBaseUrl: frontendConfig.value,
    frontendBaseUrlSource: frontendConfig.source
  };
};

const buildAppleAuthEnvSnapshot = (req, sourceSurface = 'app') => {
  const frontendConfig = getFrontendBaseConfig(sourceSurface);
  const callbackConfig = getAppleCallbackConfig(req);

  return {
    sourceSurface: normalizeOauthSurfaceSource(sourceSurface),
    nodeEnv: process.env.NODE_ENV || 'undefined',
    requestBaseUrl: getRequestBaseUrl(req),
    requestHost: req.get('host') || '',
    forwardedProto: String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || '',
    appleClientIdConfigured: Boolean(String(process.env.APPLE_CLIENT_ID || '').trim()),
    appleTeamIdConfigured: Boolean(String(process.env.APPLE_TEAM_ID || '').trim()),
    appleKeyIdConfigured: Boolean(String(process.env.APPLE_KEY_ID || '').trim()),
    applePrivateKeyConfigured: Boolean(String(process.env.APPLE_PRIVATE_KEY || '').trim()),
    appleCallbackUrl: callbackConfig.value,
    appleCallbackUrlSource: callbackConfig.source,
    frontendBaseUrl: frontendConfig.value,
    frontendBaseUrlSource: frontendConfig.source
  };
};

const readSafeResponseBody = async (response) => {
  try {
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
      const json = await response.json();
      return {
        error: String(json?.error || '').trim(),
        error_description: String(json?.error_description || '').trim()
      };
    }

    const text = String(await response.text()).trim();
    return {
      error: text.slice(0, 120),
      error_description: ''
    };
  } catch (_error) {
    return {
      error: '',
      error_description: ''
    };
  }
};

const getHostFromUrl = (value) => {
  try {
    return new URL(String(value || '').trim()).host;
  } catch (_error) {
    return '';
  }
};

const getHostnameOnly = (value) => String(value || '').trim().split(':')[0].toLowerCase();

const buildSharedCookieDomain = (...hosts) => {
  if (process.env.NODE_ENV !== 'production') {
    return '';
  }

  const normalized = hosts
    .map(getHostnameOnly)
    .filter(Boolean)
    .map((host) => host.split('.').filter(Boolean));

  if (!normalized.length || normalized.some((parts) => parts.length < 2)) {
    return '';
  }

  const shared = [];
  const maxDepth = Math.min(...normalized.map((parts) => parts.length));
  for (let index = 1; index <= maxDepth; index += 1) {
    const candidate = normalized[0][normalized[0].length - index];
    if (normalized.every((parts) => parts[parts.length - index] === candidate)) {
      shared.unshift(candidate);
    } else {
      break;
    }
  }

  if (shared.length < 2) {
    return '';
  }

  return `.${shared.join('.')}`;
};

const getGoogleStateCookieOptions = (req) => {
  const envSnapshot = buildGoogleAuthEnvSnapshot(req, resolveAuthSourceSurface(req));
  const requestHost = getHostFromUrl(envSnapshot.requestBaseUrl);
  const callbackHost = getHostFromUrl(envSnapshot.googleCallbackUrl);
  const frontendHost = getHostFromUrl(envSnapshot.frontendBaseUrl);
  const cookieDomain = buildSharedCookieDomain(requestHost, callbackHost, frontendHost);

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: GOOGLE_OAUTH_STATE_MAX_AGE,
    ...(cookieDomain ? { domain: cookieDomain } : {})
  };
};

const getAppleStateCookieOptions = (req) => {
  const envSnapshot = buildAppleAuthEnvSnapshot(req, resolveAuthSourceSurface(req));
  const requestHost = getHostFromUrl(envSnapshot.requestBaseUrl);
  const callbackHost = getHostFromUrl(envSnapshot.appleCallbackUrl);
  const frontendHost = getHostFromUrl(envSnapshot.frontendBaseUrl);
  const cookieDomain = buildSharedCookieDomain(requestHost, callbackHost, frontendHost);

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: APPLE_OAUTH_STATE_MAX_AGE,
    ...(cookieDomain ? { domain: cookieDomain } : {})
  };
};

const mapGoogleCallbackErrorToReason = (error) => {
  const code = String(error?.code || '').trim();
  const message = String(error?.message || '').trim();

  if (code === 'GOOGLE_INVALID_REDIRECT_URI') return 'invalid_redirect_uri';
  if (code === 'GOOGLE_TOKEN_EXCHANGE_FAILED') return 'token_exchange_failed';
  if (code === 'GOOGLE_ID_TOKEN_INVALID') return 'invalid_id_token';
  if (code === 'GOOGLE_ID_TOKEN_AUDIENCE_MISMATCH') return 'invalid_audience';
  if (code === 'GOOGLE_ID_TOKEN_ISSUER_MISMATCH') return 'invalid_issuer';
  if (code === 'GOOGLE_USERINFO_FETCH_FAILED') return 'unknown_callback_error';
  if (code === 'GOOGLE_USER_CREATE_FAILED') return 'user_create_failed';
  if (code === 'FRONTEND_REDIRECT_RESOLUTION_FAILED') return 'frontend_redirect_resolution_failed';
  if (message === 'missing_email') return 'missing_email';
  if (message === 'email_not_verified') return 'email_not_verified';

  return 'unknown_callback_error';
};

const getOauthSourceCookieName = (provider = 'google') =>
  provider === 'apple' ? APPLE_OAUTH_SOURCE_COOKIE_NAME : GOOGLE_OAUTH_SOURCE_COOKIE_NAME;

const setOauthSourceCookie = (res, provider, sourceSurface, cookieOptions) => {
  res.cookie(
    getOauthSourceCookieName(provider),
    normalizeOauthSurfaceSource(sourceSurface),
    cookieOptions
  );
};

const getOauthSourceFromCookie = (req, provider = 'google') =>
  normalizeOauthSurfaceSource(req.cookies?.[getOauthSourceCookieName(provider)], '');

const clearOauthSourceCookie = (res, provider, cookieOptions) => {
  res.clearCookie(getOauthSourceCookieName(provider), cookieOptions);
};

const resolvePostLoginRedirectSurface = (req, provider = 'google', fallback = 'app') => {
  const cookieSource = getOauthSourceFromCookie(req, provider);
  if (cookieSource) {
    return cookieSource;
  }
  return resolveAuthSourceSurface(req, fallback);
};

const redirectToFrontend = (res, path, params = {}, sourceSurface = 'app') => {
  const normalizedSurface = normalizeOauthSurfaceSource(sourceSurface);
  const frontendConfig = getFrontendBaseConfig(normalizedSurface);
  const frontendBaseUrl = frontendConfig.value;
  const redirectUrl = frontendBaseUrl
    ? buildSurfaceUrl(normalizedSurface, path, params) || (() => {
        const url = new URL(path, `${frontendBaseUrl}/`);
        Object.entries(params).forEach(([key, value]) => {
          if (value != null && value !== '') {
            url.searchParams.set(key, String(value));
          }
        });
        return url.toString();
      })()
    : '';
  if (!redirectUrl) {
    const error = new Error('FRONTEND_REDIRECT_RESOLUTION_FAILED');
    error.code = 'FRONTEND_REDIRECT_RESOLUTION_FAILED';
    error.meta = { frontendBaseUrlSource: frontendConfig.source, sourceSurface: normalizedSurface };
    throw error;
  }
  console.info('AUTH_FRONTEND_REDIRECT', {
    sourceSurface: normalizedSurface,
    path,
    frontendBaseUrlSource: frontendConfig.source,
    redirectHost: getHostFromUrl(redirectUrl)
  });
  return res.redirect(redirectUrl);
};

const verifyGoogleIdToken = async (idToken) => {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) {
    const error = new Error('GOOGLE_ID_TOKEN_INVALID');
    error.code = 'GOOGLE_ID_TOKEN_INVALID';
    throw error;
  }
  const payload = await response.json();
  const aud = String(payload.aud || '');
  const iss = String(payload.iss || '');
  if (aud !== String(process.env.GOOGLE_CLIENT_ID || '').trim()) {
    const error = new Error('GOOGLE_ID_TOKEN_AUDIENCE_MISMATCH');
    error.code = 'GOOGLE_ID_TOKEN_AUDIENCE_MISMATCH';
    throw error;
  }
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(iss)) {
    const error = new Error('GOOGLE_ID_TOKEN_ISSUER_MISMATCH');
    error.code = 'GOOGLE_ID_TOKEN_ISSUER_MISMATCH';
    throw error;
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
    const error = new Error('GOOGLE_USERINFO_FETCH_FAILED');
    error.code = 'GOOGLE_USERINFO_FETCH_FAILED';
    throw error;
  }
  return response.json();
};

const normalizeMultilineSecret = (value) => String(value || '').trim().replace(/\\n/g, '\n');

const APPLE_CLIENT_SECRET_EXPIRES_IN_SECONDS = 5 * 60;

const getAppleClientSecretDebugSnapshot = (req) => {
  const privateKey = normalizeMultilineSecret(process.env.APPLE_PRIVATE_KEY);
  const callbackConfig = getAppleCallbackConfig(req);
  const clientId = String(process.env.APPLE_CLIENT_ID || '').trim();
  const teamId = String(process.env.APPLE_TEAM_ID || '').trim();
  const keyId = String(process.env.APPLE_KEY_ID || '').trim();

  return {
    envReadiness: {
      clientIdConfigured: Boolean(clientId),
      teamIdConfigured: Boolean(teamId),
      keyIdConfigured: Boolean(keyId),
      redirectUriConfigured: Boolean(String(process.env.APPLE_REDIRECT_URI || '').trim()),
      redirectUriResolved: Boolean(callbackConfig.value),
      redirectUriSource: callbackConfig.source,
      privateKeyConfigured: Boolean(privateKey),
      privateKeyHasBeginMarker: privateKey.includes('BEGIN PRIVATE KEY'),
      privateKeyHasEndMarker: privateKey.includes('END PRIVATE KEY'),
      privateKeyLineCount: privateKey ? privateKey.split('\n').filter(Boolean).length : 0
    },
    clientSecretClaims: {
      headerKidConfigured: Boolean(keyId),
      payloadIssConfigured: Boolean(teamId),
      payloadSubConfigured: Boolean(clientId),
      payloadAud: 'https://appleid.apple.com',
      expiresInSeconds: APPLE_CLIENT_SECRET_EXPIRES_IN_SECONDS
    }
  };
};

const createAppleClientSecret = () => {
  const clientId = String(process.env.APPLE_CLIENT_ID || '').trim();
  const teamId = String(process.env.APPLE_TEAM_ID || '').trim();
  const keyId = String(process.env.APPLE_KEY_ID || '').trim();
  const privateKey = normalizeMultilineSecret(process.env.APPLE_PRIVATE_KEY);

  if (!clientId) {
    const error = new Error('APPLE_CLIENT_ID_MISSING');
    error.code = 'APPLE_CLIENT_ID_MISSING';
    throw error;
  }

  if (!teamId) {
    const error = new Error('APPLE_TEAM_ID_MISSING');
    error.code = 'APPLE_TEAM_ID_MISSING';
    throw error;
  }

  if (!keyId) {
    const error = new Error('APPLE_KEY_ID_MISSING');
    error.code = 'APPLE_KEY_ID_MISSING';
    throw error;
  }

  if (!privateKey) {
    const error = new Error('APPLE_PRIVATE_KEY_MISSING');
    error.code = 'APPLE_PRIVATE_KEY_MISSING';
    throw error;
  }

  if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
    const error = new Error('APPLE_PRIVATE_KEY_INVALID');
    error.code = 'APPLE_PRIVATE_KEY_INVALID';
    throw error;
  }

  return jwt.sign(
    {},
    privateKey,
    {
      algorithm: 'ES256',
      issuer: teamId,
      audience: 'https://appleid.apple.com',
      subject: clientId,
      keyid: keyId,
      expiresIn: APPLE_CLIENT_SECRET_EXPIRES_IN_SECONDS
    }
  );
};

const getApplePublicKey = async (keyId) => {
  const response = await fetch('https://appleid.apple.com/auth/keys');
  if (!response.ok) {
    const error = new Error('APPLE_JWKS_FETCH_FAILED');
    error.code = 'APPLE_JWKS_FETCH_FAILED';
    throw error;
  }

  const payload = await response.json();
  const jwk = Array.isArray(payload?.keys)
    ? payload.keys.find((candidate) => String(candidate?.kid || '').trim() === String(keyId || '').trim())
    : null;

  if (!jwk) {
    const error = new Error('APPLE_JWK_NOT_FOUND');
    error.code = 'APPLE_JWK_NOT_FOUND';
    throw error;
  }

  return crypto.createPublicKey({ key: jwk, format: 'jwk' });
};

const verifyAppleIdToken = async (idToken) => {
  const decoded = jwt.decode(idToken, { complete: true });
  const keyId = String(decoded?.header?.kid || '').trim();
  if (!keyId) {
    const error = new Error('APPLE_ID_TOKEN_INVALID');
    error.code = 'APPLE_ID_TOKEN_INVALID';
    throw error;
  }

  const publicKey = await getApplePublicKey(keyId);
  try {
    return jwt.verify(idToken, publicKey, {
      algorithms: ['RS256'],
      issuer: 'https://appleid.apple.com',
      audience: String(process.env.APPLE_CLIENT_ID || '').trim()
    });
  } catch (verifyError) {
    const message = String(verifyError?.message || '');
    let code = 'APPLE_ID_TOKEN_INVALID';
    if (message.toLowerCase().includes('audience')) code = 'APPLE_ID_TOKEN_AUDIENCE_MISMATCH';
    if (message.toLowerCase().includes('issuer')) code = 'APPLE_ID_TOKEN_ISSUER_MISMATCH';
    const error = new Error(code);
    error.code = code;
    throw error;
  }
};

const parseAppleUserProfile = (rawUser) => {
  if (!rawUser) {
    return {};
  }

  try {
    const parsed = typeof rawUser === 'string' ? JSON.parse(rawUser) : rawUser;
    const firstName = String(parsed?.name?.firstName || parsed?.firstName || '').trim();
    const lastName = String(parsed?.name?.lastName || parsed?.lastName || '').trim();
    const explicitName = String(parsed?.name?.fullName || parsed?.fullName || parsed?.displayName || '').trim();
    const fullName = explicitName || `${firstName} ${lastName}`.trim();

    return {
      firstName,
      lastName,
      name: fullName
    };
  } catch (_error) {
    return {};
  }
};

const normalizeAppleNamePayload = (value) => {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    return {
      name: value.trim()
    };
  }

  if (typeof value === 'object') {
    const firstName = String(value.firstName || value.givenName || '').trim();
    const lastName = String(value.lastName || value.familyName || '').trim();
    const explicitName = String(value.name || value.fullName || value.displayName || '').trim();

    return {
      firstName,
      lastName,
      name: explicitName || `${firstName} ${lastName}`.trim()
    };
  }

  return {};
};

const mapAppleCallbackErrorToReason = (error) => {
  const code = String(error?.code || '').trim();
  const message = String(error?.message || '').trim();

  if (code === 'APPLE_INVALID_CLIENT') return 'invalid_client';
  if (code === 'APPLE_INVALID_REDIRECT_URI') return 'invalid_redirect_uri';
  if (code === 'APPLE_TOKEN_EXCHANGE_FAILED') return 'token_exchange_failed';
  if (code === 'APPLE_ID_TOKEN_PARSE_FAILED') return 'id_token_parse_failed';
  if (code === 'APPLE_ID_TOKEN_INVALID') return 'invalid_id_token';
  if (code === 'APPLE_ID_TOKEN_AUDIENCE_MISMATCH') return 'invalid_audience';
  if (code === 'APPLE_ID_TOKEN_ISSUER_MISMATCH') return 'invalid_issuer';
  if (code === 'APPLE_PRIVATE_KEY_INVALID') return 'invalid_private_key';
  if (code === 'APPLE_PRIVATE_KEY_MISSING') return 'missing_private_key';
  if (code === 'APPLE_CLIENT_ID_MISSING') return 'missing_client_id';
  if (code === 'APPLE_TEAM_ID_MISSING') return 'missing_team_id';
  if (code === 'APPLE_KEY_ID_MISSING') return 'missing_key_id';
  if (code === 'APPLE_MISSING_EMAIL') return 'missing_email';
  if (code === 'APPLE_EMAIL_NOT_VERIFIED') return 'email_not_verified';
  if (code === 'APPLE_USER_CREATE_FAILED') return 'user_create_failed';
  if (code === 'APPLE_USER_RESOLUTION_FAILED') return 'user_resolution_failed';
  if (code === 'APPLE_AUTH_TOKEN_ISSUE_FAILED') return 'auth_token_issue_failed';
  if (code === 'FRONTEND_REDIRECT_RESOLUTION_FAILED') return 'redirect_build_failed';
  if (message === 'missing_email') return 'missing_email';
  if (message === 'email_not_verified') return 'email_not_verified';

  return 'unknown_callback_error';
};

const normalizeAppleCallbackStage = (value = 'callback_entry') => {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
  return normalized || 'callback_entry';
};

const resolveAppleCallbackReason = (error, stage = 'callback_entry') => {
  const mappedReason = mapAppleCallbackErrorToReason(error);
  if (mappedReason && mappedReason !== 'unknown_callback_error') {
    return mappedReason;
  }
  return `callback_exception_${normalizeAppleCallbackStage(stage)}`;
};

const failAppleCallback = (stage, reason, req, res, options = {}) => {
  const normalizedStage = normalizeAppleCallbackStage(stage);
  const sourceSurface = normalizeOauthSurfaceSource(options.sourceSurface || resolvePostLoginRedirectSurface(req, 'apple'));
  const envSnapshot = options.envSnapshot || buildAppleAuthEnvSnapshot(req, sourceSurface);
  const stateCookieOptions = options.stateCookieOptions || getAppleStateCookieOptions(req);
  const clientSecretDebug = options.clientSecretDebug || getAppleClientSecretDebugSnapshot(req);
  const exceptionName = String(options.error?.name || '').trim() || undefined;
  const exceptionMessage = String(options.error?.message || 'unknown_error').trim();

  console.error('APPLE_AUTH_FAIL_STAGE', normalizedStage);
  console.error('APPLE_AUTH_FAIL_REASON', reason);
  console.error('APPLE_AUTH_EXCEPTION_NAME', exceptionName || 'Error');
  console.error('APPLE_AUTH_EXCEPTION_MESSAGE', exceptionMessage);
  console.error('APPLE_AUTH_FAILURE', {
    stage: normalizedStage,
    reason,
    errorCode: String(options.error?.code || '').trim(),
    status: options.status,
    appleError: options.appleError,
    appleErrorDescription: options.appleErrorDescription,
    hasState: options.hasState,
    hasExpectedState: options.hasExpectedState,
    missingIdToken: options.missingIdToken,
    env: envSnapshot,
    clientSecretDebug
  });

  res.clearCookie(APPLE_OAUTH_STATE_COOKIE_NAME, stateCookieOptions);
  clearOauthSourceCookie(res, 'apple', stateCookieOptions);

  try {
    return redirectToFrontend(res, '/login', {
      error: 'apple_auth_failed',
      reason
    }, sourceSurface);
  } catch (redirectError) {
    const redirectReason = resolveAppleCallbackReason(redirectError, 'redirect_build');
    console.error('APPLE_AUTH_FAIL_STAGE', 'redirect_build');
    console.error('APPLE_AUTH_FAIL_REASON', redirectReason);
    console.error('APPLE_AUTH_EXCEPTION_NAME', String(redirectError?.name || 'Error'));
    console.error('APPLE_AUTH_EXCEPTION_MESSAGE', String(redirectError?.message || 'unknown_redirect_error'));
    return res.status(500).json({
      success: false,
      code: 'APPLE_AUTH_FAILED',
      reason: redirectReason
    });
  }
};

const hasAppleOAuthConfig = (req) => {
  const missing = [];
  const invalid = [];

  const clientId = String(process.env.APPLE_CLIENT_ID || '').trim();
  const teamId = String(process.env.APPLE_TEAM_ID || '').trim();
  const keyId = String(process.env.APPLE_KEY_ID || '').trim();
  const privateKey = normalizeMultilineSecret(process.env.APPLE_PRIVATE_KEY);
  const callbackConfig = getAppleCallbackConfig(req);

  if (!clientId) missing.push('APPLE_CLIENT_ID');
  if (!teamId) missing.push('APPLE_TEAM_ID');
  if (!keyId) missing.push('APPLE_KEY_ID');
  if (!privateKey) {
    missing.push('APPLE_PRIVATE_KEY');
  } else {
    if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
      invalid.push('APPLE_PRIVATE_KEY');
    }
  }

  if (!String(process.env.APPLE_REDIRECT_URI || '').trim()) {
    missing.push('APPLE_REDIRECT_URI');
  } else if (!callbackConfig.value) {
    invalid.push('APPLE_REDIRECT_URI');
  }

  return {
    ready: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    callbackSource: callbackConfig.source
  };
};

const exchangeAppleAuthorizationCode = async (code, redirectUri) => {
  const clientSecret = createAppleClientSecret();
  const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: String(process.env.APPLE_CLIENT_ID || '').trim(),
      client_secret: clientSecret
    })
  });

  if (!tokenResponse.ok) {
    const errorBody = await readSafeResponseBody(tokenResponse);
    const lowerCombined = `${errorBody.error} ${errorBody.error_description}`.toLowerCase();
    const error = new Error(
      lowerCombined.includes('invalid_client')
        ? 'APPLE_INVALID_CLIENT'
        : lowerCombined.includes('redirect_uri')
          ? 'APPLE_INVALID_REDIRECT_URI'
          : 'APPLE_TOKEN_EXCHANGE_FAILED'
    );
    error.code = error.message;
    error.meta = {
      status: tokenResponse.status,
      appleError: errorBody.error || '',
      appleErrorDescription: errorBody.error_description || ''
    };
    throw error;
  }

  return tokenResponse.json();
};

const resolveAppleProfileInput = (body = {}) => {
  const parsedUser = parseAppleUserProfile(body.user);
  const normalizedName = normalizeAppleNamePayload(body.name);
  const firstName = String(body.firstName || normalizedName.firstName || parsedUser.firstName || '').trim();
  const lastName = String(body.lastName || normalizedName.lastName || parsedUser.lastName || '').trim();
  const explicitName = String(normalizedName.name || parsedUser.name || '').trim();
  const fullName = explicitName || `${firstName} ${lastName}`.trim();

  return {
    firstName,
    lastName,
    name: fullName,
    email: normalizeEmail(body.email || '')
  };
};

const upsertAppleUser = async ({ email, emailVerified, appleProfile }) => {
  if (!email) {
    const error = new Error('missing_email');
    error.code = 'APPLE_MISSING_EMAIL';
    error.stage = 'user_resolve';
    throw error;
  }

  if (!emailVerified) {
    const error = new Error('email_not_verified');
    error.code = 'APPLE_EMAIL_NOT_VERIFIED';
    error.stage = 'user_resolve';
    throw error;
  }

  let user = await User.findOne({ email });
  let created = false;

  if (user) {
    const nextName = String(appleProfile.name || user.name || email.split('@')[0] || 'Kullanici').trim() || user.name;
    user.name = nextName;
    if (appleProfile.firstName && !user.firstName) {
      user.firstName = appleProfile.firstName;
    }
    if (appleProfile.lastName && !user.lastName) {
      user.lastName = appleProfile.lastName;
    }
    user.emailVerified = true;
    user.lastLoginAt = new Date();
    await user.save();
    return { user, created };
  }

  try {
    const generatedPassword = crypto.randomBytes(32).toString('hex');
    user = await User.create({
      name: String(appleProfile.name || email.split('@')[0] || 'Kullanici').trim() || 'Kullanici',
      firstName: appleProfile.firstName || undefined,
      lastName: appleProfile.lastName || undefined,
      email,
      emailVerified: true,
      password: generatedPassword,
      lastLoginAt: new Date()
    });
  } catch (createError) {
    createError.code = 'APPLE_USER_CREATE_FAILED';
    createError.stage = 'user_create';
    throw createError;
  }

  created = true;
  return { user, created };
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
        getAppleCallbackEnvValue()
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
  const sourceSurface = resolveAuthSourceSurface(req);
  const envSnapshot = buildGoogleAuthEnvSnapshot(req, sourceSurface);
  const requestHost = getHostFromUrl(envSnapshot.requestBaseUrl);
  const callbackHost = getHostFromUrl(envSnapshot.googleCallbackUrl);
  const stateCookieOptions = getGoogleStateCookieOptions(req);

  if (!isOauthConfigured('google')) {
    console.warn('GOOGLE_AUTH_START_FAIL', {
      reason: 'missing_google_env',
      env: envSnapshot
    });
    return res.status(501).json({ success: false, code: 'OAUTH_NOT_CONFIGURED' });
  }

  const callbackUrl = envSnapshot.googleCallbackUrl;
  if (!callbackUrl) {
    console.warn('GOOGLE_AUTH_START_FAIL', {
      reason: 'invalid_callback_url',
      env: envSnapshot
    });
    return res.status(500).json({ success: false, code: 'INVALID_CALLBACK_URL' });
  }

  if (requestHost && callbackHost && requestHost !== callbackHost) {
    console.warn('GOOGLE_AUTH_CONFIG_MISMATCH', {
      reason: 'request_host_callback_host_mismatch',
      requestHost,
      callbackHost,
      env: envSnapshot
    });
  }

  const state = crypto.randomBytes(24).toString('hex');
  res.cookie(GOOGLE_OAUTH_STATE_COOKIE_NAME, state, stateCookieOptions);
  setOauthSourceCookie(res, 'google', sourceSurface, stateCookieOptions);

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('prompt', 'select_account');

  console.info('GOOGLE_AUTH_START', {
    callbackUrl,
    frontendBaseUrl: envSnapshot.frontendBaseUrl,
    callbackUrlSource: envSnapshot.googleCallbackUrlSource,
    frontendBaseUrlSource: envSnapshot.frontendBaseUrlSource,
    requestBaseUrl: envSnapshot.requestBaseUrl,
    nodeEnv: envSnapshot.nodeEnv,
    stateCookieDomain: stateCookieOptions.domain || 'host_only',
    sourceSurface
  });

  return res.redirect(authUrl.toString());
};

export const oauthGoogleCallback = async (req, res) => {
  const sourceSurface = resolvePostLoginRedirectSurface(req, 'google');
  const envSnapshot = buildGoogleAuthEnvSnapshot(req, sourceSurface);
  const stateCookieOptions = getGoogleStateCookieOptions(req);
  const fail = (reason, meta = {}) => {
    console.error('GOOGLE_AUTH_FAILURE', {
      reason,
      ...meta,
      env: envSnapshot
    });
    res.clearCookie(GOOGLE_OAUTH_STATE_COOKIE_NAME, stateCookieOptions);
    clearOauthSourceCookie(res, 'google', stateCookieOptions);

    try {
      return redirectToFrontend(res, '/login', {
        error: 'google_auth_failed',
        reason
      }, sourceSurface);
    } catch (redirectError) {
      console.error('GOOGLE_AUTH_FAILURE', {
        reason: 'frontend_redirect_resolution_failed',
        sourceReason: reason,
        redirectError: redirectError?.message || 'unknown_redirect_error',
        env: envSnapshot
      });
      return res.status(500).json({
        success: false,
        code: 'GOOGLE_AUTH_FAILED',
        reason
      });
    }
  };

  if (!isOauthConfigured('google')) {
    return res.status(501).json({ success: false, code: 'OAUTH_NOT_CONFIGURED' });
  }

  console.info('GOOGLE_AUTH_CALLBACK_HIT', envSnapshot);

  const callbackUrl = envSnapshot.googleCallbackUrl;
  if (!callbackUrl) {
    return fail('invalid_redirect_uri', {
      stage: 'callback_url_resolution'
    });
  }

  const providerError = String(req.query?.error || '').trim();
  const code = String(req.query?.code || '').trim();
  const state = String(req.query?.state || '').trim();
  const expectedState = String(req.cookies?.[GOOGLE_OAUTH_STATE_COOKIE_NAME] || '').trim();

  if (providerError) {
    return fail(`provider_${providerError}`, {
      stage: 'provider_redirect'
    });
  }
  if (!code) {
    return fail('missing_code', {
      stage: 'callback_query_validation'
    });
  }
  if (!state || !expectedState || state !== expectedState) {
    return fail('invalid_state', {
      stage: 'state_validation',
      hasState: Boolean(state),
      hasExpectedState: Boolean(expectedState)
    });
  }

  console.info('GOOGLE_AUTH_STATE_VALIDATED', {
    callbackUrl,
    callbackUrlSource: envSnapshot.googleCallbackUrlSource,
    sourceSurface
  });
  res.clearCookie(GOOGLE_OAUTH_STATE_COOKIE_NAME, stateCookieOptions);
  clearOauthSourceCookie(res, 'google', stateCookieOptions);

  try {
    console.info('GOOGLE_AUTH_TOKEN_EXCHANGE_START', {
      redirectUri: callbackUrl
    });
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
      const errorBody = await readSafeResponseBody(tokenResponse);
      const lowerCombined = `${errorBody.error} ${errorBody.error_description}`.toLowerCase();
      const reason = lowerCombined.includes('redirect_uri')
        ? 'invalid_redirect_uri'
        : 'token_exchange_failed';

      return fail(reason, {
        stage: 'token_exchange',
        status: tokenResponse.status,
        googleError: errorBody.error || '',
        googleErrorDescription: errorBody.error_description || '',
        redirectUri: callbackUrl
      });
    }

    console.info('GOOGLE_AUTH_TOKEN_EXCHANGE_OK', {
      redirectUri: callbackUrl
    });
    const tokenData = await tokenResponse.json();
    const idToken = String(tokenData.id_token || '').trim();
    const accessToken = String(tokenData.access_token || '').trim();
    if (!idToken || !accessToken) {
      return fail('token_exchange_failed', {
        stage: 'token_exchange',
        missingIdToken: !idToken,
        missingAccessToken: !accessToken
      });
    }

    console.info('GOOGLE_AUTH_ID_TOKEN_VALIDATION_START');
    const idTokenPayload = await verifyGoogleIdToken(idToken);
    console.info('GOOGLE_AUTH_ID_TOKEN_VALIDATION_OK', {
      emailPresent: Boolean(idTokenPayload?.email)
    });
    const userInfo = await fetchGoogleUserInfo(accessToken);
    console.info('GOOGLE_AUTH_USERINFO_OK', {
      emailPresent: Boolean(userInfo?.email)
    });
    const email = normalizeEmail(userInfo.email || idTokenPayload.email);
    const emailVerified =
      String(userInfo.email_verified || idTokenPayload.email_verified || '').toLowerCase() === 'true';

    if (!email) {
      return fail('missing_email', {
        stage: 'userinfo_validation'
      });
    }
    if (!emailVerified) {
      return fail('email_not_verified', {
        stage: 'userinfo_validation',
        email: maskEmailForLog(email)
      });
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
      try {
        const generatedPassword = crypto.randomBytes(32).toString('hex');
        user = await User.create({
          name: String(userInfo.name || email.split('@')[0] || 'Kullanici').trim() || 'Kullanici',
          email,
          emailVerified: true,
          avatarUrl: String(userInfo.picture || '').trim() || undefined,
          password: generatedPassword,
          lastLoginAt: new Date()
        });
      } catch (createError) {
        createError.code = 'GOOGLE_USER_CREATE_FAILED';
        throw createError;
      }
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

    return redirectToFrontend(res, '/auth/callback', { token }, sourceSurface);
  } catch (error) {
    const reason = mapGoogleCallbackErrorToReason(error);
    return fail(reason, {
      stage: 'callback_exception',
      errorCode: String(error?.code || '').trim(),
      errorMessage: String(error?.message || 'unknown_error').trim()
    });
  }
};

export const oauthApple = async (_req, res) => {
  const req = _req;
  const sourceSurface = resolveAuthSourceSurface(req);
  const envSnapshot = buildAppleAuthEnvSnapshot(req, sourceSurface);
  const appleConfig = hasAppleOAuthConfig(req);
  const requestHost = getHostFromUrl(envSnapshot.requestBaseUrl);
  const callbackHost = getHostFromUrl(envSnapshot.appleCallbackUrl);
  const stateCookieOptions = getAppleStateCookieOptions(req);
  const clientSecretDebug = getAppleClientSecretDebugSnapshot(req);

  if (!appleConfig.ready) {
    console.warn('APPLE_AUTH_START_FAIL', {
      reason: 'missing_apple_env',
      env: envSnapshot,
      missing: appleConfig.missing,
      invalid: appleConfig.invalid,
      clientSecretDebug
    });
    return res.status(501).json({
      success: false,
      code: 'OAUTH_NOT_CONFIGURED',
      missing: appleConfig.missing,
      invalid: appleConfig.invalid,
      diagnostics: clientSecretDebug
    });
  }

  const callbackUrl = envSnapshot.appleCallbackUrl;
  if (!callbackUrl) {
    console.warn('APPLE_AUTH_START_FAIL', {
      reason: 'invalid_callback_url',
      env: envSnapshot
    });
    return res.status(500).json({ success: false, code: 'INVALID_CALLBACK_URL' });
  }

  if (requestHost && callbackHost && requestHost !== callbackHost) {
    console.warn('APPLE_AUTH_CONFIG_MISMATCH', {
      reason: 'request_host_callback_host_mismatch',
      requestHost,
      callbackHost,
      env: envSnapshot
    });
  }

  const state = crypto.randomBytes(24).toString('hex');
  res.cookie(APPLE_OAUTH_STATE_COOKIE_NAME, state, stateCookieOptions);
  setOauthSourceCookie(res, 'apple', sourceSurface, stateCookieOptions);

  const authUrl = new URL('https://appleid.apple.com/auth/authorize');
  authUrl.searchParams.set('client_id', String(process.env.APPLE_CLIENT_ID || '').trim());
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('response_mode', 'form_post');
  authUrl.searchParams.set('scope', 'name email');
  authUrl.searchParams.set('state', state);

  console.info('APPLE_AUTH_START', {
    callbackUrl,
    frontendBaseUrl: envSnapshot.frontendBaseUrl,
    callbackUrlSource: envSnapshot.appleCallbackUrlSource,
    frontendBaseUrlSource: envSnapshot.frontendBaseUrlSource,
    requestBaseUrl: envSnapshot.requestBaseUrl,
    nodeEnv: envSnapshot.nodeEnv,
    stateCookieDomain: stateCookieOptions.domain || 'host_only',
    sourceSurface,
    clientSecretDebug
  });

  return res.redirect(authUrl.toString());
};

export const oauthAppleTokenLogin = async (req, res) => {
  const appleConfig = hasAppleOAuthConfig(req);
  const clientSecretDebug = getAppleClientSecretDebugSnapshot(req);
  if (!appleConfig.ready) {
    return res.status(501).json({
      success: false,
      code: 'OAUTH_NOT_CONFIGURED',
      missing: appleConfig.missing,
      invalid: appleConfig.invalid,
      diagnostics: clientSecretDebug
    });
  }

  const callbackUrl = getAppleCallbackUrl(req);
  if (!callbackUrl) {
    return res.status(500).json({ success: false, code: 'INVALID_CALLBACK_URL' });
  }

  const body = req.body || {};
  const identityToken = String(body.identityToken || body.idToken || '').trim();
  const authorizationCode = String(body.authorizationCode || body.code || '').trim();

  if (!identityToken && !authorizationCode) {
    return res.status(400).json({
      success: false,
      code: 'APPLE_TOKEN_MISSING',
      message: 'identityToken veya authorizationCode zorunludur.'
    });
  }

  try {
    let resolvedIdentityToken = identityToken;

    if (!resolvedIdentityToken && authorizationCode) {
      const tokenData = await exchangeAppleAuthorizationCode(authorizationCode, callbackUrl);
      resolvedIdentityToken = String(tokenData.id_token || '').trim();
      if (!resolvedIdentityToken) {
        return res.status(502).json({
          success: false,
          code: 'APPLE_TOKEN_EXCHANGE_FAILED',
          message: 'Apple token exchange id_token donmedi.'
        });
      }
    }

    const idTokenPayload = await verifyAppleIdToken(resolvedIdentityToken);
    const profileInput = resolveAppleProfileInput(body);
    const email = normalizeEmail(idTokenPayload.email || profileInput.email);
    const emailVerified =
      String(idTokenPayload.email_verified || '').toLowerCase() === 'true' || Boolean(profileInput.email);

    const { user } = await upsertAppleUser({
      email,
      emailVerified,
      appleProfile: profileInput
    });

    return sendAuthResponse(res, 200, user);
  } catch (error) {
    const reason = mapAppleCallbackErrorToReason(error);
    const statusCode =
      reason === 'missing_email' || reason === 'email_not_verified' || reason === 'invalid_audience' || reason === 'invalid_issuer' || reason === 'invalid_id_token' || reason === 'invalid_client'
        ? 400
        : reason === 'token_exchange_failed' || reason === 'invalid_redirect_uri' || reason === 'invalid_private_key'
          ? 502
          : 500;

    return res.status(statusCode).json({
      success: false,
      code: String(error?.code || 'APPLE_AUTH_FAILED').trim() || 'APPLE_AUTH_FAILED',
      reason,
      message: 'Apple ile giris tamamlanamadi.',
      diagnostics: clientSecretDebug
    });
  }
};

export const oauthAppleCallback = async (req, res) => {
  const sourceSurface = resolvePostLoginRedirectSurface(req, 'apple');
  const envSnapshot = buildAppleAuthEnvSnapshot(req, sourceSurface);
  const appleConfig = hasAppleOAuthConfig(req);
  const stateCookieOptions = getAppleStateCookieOptions(req);
  const clientSecretDebug = getAppleClientSecretDebugSnapshot(req);
  const fail = (stage, reason, options = {}) =>
    failAppleCallback(stage, reason, req, res, {
      sourceSurface,
      envSnapshot,
      stateCookieOptions,
      clientSecretDebug,
      ...options
    });

  if (!appleConfig.ready) {
    return res.status(501).json({
      success: false,
      code: 'OAUTH_NOT_CONFIGURED',
      missing: appleConfig.missing,
      invalid: appleConfig.invalid,
      diagnostics: clientSecretDebug
    });
  }

  console.info('APPLE_AUTH_CALLBACK_HIT', envSnapshot);

  const callbackUrl = envSnapshot.appleCallbackUrl;
  if (!callbackUrl) {
    return fail('callback_entry', 'invalid_redirect_uri');
  }

  const body = req.body || {};
  const query = req.query || {};
  const providerError = String(body.error || query.error || '').trim();
  const code = String(body.code || query.code || '').trim();
  const state = String(body.state || query.state || '').trim();
  const expectedState = String(req.cookies?.[APPLE_OAUTH_STATE_COOKIE_NAME] || '').trim();

  console.info('APPLE_AUTH_CODE_PRESENT', {
    hasCode: Boolean(code),
    sourceSurface
  });

  if (providerError) {
    return fail('code_read', `provider_${providerError}`);
  }
  if (!code) {
    return fail('code_read', 'missing_code');
  }
  if (!state || !expectedState || state !== expectedState) {
    return fail('code_read', 'invalid_state', {
      hasState: Boolean(state),
      hasExpectedState: Boolean(expectedState)
    });
  }

  console.info('APPLE_AUTH_STATE_VALIDATED', {
    callbackUrl,
    callbackUrlSource: envSnapshot.appleCallbackUrlSource,
    sourceSurface
  });
  res.clearCookie(APPLE_OAUTH_STATE_COOKIE_NAME, stateCookieOptions);
  clearOauthSourceCookie(res, 'apple', stateCookieOptions);

  try {
    console.info('APPLE_AUTH_TOKEN_EXCHANGE_START', {
      redirectUri: callbackUrl
    });
    let tokenData;
    try {
      tokenData = await exchangeAppleAuthorizationCode(code, callbackUrl);
    } catch (exchangeError) {
      exchangeError.stage = 'token_exchange';
      throw exchangeError;
    }
    console.info('APPLE_AUTH_TOKEN_EXCHANGE_OK', {
      redirectUri: callbackUrl
    });
    const idToken = String(tokenData.id_token || '').trim();
    if (!idToken) {
      return fail('id_token_extract', 'token_exchange_failed', {
        missingIdToken: true
      });
    }

    const decodedIdToken = jwt.decode(idToken, { complete: true });
    if (!decodedIdToken?.payload) {
      const parseError = new Error('APPLE_ID_TOKEN_PARSE_FAILED');
      parseError.code = 'APPLE_ID_TOKEN_PARSE_FAILED';
      parseError.stage = 'id_token_extract';
      throw parseError;
    }

    console.info('APPLE_AUTH_ID_TOKEN_PARSED', {
      hasKeyId: Boolean(decodedIdToken?.header?.kid),
      hasEmailClaim: Boolean(decodedIdToken?.payload?.email)
    });

    console.info('APPLE_AUTH_ID_TOKEN_VALIDATION_START');
    let idTokenPayload;
    try {
      idTokenPayload = await verifyAppleIdToken(idToken);
    } catch (verifyError) {
      verifyError.stage = 'id_token_verify';
      throw verifyError;
    }
    console.info('APPLE_AUTH_ID_TOKEN_VALIDATION_OK', {
      emailPresent: Boolean(idTokenPayload?.email)
    });

    const profileInput = resolveAppleProfileInput(body);
    const email = normalizeEmail(idTokenPayload.email || profileInput.email);
    const emailVerified =
      String(idTokenPayload.email_verified || '').toLowerCase() === 'true' || Boolean(profileInput.email);
    let userResolution;
    try {
      userResolution = await upsertAppleUser({
        email,
        emailVerified,
        appleProfile: profileInput
      });
    } catch (userError) {
      if (!String(userError?.code || '').trim()) {
        userError.code = 'APPLE_USER_RESOLUTION_FAILED';
        userError.stage = 'user_resolve';
      }
      throw userError;
    }

    const { user, created } = userResolution;
    console.info('APPLE_AUTH_USER_RESOLVED', {
      userId: String(user?._id || ''),
      created
    });

    let token = '';
    try {
      token = issueAuthToken(res, user);
    } catch (tokenError) {
      tokenError.code = 'APPLE_AUTH_TOKEN_ISSUE_FAILED';
      tokenError.stage = 'token_issue';
      throw tokenError;
    }
    console.info('APPLE_AUTH_TOKEN_ISSUED', {
      userId: String(user._id),
      created
    });

    console.info('APPLE_AUTH_REDIRECT_READY', {
      path: '/auth/callback',
      sourceSurface
    });

    try {
      return redirectToFrontend(res, '/auth/callback', { token }, sourceSurface);
    } catch (redirectError) {
      redirectError.stage = 'redirect_build';
      throw redirectError;
    }
  } catch (error) {
    const exchangeMeta = error?.meta || {};
    const stage = error?.stage || 'callback_entry';
    const reason = resolveAppleCallbackReason(error, stage);
    return fail(stage, reason, {
      error,
      status: exchangeMeta.status,
      appleError: exchangeMeta.appleError,
      appleErrorDescription: exchangeMeta.appleErrorDescription
    });
  }
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
