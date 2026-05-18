export const isNativeCapacitorRuntime = () => {
  if (typeof window === 'undefined') {
    return false;
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

export const getNativeSocialAuthMessage = () =>
  'Mobil uygulamada sosyal giris hazirlaniyor. Simdilik e-posta ve sifre ile devam edebilirsin.';
