import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import {
  NATIVE_OAUTH_SCHEME,
  isNativeCapacitorRuntime
} from './nativePlatform';

const buildInternalPathFromNativeUrl = (value = '') => {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== `${NATIVE_OAUTH_SCHEME}:`) {
      return '';
    }

    const params = `${url.search || ''}${url.hash || ''}`;
    if (url.hostname === 'auth' && url.pathname === '/callback') {
      return `/auth/callback${params}`;
    }
    if (url.hostname === 'login') {
      return `/login${params}`;
    }
  } catch (_error) {
    return '';
  }

  return '';
};
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const nativeAuthPerf = (event, startedAt, extra = {}) => {
  if (!isNativeCapacitorRuntime()) {
    return;
  }
  console.info('NATIVE_AUTH_PERF', {
    event,
    elapsedMs: Math.round(now() - startedAt),
    ...extra
  });
};

export const openNativeSocialAuth = async (url) => {
  if (!isNativeCapacitorRuntime()) {
    window.location.href = url;
    return;
  }

  await Browser.open({
    url,
    presentationStyle: 'fullscreen'
  });
};

export const closeNativeSocialAuth = async () => {
  try {
    await Browser.close();
  } catch (_error) {
    // Browser.close is best-effort; Android Custom Tabs may already be closed.
  }
};

export const registerNativeSocialAuthRedirects = (navigate) => {
  if (!isNativeCapacitorRuntime() || typeof navigate !== 'function') {
    return () => {};
  }

  let disposed = false;
  const handledUrls = new Set();
  const handleUrl = (url) => {
    const startedAt = now();
    nativeAuthPerf('deep_link_received', startedAt, { hasUrl: Boolean(url) });
    const internalPath = buildInternalPathFromNativeUrl(url);
    if (!internalPath || disposed || handledUrls.has(internalPath)) {
      nativeAuthPerf('deep_link_ignored', startedAt, {
        hasInternalPath: Boolean(internalPath),
        disposed,
        duplicate: Boolean(internalPath && handledUrls.has(internalPath))
      });
      return;
    }

    handledUrls.add(internalPath);
    nativeAuthPerf('browser_close_start', startedAt);
    void closeNativeSocialAuth();
    nativeAuthPerf('native_route_navigate', startedAt, { internalPath });
    navigate(internalPath, { replace: true });
  };

  let listenerHandle;
  CapacitorApp.addListener('appUrlOpen', (event) => {
    handleUrl(event?.url);
  }).then((handle) => {
    listenerHandle = handle;
  });

  CapacitorApp.getLaunchUrl()
    .then((event) => {
      handleUrl(event?.url);
    })
    .catch(() => {});

  return () => {
    disposed = true;
    if (listenerHandle?.remove) {
      listenerHandle.remove();
    }
  };
};
