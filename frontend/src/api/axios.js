import axios from 'axios';
import {
  buildSurfaceHref,
  getBrowserOrigin,
  getBrowserHostname,
  getSurfaceBaseUrl,
  resolveSurfaceLabelFromHostname,
  SURFACE_LABELS
} from '../config/surfaces';

let unauthorizedHandler = null;

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
};

const ENV_API_BASE = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
const DEV_FALLBACK = 'http://localhost:3001/api';
const PROD_FALLBACK = 'https://api.talepet.net.tr/api';
const OAUTH_WAKE_TIMEOUT_MS = 6000;
const OAUTH_WAKE_RETRY_DELAYS_MS = [0, 3000, 5000];
const isLocalhost = (value) => /^https?:\/\/localhost(?::\d+)?\/api$/.test(String(value || '').trim());
const isAbsoluteHttpUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());
const hasProxyPlaceholder = (value) => String(value || '').includes(':splat');
const normalizeApiBase = (value) => String(value || '').trim().replace(/\/$/, '');
const isUsableApiBase = (value) => {
  const normalized = normalizeApiBase(value);
  return Boolean(normalized) && !hasProxyPlaceholder(normalized) && isAbsoluteHttpUrl(normalized);
};
const safeReadStorage = (storage, key) => {
  if (!storage) {
    return '';
  }

  try {
    return storage.getItem(key) || '';
  } catch (_error) {
    return '';
  }
};

const safeRemoveStorageKey = (storage, key) => {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch (_error) {
    // Ignore storage issues on restricted browsers.
  }
};

const decodeJwtPayload = (token) => {
  const normalizedToken = String(token || '').trim();
  const parts = normalizedToken.split('.');

  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const decoded = typeof atob === 'function' ? atob(padded) : '';
    return decoded ? JSON.parse(decoded) : null;
  } catch (_error) {
    return null;
  }
};

const isAdminScopedToken = (token) => {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  if (payload.isAdmin === true) {
    return true;
  }

  if (Array.isArray(payload.roles) && payload.roles.includes('admin')) {
    return true;
  }

  return payload.role === 'admin' || payload.role === 'moderator';
};

const resolveApiBaseUrl = () => {
  const hostSurface = resolveSurfaceLabelFromHostname(getBrowserHostname());
  const candidateList = [ENV_API_BASE, getSurfaceBaseUrl('api')]
    .map(normalizeApiBase)
    .filter((value) => isUsableApiBase(value) && (import.meta.env.DEV || !isLocalhost(value)));

  if (import.meta.env.DEV) {
    return candidateList[0] || DEV_FALLBACK;
  }

  if (
    hostSurface === SURFACE_LABELS.web ||
    hostSurface === SURFACE_LABELS.app ||
    hostSurface === SURFACE_LABELS.admin
  ) {
    return candidateList[0] || PROD_FALLBACK;
  }

  return candidateList[0] || PROD_FALLBACK;
};

export const API_BASE_URL = resolveApiBaseUrl();
export const sanitizeNonAdminSurfaceAuthState = () => {
  const hostSurface = resolveSurfaceLabelFromHostname(getBrowserHostname());

  if (hostSurface === SURFACE_LABELS.admin || typeof window === 'undefined') {
    return;
  }

  const localStorageRef = window.localStorage;
  const sessionStorageRef = window.sessionStorage;
  const adminToken = safeReadStorage(localStorageRef, 'admin_token');
  const userToken = safeReadStorage(localStorageRef, 'token');

  safeRemoveStorageKey(localStorageRef, 'admin_token');
  safeRemoveStorageKey(sessionStorageRef, 'admin_token');

  if (userToken && (userToken === adminToken || isAdminScopedToken(userToken))) {
    safeRemoveStorageKey(localStorageRef, 'token');
    safeRemoveStorageKey(localStorageRef, 'authToken');
    safeRemoveStorageKey(localStorageRef, 'accessToken');
    safeRemoveStorageKey(localStorageRef, 'userName');
    safeRemoveStorageKey(sessionStorageRef, 'token');
    safeRemoveStorageKey(sessionStorageRef, 'authToken');
    safeRemoveStorageKey(sessionStorageRef, 'accessToken');
  }
};

