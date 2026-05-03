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
export const WEBSITE_DISCOVERY_PATH = '/kesfet';
export const WEBSITE_CATEGORIES_PATH = '/categories';
export const WEBSITE_CREATE_PATH = '/create';
export const WEBSITE_PACKAGES_PATH = '/paketler';
export const WEBSITE_PROFILE_HOME_PATH = '/profil';
export const WEBSITE_PROFILE_ACCOUNT_PATH = '/profil/hesap';
export const WEBSITE_PROFILE_REQUESTS_PATH = '/profil/taleplerim';
export const WEBSITE_PROFILE_OFFERS_PATH = '/profil/tekliflerim';
export const WEBSITE_PROFILE_FAVORITES_PATH = '/profil/favoriler';
export const WEBSITE_PROFILE_MESSAGES_PATH = '/profil/mesajlar';
export const WEBSITE_PROFILE_ADDRESSES_PATH = '/profil/adresler';
export const WEBSITE_PROFILE_PREMIUM_PATH = '/profil/premium';
export const WEBSITE_PROFILE_ALERTS_PATH = '/profil/takiplerim';
export const APP_HOME_PATH = '/app';
export const LEGACY_APP_HOME_PATH = '/';
export const PROFILE_HOME_PATH = '/profile';
export const ADMIN_HOME_PATH = '/admin';
export const APP_LOGIN_PATH = '/login';
export const APP_REGISTER_PATH = '/register';
export const APP_AUTH_CALLBACK_PATH = '/auth/callback';
export const APP_RESET_PASSWORD_PATH = '/reset-password';
export const APP_EMAIL_VERIFY_PATH = '/email-verify';
export const WEBSITE_LOGIN_PATH = '/login';
export const WEBSITE_REGISTER_PATH = '/register';
export const WEBSITE_AUTH_PATHS = [
  WEBSITE_LOGIN_PATH,
  WEBSITE_REGISTER_PATH,
  '/login-otp',
  '/sms-verify',
  '/email-verify',
  '/verify-otp',
  '/forgot-password',
  '/reset-password',
  APP_AUTH_CALLBACK_PATH
];
export const PUBLIC_WEB_PATHS = [
  WEB_HOME_PATH,
  WEBSITE_DISCOVERY_PATH,
  WEBSITE_CATEGORIES_PATH,
  WEBSITE_CREATE_PATH,
  WEBSITE_PACKAGES_PATH,
  '/hakkimizda',
  '/gizlilik-sozlesmesi',
  '/mesafeli-satis-sozlesmesi',
  '/teslimat-ve-iade',
  '/iletisim',
  ...WEBSITE_AUTH_PATHS
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

export const isWebSurfaceHost = (hostname = getBrowserHostname()) =>
  resolveSurfaceLabelFromHostname(hostname) === SURFACE_LABELS.web;

export const isAppSurfaceHost = (hostname = getBrowserHostname()) =>
  resolveSurfaceLabelFromHostname(hostname) === SURFACE_LABELS.app;

export const isAdminSurfaceHost = (hostname = getBrowserHostname()) =>
  resolveSurfaceLabelFromHostname(hostname) === SURFACE_LABELS.admin;

export const shouldUseWebFirstSurface = (hostname = getBrowserHostname()) => {
  const surface = resolveSurfaceLabelFromHostname(hostname);
  return surface === SURFACE_LABELS.web || !surface;
};

export const isWebsiteAuthPath = (pathname = '') => {
  const normalizedPath = normalizePath(pathname);
  return WEBSITE_AUTH_PATHS.includes(normalizedPath);
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

export const isAbsoluteHref = (value = '') => /^https?:\/\//i.test(String(value || '').trim());

export const resolvePostAuthHref = (role = 'user', hostname = getBrowserHostname()) => {
  const normalizedRole = String(role || 'user').trim().toLowerCase();
  const hostSurface = resolveSurfaceLabelFromHostname(hostname);

  if (normalizedRole === 'admin' || normalizedRole === 'moderator') {
    if (hostSurface === SURFACE_LABELS.admin) {
      return ADMIN_HOME_PATH;
    }
    return buildSurfaceHref('admin', ADMIN_HOME_PATH) || ADMIN_HOME_PATH;
  }

  if (hostSurface === SURFACE_LABELS.web || shouldUseWebFirstSurface(hostname)) {
    return WEBSITE_DISCOVERY_PATH;
  }

  return APP_HOME_PATH;
};

export const resolveSurfaceLabel = (pathname = '', hostname = getBrowserHostname()) => {
  const hostnameSurface = resolveSurfaceLabelFromHostname(hostname);
  if (hostnameSurface === SURFACE_LABELS.admin) {
    return SURFACE_LABELS.admin;
  }
  if (hostnameSurface === SURFACE_LABELS.app) {
    return SURFACE_LABELS.app;
  }
  if (hostnameSurface === SURFACE_LABELS.web) {
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
