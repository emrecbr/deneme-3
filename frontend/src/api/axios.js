import axios from 'axios';
import { buildSurfaceHref, getBrowserOrigin, getBrowserHostname, getSurfaceBaseUrl, resolveSurfaceLabelFromHostname, SURFACE_LABELS } from '../config/surfaces';

let unauthorizedHandler = null;

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
};

const ENV_API_BASE = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
const DEV_FALLBACK = 'http://localhost:3001/api';
const PROD_FALLBACK = '/api';
const isLocalhost = (value) => /^https?:\/\/localhost(?::\d+)?\/api$/.test(String(value || '').trim());
const isAbsoluteHttpUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());
const hasProxyPlaceholder = (value) => String(value || '').includes(':splat');
export const API_BASE_URL =
  ENV_API_BASE ||
  getSurfaceBaseUrl('api') ||
  (import.meta.env.DEV ? DEV_FALLBACK : PROD_FALLBACK);

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

if (import.meta.env.DEV) {
  console.log('VITE_API_URL', import.meta.env.VITE_API_URL);
} else if (!ENV_API_BASE) {
  console.warn('VITE_API_URL missing in prod build; falling back to same-origin /api.');
} else if (isLocalhost(ENV_API_BASE)) {
  console.warn('VITE_API_URL is localhost in prod build; this will likely fail.');
}

const api = axios.create({
  baseURL: API_BASE_URL
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  config.headers = config.headers || {};
  config.headers['Cache-Control'] = 'no-cache';

  if (token) {
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
