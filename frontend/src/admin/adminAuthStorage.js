import { resolveSurfaceLabelFromHostname, SURFACE_LABELS } from '../config/surfaces';

export const ADMIN_SURFACE_STORAGE_KEYS = [
  'admin_token',
  'token',
  'authToken',
  'accessToken',
  'userName'
];

export const isAdminSurfaceHost = () =>
  typeof window !== 'undefined' &&
  resolveSurfaceLabelFromHostname(window.location.hostname) === SURFACE_LABELS.admin;

const accessStorageBucket = (bucketName) => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window[bucketName] || null;
  } catch (_error) {
    return null;
  }
};

const clearStorageBucket = (storage) => {
  if (!storage) {
    return;
  }

  ADMIN_SURFACE_STORAGE_KEYS.forEach((key) => {
    try {
      storage.removeItem(key);
    } catch (_error) {
      // Ignore storage access issues on locked-down browsers.
    }
  });
};

export const clearAdminSurfaceStorage = () => {
  if (!isAdminSurfaceHost()) {
    return;
  }

  clearStorageBucket(accessStorageBucket('localStorage'));
  clearStorageBucket(accessStorageBucket('sessionStorage'));
};

// Admin token is intentionally readable only on the admin surface.
export const readAdminToken = () => {
  if (!isAdminSurfaceHost()) {
    return '';
  }

  const storage = accessStorageBucket('localStorage');
  if (!storage) {
    return '';
  }

  try {
    return storage.getItem('admin_token') || '';
  } catch (_error) {
    return '';
  }
};

export const writeAdminToken = (token) => {
  if (!isAdminSurfaceHost()) {
    return;
  }

  const storage = accessStorageBucket('localStorage');
  if (!storage) {
    return;
  }

  try {
    if (token) {
      storage.setItem('admin_token', token);
      return;
    }

    storage.removeItem('admin_token');
  } catch (_error) {
    // Ignore storage access issues on locked-down browsers.
  }
};

export const hasAdminAccess = (account) => {
  if (!account) {
    return false;
  }

  if (account.isAdmin === true) {
    return true;
  }

  if (Array.isArray(account.roles) && account.roles.includes('admin')) {
    return true;
  }

  return account.role === 'admin';
};

export const resolveAccountEmail = (account) =>
  account?.email || account?.user?.email || account?.admin?.email || '';
