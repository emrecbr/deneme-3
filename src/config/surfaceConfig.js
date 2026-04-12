const trimTrailingSlash = (value) => String(value || '').trim().replace(/\/$/, '');
const trimLeadingSlash = (value) => String(value || '').trim().replace(/^\/+/, '');
const normalizePath = (value = '/') => {
  const text = String(value || '/').trim();
  if (!text || text === '/') return '/';
  return `/${trimLeadingSlash(text)}`;
};

const firstDefined = (...pairs) => {
  const match = pairs.find(([, value]) => trimTrailingSlash(value));
  if (!match) {
    return { value: '', source: 'missing' };
  }
  return { value: trimTrailingSlash(match[1]), source: match[0] };
};

export const getAppSurfaceConfig = () =>
  firstDefined(
    ['APP_SURFACE_URL', process.env.APP_SURFACE_URL],
    ['FRONTEND_URL', process.env.FRONTEND_URL],
    ['CLIENT_ORIGIN', process.env.CLIENT_ORIGIN],
    ['APP_BASE_URL', process.env.APP_BASE_URL]
  );

export const getWebSurfaceConfig = () =>
  firstDefined(
    ['WEB_BASE_URL', process.env.WEB_BASE_URL],
    ['MARKETING_SITE_URL', process.env.MARKETING_SITE_URL]
  );

export const getAdminSurfaceConfig = () =>
  firstDefined(
    ['ADMIN_BASE_URL', process.env.ADMIN_BASE_URL]
  );

export const getApiSurfaceConfig = () =>
  firstDefined(
    ['API_BASE_URL', process.env.API_BASE_URL]
  );

export const getAllowedSurfaceOrigins = () => {
  const candidates = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://app.talepet.net.tr',
    'https://talepet.net.tr',
    'https://www.talepet.net.tr',
    'https://admin.talepet.net.tr',
    getAppSurfaceConfig().value,
    getWebSurfaceConfig().value,
    getAdminSurfaceConfig().value,
    getApiSurfaceConfig().value,
    process.env.CLIENT_ORIGIN,
    process.env.FRONTEND_URL,
    process.env.APP_BASE_URL,
    process.env.ADMIN_BASE_URL,
    process.env.WEB_BASE_URL,
    process.env.MARKETING_SITE_URL,
    process.env.API_BASE_URL
  ];

  return [...new Set(candidates.map(trimTrailingSlash).filter(Boolean))];
};

export const getSurfaceRuntimeConfig = () => ({
  app: getAppSurfaceConfig(),
  web: getWebSurfaceConfig(),
  admin: getAdminSurfaceConfig(),
  api: getApiSurfaceConfig()
});

export const buildSurfaceUrl = (surface, path = '/', params = {}) => {
  const config = getSurfaceRuntimeConfig()[surface];
  if (!config?.value) {
    return '';
  }
  const url = new URL(normalizePath(path), `${config.value}/`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
};
