import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { clearSocialLoginReturnTarget, readSocialLoginReturnTarget } from '../api/axios';
import { APP_HOME_PATH, buildSurfaceHref, isAbsoluteHref, resolvePostAuthHref } from '../config/surfaces';
import { debugInfo, debugWarn } from '../utils/debugLog';
import { isNativeCapacitorRuntime } from '../utils/nativePlatform';

function AuthCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');

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
      window.location.href = nextHref;
      return;
    }
    navigate(nextHref, { replace: true });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || window.location.hash.replace('#', '').replace('token=', '');
    debugInfo('AUTH_CALLBACK_START', {
      host: window.location.hostname,
      path: window.location.pathname,
      hasToken: Boolean(token)
    });
    if (!token) {
      setError('Token bulunamadi.');
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
  }, [login, navigate]);

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
