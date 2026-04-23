export const ADMIN_SURFACE_STORAGE_KEYS = [
  'admin_token',
  'token',
  'authToken',
  'accessToken',
  'userName'
];

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
  if (typeof window === 'undefined') {
    return;
  }

  clearStorageBucket(window.localStorage);
  clearStorageBucket(window.sessionStorage);
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
