import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, {
  buildApiUrl,
  buildProviderAuthUrl,
  buildPublicRequestConfig,
  warmApiForInteractiveAuth,
  rememberSocialLoginReturnTarget
} from '../api/axios';
import ReusableBottomSheet from '../components/ReusableBottomSheet';
import { isAbsoluteHref, isWebSurfaceHost, resolvePostAuthHref } from '../config/surfaces';
import { useAuth } from '../context/AuthContext';

const PRECHECK_TIMEOUT_MS = 8000;
const PRECHECK_RETRY_DELAY_MS = 300;
const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const isRetryableRequestError = (error) =>
  !error?.response || error?.code === 'ECONNABORTED' || error?.name === 'CanceledError';

function Login({ embedded = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, logout, user } = useAuth();
  const webSurface = isWebSurfaceHost();
  const isWebsiteLoginRoute = webSurface && location.pathname === '/login';
  const showExistingSessionCard = isWebsiteLoginRoute && isAuthenticated;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState('login');
  const [email, setEmail] = useState('');
  const [exists, setExists] = useState(null);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [providerLoading, setProviderLoading] = useState('');
  const [showForgotLink, setShowForgotLink] = useState(false);

  const completeAuthRedirect = (role = 'user') => {
    const nextHref = resolvePostAuthHref(role, window.location.hostname);
    if (isAbsoluteHref(nextHref)) {
      window.location.href = nextHref;
      return;
    }
    navigate(nextHref, { replace: true });
  };

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    if (isWebsiteLoginRoute) {
      return;
    }
    const role = user?.role;
    completeAuthRedirect(role);
  }, [isAuthenticated, isWebsiteLoginRoute, navigate, user?.role]);

  const normalizeEmail = (v) =>
    String(v || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const requestPrecheck = useCallback(
    async (rawEmail, { applyState = true } = {}) => {
      const em = normalizeEmail(rawEmail);
      if (!isValidEmail(em)) {
        if (applyState) {
          setExists(null);
          setShowSignupPrompt(false);
        }
        return { status: 'invalid', exists: null };
      }

      if (import.meta.env.DEV) {
        console.info('PRECHECK_REQUEST_URL', buildApiUrl('/auth/precheck'));
        console.info('PRECHECK_START', { email: em });
      }

      try {
        let response = null;

        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            response = await api.post(
              '/auth/precheck',
              { method: 'email', email: em },
              buildPublicRequestConfig({
                timeout: PRECHECK_TIMEOUT_MS
              })
            );
            break;
          } catch (requestError) {
            if (attempt === 0 && isRetryableRequestError(requestError)) {
              await wait(PRECHECK_RETRY_DELAY_MS);
              continue;
            }
            throw requestError;
          }
        }

        const found = response?.data?.exists ?? null;

        if (applyState) {
          setExists(found);
          if (found === true) {
            setShowSignupPrompt(false);
            if (sheetMode === 'register') {
              setError('Bu hesap zaten var. Giris yap.');
              setSheetMode('login');
            }
          } else if (found === false) {
            setShowSignupPrompt(false);
            setPassword('');
          }
        }

        if (import.meta.env.DEV) {
          console.info('PRECHECK_END', { status: 'ok', exists: found });
        }

        return { status: 'resolved', exists: found };
      } catch (requestError) {
        if (applyState) {
          setExists(null);
          setShowSignupPrompt(false);
        }

        if (import.meta.env.DEV) {
          console.warn('Precheck failed:', {
            url: buildApiUrl('/auth/precheck'),
            message: requestError?.message || requestError
          });
          console.info('PRECHECK_END', { status: 'fallback' });
        }

        return { status: 'fallback', exists: null };
      }
    },
    [sheetMode]
  );

  useEffect(() => {
    if (!sheetOpen && !webSurface) {
      return;
    }
    let timer = null;
    const runPrecheckWithDelay = async () => {
      const em = normalizeEmail(email);
      if (!isValidEmail(em)) {
        setExists(null);
        setShowSignupPrompt(false);
        return;
      }
      await requestPrecheck(em, { applyState: true });
    };
    timer = window.setTimeout(runPrecheckWithDelay, 400);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [email, requestPrecheck, sheetOpen, webSurface]);

  const resetForm = () => {
    setEmail('');
    setExists(null);
    setShowSignupPrompt(false);
    setPassword('');
    setError('');
    setNotice('');
    setLoading(false);
    setProviderLoading('');
    setShowForgotLink(false);
  };

  const openSheet = (mode) => {
    setSheetMode(mode);
    resetForm();
    setSheetOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const em = normalizeEmail(email);
      if (import.meta.env.DEV) {
        console.info('LOGIN_SUBMIT', {
          host: typeof window !== 'undefined' ? window.location.hostname : '',
          email: em
        });
      }
      if (!isValidEmail(em)) {
        setError('Gecerli bir e-posta gir');
        return;
      }
      if (!password.trim()) {
        setError('Sifre zorunlu');
        return;
      }

      let nextExists = exists;
      if (nextExists === null) {
        const precheckResult = await requestPrecheck(em, { applyState: true });
        if (precheckResult.status === 'resolved') {
          nextExists = precheckResult.exists;
        } else {
          setNotice('On kontrol alinamadi, giris denendi.');
        }
      }

      if (nextExists === false) {
        if (sheetMode === 'register') {
          handlePrecheckSignup();
          return;
        }
        setShowSignupPrompt(true);
        return;
      }

      if (import.meta.env.DEV) {
        console.info('LOGIN_START', { email: em });
      }

      const res = await api.post(
        '/auth/login',
        { email: em, password },
        buildPublicRequestConfig({
          timeout: PRECHECK_TIMEOUT_MS
        })
      );
      const data = res?.data;

      if (data?.token) {
        localStorage.setItem('token', data.token);
        await login(data.token);
        if (import.meta.env.DEV) {
          console.info('LOGIN_END', { status: 'ok' });
        }
        completeAuthRedirect(data?.user?.role);
        return;
      }

      if (import.meta.env.DEV) {
        console.info('LOGIN_END', { status: 'failed' });
      }
      setError(data?.message || 'Giris basarisiz');
    } catch (otpError) {
      if (import.meta.env.DEV) {
        console.info('LOGIN_END', { status: 'error', message: otpError?.message || otpError });
      }
      const status = otpError?.response?.status;
      if (!otpError?.response) {
        setError('Baglanti yok');
      } else if (status === 401) {
        setError('Sifre hatali');
        setShowForgotLink(true);
      } else if (status === 429) {
        setError('Cok fazla deneme');
      } else if (status >= 500) {
        setError('Sunucu hatasi, tekrar dene');
      } else {
        setError(otpError?.response?.data?.message || otpError?.message || 'Giris basarisiz');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrecheckSignup = () => {
    const em = normalizeEmail(email);
    navigate(`/register?email=${encodeURIComponent(em)}`);
  };

  const handleProviderLogin = async (provider) => {
    setError('');
    setNotice('');
    setProviderLoading(provider);
    rememberSocialLoginReturnTarget();

    const wakeResult = await warmApiForInteractiveAuth({ provider });

    if (!wakeResult.ok) {
      setProviderLoading('');
      setError('Sunucu mesgul, tekrar deneyin.');
      return;
    }

    window.location.href = buildProviderAuthUrl(provider);
  };

  const handleLogoutForRelogin = async () => {
    await Promise.resolve(logout({ redirect: false }));
    navigate('/login', { replace: true });
  };

  const renderAuthForm = () => (
    <>
      {exists === true ? <p className="muted small">Hesabin bulundu. Sifreni gir.</p> : null}
      {exists === false ? (
        <p className="muted small">Bu hesap yok. Bu bilgilerle kayit olmak ister misin?</p>
      ) : null}

      <form onSubmit={handleSubmit} className="auth-form" data-rb-no-drag="true">
        <div className="auth-field">
          <label htmlFor="email">E-posta</label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ornek@mail.com"
            autoComplete="email"
            inputMode="email"
            enterKeyHint="next"
            required
          />
        </div>

        {showSignupPrompt && exists === false ? (
          <div className="auth-alert">
            Bu hesap bulunamadi. Bu bilgilerle kayit olmak ister misin?
            <div className="auth-footer-links">
              <button type="button" className="link-btn" onClick={handlePrecheckSignup}>
                Evet, Kayit Ol
              </button>
              <button type="button" className="link-btn" onClick={() => setShowSignupPrompt(false)}>
                Vazgec
              </button>
            </div>
          </div>
        ) : null}

        {exists === true ? (
          <div className="auth-field">
            <label htmlFor="password">Sifre</label>
            <div className="auth-input-wrap">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Sifren"
                autoComplete="current-password"
                enterKeyHint="done"
              />
              <button
                type="button"
                className="auth-toggle"
                aria-label="Sifreyi goster veya gizle"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? 'Gizle' : 'Goster'}
              </button>
            </div>
          </div>
        ) : null}

        {notice ? <div className="auth-alert">{notice}</div> : null}
        {error ? <div className="auth-alert">{error}</div> : null}
        {showForgotLink ? (
          <button type="button" className="link-btn auth-forgot" onClick={() => navigate('/forgot-password')}>
            Sifremi unuttum
          </button>
        ) : null}

        <button
          type="submit"
          className="primary-btn"
          disabled={loading || (exists === true && !password.trim())}
        >
          {loading
            ? 'Isleniyor...'
            : exists === true
              ? 'Giris Yap'
              : exists === false
                ? 'Kayit Ol'
                : 'Devam Et'}
        </button>
      </form>
    </>
  );

  const renderExistingSessionCard = () => (
    <div className="website-auth-inline-card">
      <div className="website-auth-inline-head">
        <h2>Oturumunuz acik</h2>
        <p>
          {user?.name || user?.email || 'Talepet hesabin'} ile zaten giris yapmissin. Website
          icinde kaldigin yerden devam edebilir veya farkli bir hesapla yeniden giris yapabilirsin.
        </p>
      </div>

      <div className="auth-alert">
        Aktif hesap: <strong>{user?.name || user?.email || 'Talepet kullanicisi'}</strong>
      </div>

      <div className="auth-actions auth-actions-inline">
        <button type="button" className="primary-btn" onClick={() => navigate('/profil')}>
          Profile Git
        </button>
        <button type="button" className="secondary-btn" onClick={() => navigate('/', { replace: true })}>
          Ana Sayfaya Don
        </button>
        <button type="button" className="link-btn" onClick={handleLogoutForRelogin}>
          Cikis Yap ve Farkli Hesapla Giris Yap
        </button>
      </div>
    </div>
  );

  if (webSurface && embedded) {
    return (
      <div className="website-auth-inline-card">
        <div className="website-auth-inline-head">
          <h2>{sheetMode === 'login' ? 'Hesabina giris yap' : 'Yeni hesap olustur'}</h2>
          <p>
            {sheetMode === 'login'
              ? 'Talep, teklif ve profil akisina website uzerinden giris yaparak devam et.'
              : 'Kayit adimini website yuzeyi icinde tamamla, uygulamaya gecis zamanini sen belirle.'}
          </p>
        </div>

        <div className="auth-social">
          <div className="muted small">Hizli devam et</div>
          <button type="button" className="social-btn google" onClick={() => handleProviderLogin('google')}>
            {providerLoading === 'google' ? 'Google hazirlaniyor...' : 'Google ile devam et'}
          </button>
          <button type="button" className="social-btn apple" onClick={() => handleProviderLogin('apple')}>
            <span className="social-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M16.7 13.1c0 2.1 1.8 2.8 1.9 2.9-.0.1-.3 1.2-1 2.4-.6 1.1-1.3 2.1-2.4 2.1-1 0-1.3-.6-2.5-.6-1.1 0-1.5.6-2.5.6-1.1 0-1.9-1-2.6-2.1-1.4-2.2-2.5-6.2-1-8.9.7-1.3 2-2.2 3.4-2.2 1.1 0 2 .7 2.5.7.5 0 1.6-.8 2.8-.7.5 0 2 .2 3 1.6-.1.1-1.8 1-1.8 3.2z"/>
                <path d="M14.9 3.2c.7-.8 1.2-1.9 1.1-3.2-1 .1-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 3 1.1.1 2.1-.6 2.7-1.3z"/>
              </svg>
            </span>
            <span className="social-text">
              {providerLoading === 'apple' ? 'Apple hazirlaniyor...' : 'Apple ile devam et'}
            </span>
          </button>
        </div>

        <div className="auth-divider">
          <span>veya</span>
        </div>

        {showExistingSessionCard ? (
          renderExistingSessionCard()
        ) : (
          <>
            <div className="auth-actions auth-actions-inline">
              <button type="button" className="primary-btn is-active" onClick={() => navigate('/login')}>
                Giris Yap
              </button>
              <button type="button" className="secondary-btn" onClick={() => navigate('/register')}>
                Kayit Ol
              </button>
            </div>

            {renderAuthForm()}
          </>
        )}

        <div className="auth-footer">
          <span>Hesabin yok mu?</span>
          <button type="button" className="link-btn" onClick={() => navigate('/register')}>
            Kayit Ol
          </button>
        </div>
      </div>
    );
  }

  if (webSurface) {
    return (
      <div className="page auth-page">
        <div className="card auth-card">
          <h1 className="auth-title">Talepet</h1>
          <p className="auth-subtitle">Website icinden hesabina guvenle devam et.</p>

          <div className="website-auth-inline-card">
            <div className="website-auth-inline-head">
              <h2>{sheetMode === 'login' ? 'Hesabina giris yap' : 'Yeni hesap olustur'}</h2>
              <p>
                {sheetMode === 'login'
                  ? 'Talep, teklif ve profil akisina website uzerinden giris yaparak devam et.'
                  : 'Kayit adimini website yuzeyi icinde tamamla, uygulamaya gecis zamanini sen belirle.'}
              </p>
            </div>

            <div className="auth-social">
              <div className="muted small">Hizli devam et</div>
              <button type="button" className="social-btn google" onClick={() => handleProviderLogin('google')}>
                {providerLoading === 'google' ? 'Google hazirlaniyor...' : 'Google ile devam et'}
              </button>
              <button type="button" className="social-btn apple" onClick={() => handleProviderLogin('apple')}>
                <span className="social-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M16.7 13.1c0 2.1 1.8 2.8 1.9 2.9-.0.1-.3 1.2-1 2.4-.6 1.1-1.3 2.1-2.4 2.1-1 0-1.3-.6-2.5-.6-1.1 0-1.5.6-2.5.6-1.1 0-1.9-1-2.6-2.1-1.4-2.2-2.5-6.2-1-8.9.7-1.3 2-2.2 3.4-2.2 1.1 0 2 .7 2.5.7.5 0 1.6-.8 2.8-.7.5 0 2 .2 3 1.6-.1.1-1.8 1-1.8 3.2z"/>
                    <path d="M14.9 3.2c.7-.8 1.2-1.9 1.1-3.2-1 .1-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 3 1.1.1 2.1-.6 2.7-1.3z"/>
                  </svg>
                </span>
                <span className="social-text">
                  {providerLoading === 'apple' ? 'Apple hazirlaniyor...' : 'Apple ile devam et'}
                </span>
              </button>
            </div>

            <div className="auth-divider">
              <span>veya</span>
            </div>

            {showExistingSessionCard ? (
              renderExistingSessionCard()
            ) : (
              <>
                <div className="auth-actions auth-actions-inline">
                  <button type="button" className="primary-btn is-active" onClick={() => navigate('/login')}>
                    Giris Yap
                  </button>
                  <button type="button" className="secondary-btn" onClick={() => navigate('/register')}>
                    Kayit Ol
                  </button>
                </div>

                {renderAuthForm()}
              </>
            )}

            <div className="auth-footer">
              <span>Hesabin yok mu?</span>
              <button type="button" className="link-btn" onClick={() => navigate('/register')}>
                Kayit Ol
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page auth-page">
      <div className="card auth-card">
        <h1 className="auth-title">Talepet</h1>
        <p className="auth-subtitle">Giris yap veya yeni hesap olustur.</p>

        <div className="auth-social">
          <div className="muted small">Hizli devam et</div>
          <button type="button" className="social-btn google" onClick={() => handleProviderLogin('google')}>
            {providerLoading === 'google' ? 'Google hazirlaniyor...' : 'Google ile devam et'}
          </button>
          <button type="button" className="social-btn apple" onClick={() => handleProviderLogin('apple')}>
            <span className="social-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M16.7 13.1c0 2.1 1.8 2.8 1.9 2.9-.0.1-.3 1.2-1 2.4-.6 1.1-1.3 2.1-2.4 2.1-1 0-1.3-.6-2.5-.6-1.1 0-1.5.6-2.5.6-1.1 0-1.9-1-2.6-2.1-1.4-2.2-2.5-6.2-1-8.9.7-1.3 2-2.2 3.4-2.2 1.1 0 2 .7 2.5.7.5 0 1.6-.8 2.8-.7.5 0 2 .2 3 1.6-.1.1-1.8 1-1.8 3.2z"/>
                <path d="M14.9 3.2c.7-.8 1.2-1.9 1.1-3.2-1 .1-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 3 1.1.1 2.1-.6 2.7-1.3z"/>
              </svg>
            </span>
            <span className="social-text">
              {providerLoading === 'apple' ? 'Apple hazirlaniyor...' : 'Apple ile devam et'}
            </span>
          </button>
        </div>

        <div className="auth-actions">
          <button type="button" className="primary-btn" onClick={() => openSheet('login')}>
            Giris Yap
          </button>
          <button type="button" className="secondary-btn" onClick={() => openSheet('register')}>
            Kayit Ol
          </button>
        </div>
      </div>

      <ReusableBottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={sheetMode === 'login' ? 'Giris Yap' : 'Kayit Ol'}
        contentClassName="auth-sheet"
        headerRight={
          <button type="button" className="offer-sheet-close" onClick={() => setSheetOpen(false)} aria-label="Kapat">
            ×
          </button>
        }
        initialSnap="mid"
      >
        {renderAuthForm()}
      </ReusableBottomSheet>
    </div>
  );
}

export default Login;
