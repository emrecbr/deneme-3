import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAbsoluteHref, resolvePostAuthHref } from '../config/surfaces';

function AuthCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');

  const completeAuthRedirect = () => {
    const nextHref = resolvePostAuthHref('user', window.location.hostname);
    if (isAbsoluteHref(nextHref)) {
      window.location.href = nextHref;
      return;
    }
    navigate(nextHref, { replace: true });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || window.location.hash.replace('#', '').replace('token=', '');
    console.info('AUTH_CALLBACK_START', {
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
        console.info('AUTH_CALLBACK_LOGIN_OK', {
          host: window.location.hostname,
          userId: nextUser?.id || nextUser?._id || '',
          role: nextUser?.role || 'user'
        });
        completeAuthRedirect();
      })
      .catch((callbackError) => {
        console.warn('AUTH_CALLBACK_LOGIN_FAIL', {
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