export const readUserAccessToken = () => {
  sanitizeNonAdminSurfaceAuthState();

  if (typeof window === 'undefined') {
    return '';
  }

  return safeReadStorage(window.localStorage, 'token');
};

export const buildApiUrl = (path = '') => {
  const normalizedPath = String(path || '').trim();
  if (!normalizedPath) {
    return API_BASE_URL;
  }
  return normalizedPath.startsWith('/') ? `${API_BASE_URL}${normalizedPath}` : `${API_BASE_URL}/${normalizedPath}`;
};

const buildAbsoluteProviderUrl = (baseUrl, provider) => {
  const normalizedBase = String(baseUrl || '').trim().replace(/\/$/, '');
  if (!normalizedBase || hasProxyPlaceholder(normalizedBase) || !isAbsoluteHttpUrl(normalizedBase)) {
    return '';
  }
  const apiBase = normalizedBase.endsWith('/api') ? normalizedBase : `${normalizedBase}/api`;
  return `${apiBase}/auth/${provider}`;
};

const resolveOauthSourceQuery = () => {
  const activeSurface = resolveSurfaceLabelFromHostname(getBrowserHostname());
  if (activeSurface === SURFACE_LABELS.web) {
    return 'web';
  }
  if (activeSurface === SURFACE_LABELS.admin) {
    return 'admin';
  }
  return 'app';
};

const appendSourceQuery = (url, source) => {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) {
    return normalizedUrl;
  }

  const sourceValue = String(source || '').trim();
  if (!sourceValue) {
    return normalizedUrl;
  }

  try {
    const parsed = isAbsoluteHttpUrl(normalizedUrl)
      ? new URL(normalizedUrl)
      : new URL(normalizedUrl, getBrowserOrigin() || 'http://localhost');
    parsed.searchParams.set('source', sourceValue);

    if (isAbsoluteHttpUrl(normalizedUrl)) {
      return parsed.toString();
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (_error) {
    const separator = normalizedUrl.includes('?') ? '&' : '?';
    return `${normalizedUrl}${separator}source=${encodeURIComponent(sourceValue)}`;
  }
};

const appendSocialReturnQuery = (url, params = {}) => {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) {
    return normalizedUrl;
  }

  try {
    const parsed = isAbsoluteHttpUrl(normalizedUrl)
      ? new URL(normalizedUrl)
      : new URL(normalizedUrl, getBrowserOrigin() || 'http://localhost');

    Object.entries(params).forEach(([key, value]) => {
      if (value != null && String(value).trim()) {
        parsed.searchParams.set(key, String(value).trim());
      }
    });

    if (isAbsoluteHttpUrl(normalizedUrl)) {
      return parsed.toString();
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (_error) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value != null && String(value).trim()) {
        query.set(key, String(value).trim());
      }
    });
    if (!query.toString()) {
      return normalizedUrl;
    }
    const separator = normalizedUrl.includes('?') ? '&' : '?';
    return `${normalizedUrl}${separator}${query.toString()}`;
  }
};

export const rememberSocialLoginReturnTarget = () => {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return;
  }

  const origin = getBrowserOrigin();
  const pathname = window.location?.pathname || '/';
  const search = window.location?.search || '';
  const hash = window.location?.hash || '';
  const surface = resolveOauthSourceQuery();

  window.sessionStorage.setItem(
    'talepet_social_return',
    JSON.stringify({
      returnTo: origin,
      returnPath: `${pathname}${search}${hash}`,
      returnSurface: surface
    })
  );
};

