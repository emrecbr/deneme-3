import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { buildProviderAuthUrl } from '../api/axios';
import ReusableBottomSheet from '../components/ReusableBottomSheet';
import { isAbsoluteHref, isWebSurfaceHost, resolvePostAuthHref } from '../config/surfaces';
import { useAuth } from '../context/AuthContext';

function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState('login');
  const [activeTab, setActiveTab] = useState('email');
  const [email, setEmail] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [exists, setExists] = useState(null);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
    if (!isAuthenticated || isWebSurfaceHost()) {
      return;
    }
    const role = user?.role;
    completeAuthRedirect(role);
  }, [isAuthenticated, navigate, user?.role]);


  useEffect(() => {
    if (!sheetOpen) {
      return;
    }
    let timer = null;
    const runPrecheck = async () => {
      const em = normalizeEmail(email);
      const e164 = toE164TR(phoneDigits);
      if (activeTab === 'email' && !isValidEmail(em)) {
        setExists(null);
        setShowSignupPrompt(false);
        return;
      }
      if (activeTab === 'phone' && !e164) {
        setExists(null);
        setShowSignupPrompt(false);
        return;
      }
      try {
        const payload =
          activeTab === 'email'
            ? { method: 'email', email: em }
            : { method: 'sms', phone: e164 };
        const res = await api.post('/auth/precheck', payload);
        const found = res?.data?.exists ?? null;
        setExists(found);
        if (found === true) {
          setShowSignupPrompt(false);
          if (sheetMode === 'register') {
            setError('Bu hesap zaten var. Giriş yap.');
            setSheetMode('login');
          }
        } else if (found === false) {
          setShowSignupPrompt(false);
          setPassword('');
        }
      } catch (_err) {
        setExists(null);
        setShowSignupPrompt(false);
      }
    };
    timer = window.setTimeout(runPrecheck, 400);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [activeTab, email, phoneDigits, sheetOpen, sheetMode]);

  const onlyDigits = (v) => String(v || '').replace(/\D/g, '');
  const normalizeTrMobileTo10Digits = (v) => {
    let d = onlyDigits(v);
    if (d.startsWith('90')) d = d.slice(2);
    if (d.startsWith('0')) d = d.slice(1);
    if (d.length > 10) d = d.slice(0, 10);
    return d;
  };
  const toE164TR = (d10) => {
    if (!/^[5]\d{9}$/.test(d10)) return null;
    return `+90${d10}`;
  };
  const normalizeEmail = (v) =>
    String(v || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const resetForm = () => {
    setActiveTab('email');
    setEmail('');
    setPhoneDigits('');
    setExists(null);
    setShowSignupPrompt(false);
    setPassword('');
    setError('');
    setLoading(false);
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
    if (exists === null) {
      return;
    }
    if (exists === false) {
      if (sheetMode === 'register') {
        handlePrecheckSignup();
        return;
      }
      setShowSignupPrompt(true);
      return;
    }
    setLoading(true);
    try {
      let data;
      if (activeTab === 'phone') {
        const e164 = toE164TR(phoneDigits);
        if (!e164) {
          setError('Telefon 10 hane olmalı (5xx...)');
          return;
        }
        if (exists !== true) {
          setError('Devam etmek için kayıtlı hesap gir.');
          return;
        }
        if (!password.trim()) {
          setError('Şifre zorunlu');
          return;
        }
        const res = await api.post('/auth/login', { phone: e164, password });
        data = res?.data;
      } else {
        const em = normalizeEmail(email);
        if (!isValidEmail(em)) {
          setError('Geçerli bir e-posta gir');
          return;
        }
        if (exists !== true) {
          setError('Devam etmek için kayıtlı hesap gir.');
          return;
        }
        if (!password.trim()) {
          setError('Şifre zorunlu');
          return;
        }
        const res = await api.post('/auth/login', { email: em, password });
        data = res?.data;
      }

      if (data?.token) {
        localStorage.setItem('token', data.token);
        await login(data.token);
        completeAuthRedirect(data?.user?.role);
        return;
      }

      // OTP akışı bu ekranda sadece kayıtlı olmayan kullanıcıya yönlendirme için kullanılır.

      setError(data?.message || 'Giriş başarısız');
    } catch (otpError) {
      const status = otpError?.response?.status;
      if (!otpError?.response) {
        setError('Bağlantı yok');
      } else if (status === 401) {
        setError('Şifre hatalı');
        setShowForgotLink(true);
      } else if (status === 429) {
        setError('Çok fazla deneme');
      } else if (status >= 500) {
        setError('Sunucu hatası, tekrar dene');
      } else {
        setError(otpError?.response?.data?.message || otpError?.message || 'Giriş başarısız');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrecheckSignup = () => {
    const em = normalizeEmail(email);
    const e164 = toE164TR(phoneDigits);
    if (activeTab === 'email') {
      navigate(`/register?method=email&email=${encodeURIComponent(em)}`);
      return;
    }
    navigate(`/register?method=sms&phone=${encodeURIComponent(e164 || '')}`);
  };

  const buildAuthUrl = (provider) => {
    return buildProviderAuthUrl(provider);
  };

  const handleProviderLogin = (provider) => {
    window.location.href = buildAuthUrl(provider);
  };

  return (
    <div className="page auth-page">
      <div className="card auth-card">
        <h1 className="auth-title">Talepet</h1>
        <p className="auth-subtitle">Giriş yap veya yeni hesap oluştur.</p>

        <div className="auth-social">
          <div className="muted small">Hızlı devam et</div>
          <button type="button" className="social-btn google" onClick={() => handleProviderLogin('google')}>
            Google ile devam et
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
            <span className="social-text">Apple ile devam et</span>
          </button>
        </div>

        <div className="auth-actions">
          <button type="button" className="primary-btn" onClick={() => openSheet('login')}>
            Giriş Yap
          </button>
          <button type="button" className="secondary-btn" onClick={() => openSheet('register')}>
            Kayıt Ol
          </button>
        </div>
      </div>

      <ReusableBottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={sheetMode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
        contentClassName="auth-sheet"
        headerRight={
          <button type="button" className="offer-sheet-close" onClick={() => setSheetOpen(false)} aria-label="Kapat">
            ✕
          </button>
        }
        initialSnap="mid"
      >
        {exists === true ? (
          <p className="muted small">Hesabın bulundu. Şifreni gir.</p>
        ) : null}
        {exists === false ? (
          <p className="muted small">Bu hesap yok. Bu bilgilerle kayıt olmak ister misin?</p>
        ) : null}

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${activeTab === 'email' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('email');
              setError('');
              setExists(null);
              setShowSignupPrompt(false);
            }}
          >
            E-posta
          </button>
          <button
            type="button"
            className={`auth-tab ${activeTab === 'phone' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('phone');
              setError('');
              setExists(null);
              setShowSignupPrompt(false);
            }}
          >
            Telefon
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" data-rb-no-drag="true">
          {activeTab === 'email' ? (
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
          ) : (
            <div className="auth-field">
              <label htmlFor="phone">Telefon</label>
              <div className="auth-phone-wrap">
                <span className="auth-prefix">+90</span>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={phoneDigits}
                  onChange={(event) => setPhoneDigits(normalizeTrMobileTo10Digits(event.target.value))}
                  placeholder="5xx xxx xx xx"
                  autoComplete="tel"
                  inputMode="tel"
                  enterKeyHint="done"
                />
              </div>
            </div>
          )}

          {showSignupPrompt && exists === false ? (
            <div className="auth-alert">
              Bu hesap bulunamadı. Bu bilgilerle kayıt olmak ister misin?
              <div className="auth-footer-links">
                <button type="button" className="link-btn" onClick={handlePrecheckSignup}>
                  Evet, Kayıt Ol
                </button>
                <button type="button" className="link-btn" onClick={() => setShowSignupPrompt(false)}>
                  Vazgeç
                </button>
              </div>
            </div>
          ) : null}

          {exists === true ? (
            <div className="auth-field">
              <label htmlFor="password">Şifre</label>
              <div className="auth-input-wrap">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Şifren"
                  autoComplete="current-password"
                  enterKeyHint="done"
                />
                <button
                  type="button"
                  className="auth-toggle"
                  aria-label="Şifreyi göster/gizle"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? 'Gizle' : 'Göster'}
                </button>
              </div>
            </div>
          ) : null}

          {error ? <div className="auth-alert">{error}</div> : null}
          {showForgotLink ? (
            <button type="button" className="link-btn auth-forgot" onClick={() => navigate('/forgot-password')}>
              Şifremi unuttum
            </button>
          ) : null}

          <button
            type="submit"
            className="primary-btn"
            disabled={loading || exists === null || (exists === true && !password.trim())}
          >
            {loading
              ? 'İşleniyor...'
              : exists === true
                ? 'Giriş Yap'
                : exists === false
                  ? 'Kayıt Ol'
                  : 'Devam Et'}
          </button>
        </form>
      </ReusableBottomSheet>
    </div>
  );
}

export default Login;
