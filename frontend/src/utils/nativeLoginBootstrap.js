import { isNativeCapacitorRuntime } from './nativePlatform';

export const NATIVE_LOGIN_BOOTSTRAP_KEY = 'talepet:native-login-pending-bootstrap';

const readSessionStorage = () => {
  if (!isNativeCapacitorRuntime() || typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch (_error) {
    return null;
  }
};

export const markNativeLoginBootstrapPending = () => {
  const storage = readSessionStorage();
  if (!storage) {
    return 0;
  }

  const completedAt = Date.now();
  storage.setItem(NATIVE_LOGIN_BOOTSTRAP_KEY, String(completedAt));
  return completedAt;
};

export const readNativeLoginBootstrapPending = () => {
  const storage = readSessionStorage();
  if (!storage) {
    return 0;
  }

  return Number(storage.getItem(NATIVE_LOGIN_BOOTSTRAP_KEY) || 0);
};

export const clearNativeLoginBootstrapPending = () => {
  const storage = readSessionStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(NATIVE_LOGIN_BOOTSTRAP_KEY);
};