export const readSocialLoginReturnTarget = () => {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null;
  }

  const raw = window.sessionStorage.getItem('talepet_social_return');
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
};

export const clearSocialLoginReturnTarget = () => {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return;
  }
  window.sessionStorage.removeItem('talepet_social_return');
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const getHeaderValue = (headers, key) => {
  if (!headers || !key) {
    return '';
  }

  if (typeof headers.get === 'function') {
    return headers.get(key) || '';
  }

  const normalizedKey = String(key).toLowerCase();
  return headers[normalizedKey] || headers[key] || '';
};

const resolveRetryDelayMs = (headers, fallbackMs) => {
  const retryAfterValue = Number.parseInt(getHeaderValue(headers, 'retry-after'), 10);
  if (Number.isFinite(retryAfterValue) && retryAfterValue > 0) {
    return clamp(retryAfterValue * 1000, 2000, 6000);
  }
  return fallbackMs;
};

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const warmApiForInteractiveAuth = async ({ provider = 'google', onStatus } = {}) => {
  const normalizedProvider = String(provider || 'google').trim().toLowerCase();
  const targetUrl = buildApiUrl('/health');

  for (let attempt = 0; attempt < OAUTH_WAKE_RETRY_DELAYS_MS.length; attempt += 1) {
    if (attempt > 0) {
      onStatus?.('Sunucu uyaniyor, tekrar deneniyor...', { phase: 'retry', attempt: attempt + 1 });
      await wait(OAUTH_WAKE_RETRY_DELAYS_MS[attempt]);
    } else {
      onStatus?.('Sunucu kontrol ediliyor...', { phase: 'start', attempt: 1 });
    }

    try {
      const response = await api.get(
        '/health',
        buildPublicRequestConfig({
          timeout: OAUTH_WAKE_TIMEOUT_MS
        })
      );

      if (import.meta.env.DEV) {
        console.info('OAUTH_WAKE_OK', {
          provider: normalizedProvider,
          url: targetUrl,
          attempt: attempt + 1,
          status: response.status
        });
      }

      return { ok: true };
    } catch (error) {
      const status = error?.response?.status || 0;
      const headers = error?.response?.headers;
      const renderRouting = getHeaderValue(headers, 'x-render-routing');
      const retryDelayMs = resolveRetryDelayMs(headers, OAUTH_WAKE_RETRY_DELAYS_MS[attempt] || 3000);

      if (import.meta.env.DEV) {
        console.warn('OAUTH_WAKE_FAIL', {
          provider: normalizedProvider,
          url: targetUrl,
          attempt: attempt + 1,
          status,
          renderRouting,
          retryAfter: getHeaderValue(headers, 'retry-after'),
          message: error?.message || error
        });
      }

      if (status === 503 && renderRouting === 'hibernate-pending-wake' && attempt < OAUTH_WAKE_RETRY_DELAYS_MS.length - 1) {
        onStatus?.('Sunucu uyaniyor, tekrar deneniyor...', {
          phase: 'hibernate',
          attempt: attempt + 1,
          retryDelayMs
        });
        await wait(retryDelayMs);
        continue;
      }

      if ((!error?.response || error?.code === 'ECONNABORTED') && attempt < OAUTH_WAKE_RETRY_DELAYS_MS.length - 1) {
        onStatus?.('Baglanti kuruluyor, tekrar deneniyor...', {
          phase: 'network_retry',
          attempt: attempt + 1,
          retryDelayMs
        });
        await wait(retryDelayMs);
        continue;
      }

      return {
        ok: false,
        status,
        renderRouting,
        retryAfter: getHeaderValue(headers, 'retry-after'),
        error
      };
    }
  }

  return { ok: false, status: 0, renderRouting: '', retryAfter: '', error: null };
};

