import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { clearSocialLoginReturnTarget, readSocialLoginReturnTarget } from '../api/axios';
import { APP_HOME_PATH, buildSurfaceHref, isAbsoluteHref, resolvePostAuthHref } from '../config/surfaces';
import { debugInfo, debugWarn } from '../utils/debugLog';
import { isNativeCapacitorRuntime } from '../utils/nativePlatform';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const readCallbackToken = () => {
  const params = new URLSearchParams(window.location.search || '');
  const hashParams = new URLSearchParams(String(window.location.hash || '').replace(/^#/, ''));
  return params.get('token') || hashParams.get('token') || '';
};
const nativeAuthPerf = (event, startedAt, extra = {}) => {
  if (!isNativeCapacitorRuntime()) {
    return;
  }
  console.info('NATIVE_AUTH_PERF', {
    event,
    elapsedMs: Math.round(now() - startedAt),
    path: window.location.pathname,
    ...extra
  });
};

function AuthCallback() {
  const navigate = useNavigate();
  const { login, loginFast } = useAuth();
  const [error, setError] = useState('');
  const startedAt = useMemo(() => now(), []);
  const nativeRuntime = isNativeCapacitorRuntime();
  const hasNativeToken = nativeRuntime && Boolean(readCallbackToken());

  const completeAuthRedirect = (role = 'user') => {
    const params = new URLSearchParams(window.location.search);
    const returnTo = String(params.get('returnTo') || '').trim();
    const returnSurface = String(params.get('returnSurface') || '').trim();
    const rememberedTarget = readSocialLoginReturnTarget();

    const rememberedReturnSurface = String(rememberedTarget?.returnSurface || '').trim();
    const rememberedReturnTo = String(rememberedTarget?.returnTo || '').trim();
    const nativeRuntime = isNativeCapacitorRuntime();

    let nextHref = '';
    if (nativeRuntime) {
      nextHref = APP_HOME_PATH;
    } else if (returnSurface === 'web' || rememberedReturnSurface === 'web') {
      nextHref = buildSurfaceHref('web', '/kesfet');
    } else if (returnSurface === 'app' || rememberedReturnSurface === 'app') {
      nextHref = buildSurfaceHref('app', '/app');
    } else if (returnTo || rememberedReturnTo) {
      try {
        nextHref = resolvePostAuthHref(role, new URL(returnTo || rememberedReturnTo).hostname);
      } catch (_error) {
        nextHref = resolvePostAuthHref(role, window.location.hostname);
      }
    } else {
      nextHref = resolvePostAuthHref(role, window.location.hostname);
    }

    clearSocialLoginReturnTarget();
    if (isAbsoluteHref(nextHref)) {
      nativeAuthPerf('absolute_redirect', startedAt, { nextHref });
      window.location.href = nextHref;
      return;
    }
    nativeAuthPerf('navigate_start', startedAt, { nextHref });
    navigate(nextHref, { replace: true });
    nativeAuthPerf('navigate_called', startedAt, { nextHref });
  };

  useEffect(() => {
    nativeAuthPerf('callback_mounted', startedAt);
    const token = readCallbackToken();
    nativeAuthPerf('token_parsed', startedAt, { hasToken: Boolean(token) });
    debugInfo('AUTH_CALLBACK_START', {
      host: window.location.hostname,
      path: window.location.pathname,
      hasToken: Boolean(token)
    });
    if (!token) {
      setError('Token bulunamadi.');
      return;
    }
    if (isNativeCapacitorRuntime()) {
      nativeAuthPerf('token_store_start', startedAt);
      loginFast(token);
      nativeAuthPerf('token_store_done', startedAt);
      completeAuthRedirect('user');
      return;
    }

    login(token)
      .then((nextUser) => {
        debugInfo('AUTH_CALLBACK_LOGIN_OK', {
          host: window.location.hostname,
          userId: nextUser?.id || nextUser?._id || '',
          role: nextUser?.role || 'user'
        });
        completeAuthRedirect(nextUser?.role || 'user');
      })
      .catch((callbackError) => {
        debugWarn('AUTH_CALLBACK_LOGIN_FAIL', {
          host: window.location.hostname,
          code: callbackError?.code || '',
          message: callbackError?.message || 'unknown_error'
        });
        setError('Giris tamamlanamadi.');
      });
  }, [login, loginFast, navigate, startedAt]);

  if (hasNativeToken && !error) {
    return null;
  }

  return (
    <div className="page auth-page">
      <div className="card auth-card">
        <h1 className="auth-title">Giris kontrol ediliyor...</h1>
        {error ? <div className="auth-alert">{error}</div> : null}
      </div>
    </div>
  );
}

export default AuthCallback;
