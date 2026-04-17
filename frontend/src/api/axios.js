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

export const buildProviderAuthUrl = (provider) => {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  const sourceQuery = resolveOauthSourceQuery();
  if (!normalizedProvider) {
    return appendSourceQuery('/api/auth/google', sourceQuery);
  }

  if (import.meta.env.DEV) {
    return appendSourceQuery(`${API_BASE_URL}/auth/${normalizedProvider}`, sourceQuery);
  }

  const configuredAbsoluteApiBase = buildAbsoluteProviderUrl(ENV_API_BASE, normalizedProvider);
  if (configuredAbsoluteApiBase) {
    return appendSourceQuery(configuredAbsoluteApiBase, sourceQuery);
  }

  const surfaceApiBase = buildAbsoluteProviderUrl(getSurfaceBaseUrl('api'), normalizedProvider);
  if (surfaceApiBase) {
    return appendSourceQuery(surfaceApiBase, sourceQuery);
  }

  const activeSurface = resolveSurfaceLabelFromHostname(getBrowserHostname());
  if (
    activeSurface === SURFACE_LABELS.web ||
    activeSurface === SURFACE_LABELS.app ||
    activeSurface === SURFACE_LABELS.admin
  ) {
    return appendSourceQuery(`https://api.talepet.net.tr/api/auth/${normalizedProvider}`, sourceQuery);
  }

  const browserOrigin = getBrowserOrigin();
  const browserOriginApiBase = buildAbsoluteProviderUrl(browserOrigin, normalizedProvider);
  if (browserOriginApiBase) {
    return appendSourceQuery(browserOriginApiBase, sourceQuery);
  }

  const configuredAppSurface = buildSurfaceHref('app', '/');
  if (configuredAppSurface && configuredAppSurface !== '/') {
    try {
      const appOrigin = new URL(configuredAppSurface).origin;
      const appOriginApiBase = buildAbsoluteProviderUrl(appOrigin, normalizedProvider);
      if (appOriginApiBase) {
        return appendSourceQuery(appOriginApiBase, sourceQuery);
      }
    } catch (_error) {
      // ignore malformed config and continue with relative fallback
    }
  }

  return appendSourceQuery(`/api/auth/${normalizedProvider}`, sourceQuery);
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