export const buildProviderAuthUrl = (provider) => {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  const sourceQuery = resolveOauthSourceQuery();
  const returnTo = getBrowserOrigin();
  const returnSurface = sourceQuery;
  if (!normalizedProvider) {
    return appendSocialReturnQuery(appendSourceQuery('/api/auth/google', sourceQuery), {
      returnTo,
      returnSurface
    });
  }

  if (import.meta.env.DEV) {
    return appendSocialReturnQuery(
      appendSourceQuery(`${API_BASE_URL}/auth/${normalizedProvider}`, sourceQuery),
      { returnTo, returnSurface }
    );
  }

  const configuredAbsoluteApiBase = buildAbsoluteProviderUrl(ENV_API_BASE, normalizedProvider);
  if (configuredAbsoluteApiBase) {
    return appendSocialReturnQuery(appendSourceQuery(configuredAbsoluteApiBase, sourceQuery), {
      returnTo,
      returnSurface
    });
  }

  const surfaceApiBase = buildAbsoluteProviderUrl(getSurfaceBaseUrl('api'), normalizedProvider);
  if (surfaceApiBase) {
    return appendSocialReturnQuery(appendSourceQuery(surfaceApiBase, sourceQuery), {
      returnTo,
      returnSurface
    });
  }

  const activeSurface = resolveSurfaceLabelFromHostname(getBrowserHostname());
  if (
    activeSurface === SURFACE_LABELS.web ||
    activeSurface === SURFACE_LABELS.app ||
    activeSurface === SURFACE_LABELS.admin
  ) {
    return appendSocialReturnQuery(
      appendSourceQuery(`https://api.talepet.net.tr/api/auth/${normalizedProvider}`, sourceQuery),
      { returnTo, returnSurface }
    );
  }

  const browserOrigin = getBrowserOrigin();
  const browserOriginApiBase = buildAbsoluteProviderUrl(browserOrigin, normalizedProvider);
  if (browserOriginApiBase) {
    return appendSocialReturnQuery(appendSourceQuery(browserOriginApiBase, sourceQuery), {
      returnTo,
      returnSurface
    });
  }

  const configuredAppSurface = buildSurfaceHref('app', '/');
  if (configuredAppSurface && configuredAppSurface !== '/') {
    try {
      const appOrigin = new URL(configuredAppSurface).origin;
      const appOriginApiBase = buildAbsoluteProviderUrl(appOrigin, normalizedProvider);
      if (appOriginApiBase) {
        return appendSocialReturnQuery(appendSourceQuery(appOriginApiBase, sourceQuery), {
          returnTo,
          returnSurface
        });
      }
    } catch (_error) {
      // ignore malformed config and continue with relative fallback
    }
  }

  return appendSocialReturnQuery(appendSourceQuery(`/api/auth/${normalizedProvider}`, sourceQuery), {
    returnTo,
    returnSurface
  });
};

export const buildProtectedRequestConfig = (overrides = {}) => ({
  withCredentials: true,
  skipUnauthorizedRedirect: true,
  ...overrides
});

export const buildPublicRequestConfig = (overrides = {}) => ({
  skipUnauthorizedRedirect: true,
  skipAuthHeader: true,
  ...overrides
});

if (import.meta.env.DEV) {
  console.log('VITE_API_URL', import.meta.env.VITE_API_URL);
} else if (!ENV_API_BASE) {
  console.warn(`VITE_API_URL missing in prod build; falling back to ${API_BASE_URL}.`);
} else if (isLocalhost(ENV_API_BASE)) {
  console.warn('VITE_API_URL is localhost in prod build; this will likely fail.');
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000
});

api.interceptors.request.use((config) => {
  const token = readUserAccessToken();

  config.headers = config.headers || {};
  if (config.useNoCacheHeader) {
    config.headers['Cache-Control'] = 'no-cache';
  }

  if (token && !config.skipAuthHeader) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && unauthorizedHandler && !error?.config?.skipUnauthorizedRedirect) {
      unauthorizedHandler();
    }
    return Promise.reject(error);
  }
);

export default api;
