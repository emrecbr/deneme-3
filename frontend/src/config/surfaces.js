export const trimTrailingSlash = (value) => String(value || '').trim().replace(/\/$/, '');
const trimLeadingSlash = (value) => String(value || '').trim().replace(/^\/+/, '');
const normalizePath = (value = '/') => {
  const text = String(value || '/').trim();
  if (!text || text === '/') return '/';
  return `/${trimLeadingSlash(text)}`;
};
const normalizeHostname = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');

export const WEB_HOME_PATH = '/';
export const APP_HOME_PATH = '/app';
export const LEGACY_APP_HOME_PATH = '/';
export const PROFILE_HOME_PATH = '/profile';
export const ADMIN_HOME_PATH = '/admin';
export const APP_LOGIN_PATH = '/login';
export const APP_REGISTER_PATH = '/register';
export const APP_AUTH_CALLBACK_PATH = '/auth/callback';
export const APP_RESET_PASSWORD_PATH = '/reset-password';
export const APP_EMAIL_VERIFY_PATH = '/email-verify';
export const PUBLIC_WEB_PATHS = [
  WEB_HOME_PATH,
  '/hakkimizda',
  '/gizlilik-sozlesmesi',
  '/mesafeli-satis-sozlesmesi',
  '/teslimat-ve-iade',
  '/iletisim'
];

export const getBrowserOrigin = () =>
  typeof window !== 'undefined' && window.location?.origin ? trimTrailingSlash(window.location.origin) : '';
export const getBrowserHostname = () =>
  typeof window !== 'undefined' && window.location?.hostname ? normalizeHostname(window.location.hostname) : '';

export const SURFACE_URLS = {
  app: trimTrailingSlash(import.meta.env.VITE_APP_URL) || getBrowserOrigin(),
  web: trimTrailingSlash(import.meta.env.VITE_WEB_URL),
  admin: trimTrailingSlash(import.meta.env.VITE_ADMIN_URL),
  api: trimTrailingSlash(import.meta.env.VITE_API_URL)
};

export const SURFACE_HOSTS = {
  app: SURFACE_URLS.app,
  web: SURFACE_URLS.web,
  admin: SURFACE_URLS.admin,
  api: SURFACE_URLS.api
};

export const SURFACE_LABELS = {
  app: 'app_surface',
  web: 'web_surface',
  admin: 'admin_surface',
  api: 'api_surface'
};

export const getSurfaceBaseUrl = (surface) => trimTrailingSlash(SURFACE_URLS?.[surface] || '');
export const getSurfaceHostname = (surface) => normalizeHostname(getSurfaceBaseUrl(surface));

const TALepet_HOST_ALIASES = {
  web: ['talepet.net.tr', 'www.talepet.net.tr'],
  app: ['app.talepet.net.tr'],
  admin: ['admin.talepet.net.tr'],
  api: ['api.talepet.net.tr']
};

const getKnownSurfaceHosts = (surface) =>
  [...new Set([getSurfaceHostname(surface), ...(TALepet_HOST_ALIASES[surface] || [])].filter(Boolean))];

const isKnownSurfaceHost = (surface, hostname) => {
  const normalizedHostname = normalizeHostname(hostname);
  if (!normalizedHostname) {
    return false;
  }
  return getKnownSurfaceHosts(surface).includes(normalizedHostname);
};

export const resolveSurfaceLabelFromHostname = (hostname = getBrowserHostname()) => {
  const normalizedHostname = normalizeHostname(hostname);
  if (!normalizedHostname) {
    return '';
  }

  if (isKnownSurfaceHost('admin', normalizedHostname)) {
    return SURFACE_LABELS.admin;
  }

  if (isKnownSurfaceHost('app', normalizedHostname)) {
    return SURFACE_LABELS.app;
  }

  if (isKnownSurfaceHost('web', normalizedHostname)) {
    return SURFACE_LABELS.web;
  }

  return '';
};

export const buildSurfaceHref = (surface, path = '/') => {
  const normalizedPath = normalizePath(path);
  const baseUrl = getSurfaceBaseUrl(surface);
  if (!baseUrl) {
    return normalizedPath;
  }
  if (normalizedPath === '/') {
    return `${baseUrl}/`;
  }
  return `${baseUrl}${normalizedPath}`;
};

export const buildCurrentSurfaceHref = (pathname, path = '/', hostname = getBrowserHostname()) => {
  const surface = resolveSurfaceLabel(pathname, hostname);
  if (surface === SURFACE_LABELS.web) {
    return buildSurfaceHref('web', path);
  }
  if (surface === SURFACE_LABELS.admin) {
    return buildSurfaceHref('admin', path);
  }
  return buildSurfaceHref('app', path);
};

export const resolveSurfaceLabel = (pathname = '', hostname = getBrowserHostname()) => {
  const hostnameSurface = resolveSurfaceLabelFromHostname(hostname);
  if (hostnameSurface === SURFACE_LABELS.admin) {
    return SURFACE_LABELS.admin;
  }
  if (hostnameSurface === SURFACE_LABELS.app && pathname === WEB_HOME_PATH) {
    return SURFACE_LABELS.app;
  }
  if (hostnameSurface === SURFACE_LABELS.web && pathname === WEB_HOME_PATH) {
    return SURFACE_LABELS.web;
  }

  if (pathname.startsWith(ADMIN_HOME_PATH)) {
    return SURFACE_LABELS.admin;
  }

  if (PUBLIC_WEB_PATHS.includes(pathname)) {
    return SURFACE_LABELS.web;
  }

  return SURFACE_LABELS.app;
};
