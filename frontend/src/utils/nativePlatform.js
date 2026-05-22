export const isNativeCapacitorRuntime = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const protocol = window.location?.protocol;
  if (protocol === 'capacitor:' || protocol === 'ionic:') {
    return true;
  }

  const capacitor = window.Capacitor;
  if (!capacitor) {
    return false;
  }

  if (typeof capacitor.isNativePlatform === 'function') {
    try {
      return Boolean(capacitor.isNativePlatform());
    } catch {
      return false;
    }
  }

  const platform = typeof capacitor.getPlatform === 'function' ? capacitor.getPlatform() : '';
  return platform === 'android' || platform === 'ios';
};

export const getNativePlatform = () => {
  if (!isNativeCapacitorRuntime()) {
    return '';
  }

  try {
    return typeof window.Capacitor?.getPlatform === 'function' ? window.Capacitor.getPlatform() : 'native';
  } catch {
    return 'native';
  }
};

export const NATIVE_OAUTH_SCHEME = 'tr.com.talepet.app';
export const NATIVE_OAUTH_CALLBACK_URL = `${NATIVE_OAUTH_SCHEME}://auth/callback`;

export const getNativeSocialAuthMessage = () =>
  'Sosyal giris baslatilamadi. Lutfen tekrar dene veya e-posta ile devam et.';
