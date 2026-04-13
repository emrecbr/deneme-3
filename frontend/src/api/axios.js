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
export const API_BASE_URL =
  ENV_API_BASE ||
  getSurfaceBaseUrl('api') ||
  (import.meta.env.DEV ? DEV_FALLBACK : PROD_FALLBACK);

export const buildProviderAuthUrl = (provider) => {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  if (!normalizedProvider) {
    return '/api/auth/google';
  }

  if (import.meta.env.DEV) {
    return `${API_BASE_URL}/auth/${normalizedProvider}`;
  }

  const browserOrigin = getBrowserOrigin();
  const activeSurface = resolveSurfaceLabelFromHostname(getBrowserHostname());
  if (browserOrigin) {
    if (activeSurface === SURFACE_LABELS.web || activeSurface === SURFACE_LABELS.admin || activeSurface === SURFACE_LABELS.app) {
      return `${browserOrigin}/api/auth/${normalizedProvider}`;
    }
    return `${browserOrigin}/api/auth/${normalizedProvider}`;
  }

  const configuredAppSurface = buildSurfaceHref('app', '/');
  if (configuredAppSurface && configuredAppSurface !== '/') {
    try {
      const appOrigin = new URL(configuredAppSurface).origin;
      return `${appOrigin}/api/auth/${normalizedProvider}`;
    } catch (_error) {
      // ignore malformed config and continue with relative fallback
    }
  }

  return `/api/auth/${normalizedProvider}`;
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
