import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { buildProviderAuthUrl } from '../api/axios';
import { isAbsoluteHref, isWebSurfaceHost, resolvePostAuthHref } from '../config/surfaces';
import { useAuth } from '../context/AuthContext';

const EMAIL_REGEX = /\S+@\S+\.\S+/;

function RegisterOtp({ embedded = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const webSurface = isWebSurfaceHost();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);

  const completeAuthRedirect = () => {
    const nextHref = resolvePostAuthHref('user', window.location.hostname);
    if (isAbsoluteHref(nextHref)) {
      window.location.href = nextHref;
      return;
    }
    navigate(nextHref, { replace: true });
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextEmail = params.get('email');
    if (nextEmail) {
      setEmail(String(nextEmail));
    }
  }, [location.search]);

  const targetLabel = useMemo(() => email.trim(), [email]);

  useEffect(() => {
    if (resendSeconds <= 0) {
      return undefined;
    }
    const timer = setInterval(() => {
      setResendSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const validateTarget = () => {
    if (!email.trim()) {
      return 'E-posta zorunlu.';
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      return 'E-posta formati gecersiz.';
    }
    return '';
  };

  const sendOtp = async () => {
    resetMessages();
    const validationError = validateTarget();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoadingSend(true);
    try {
      await api.post('/auth/register/otp/send', { method: 'email', email: email.trim() });
      setStep(2);
      setResendSeconds(60);
      setSuccess('Kod gonderildi.');
    } catch (err) {
      if (err?.response?.data?.code === 'TWILIO_TRIAL_UNVERIFIED') {
        setError('SMS gonderilemedi. Trial hesap sadece dogrulanmis numaralara SMS gonderir.');
      } else if (err?.response?.data?.code === 'TWILIO_GEO_BLOCKED') {
        setError('Bu ulkeye SMS gonderimi kapali.');
      } else if (err?.response?.data?.code === 'TWILIO_INVALID_PHONE') {
        setError('Numara formati hatali (5XXXXXXXXX).');
      } else {
        setError(err?.response?.data?.message || err?.message || 'Kod gonderilemedi.');
      }
    } finally {
      setLoadingSend(false);
    }
  };

  const verifyOtp = async () => {
    resetMessages();

    if (!/^\d{6}$/.test(code.trim())) {
      setError('Kod 6 haneli olmali.');
      return;
    }
    if (!name.trim()) {
      setError('Ad Soyad zorunlu.');
      return;
    }
    if (!password) {
      setError('Sifre zorunlu.');
      return;
    }

    setLoadingVerify(true);
    try {
      const response = await api.post('/auth/register/otp/verify', {
        method: 'email',
        email: email.trim(),
        code: code.trim(),
        name: name.trim(),
        password
      });
      const data = response?.data;

      if (data?.token) {
        await login(data.token);
      }

      setSuccess('Kayit tamamlandi.');
      completeAuthRedirect();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Dogrulama basarisiz.');
    } finally {
      setLoadingVerify(false);
    }
  };

  const resendOtp = async () => {
    if (resendSeconds > 0 || loadingSend) {
      return;
    }
    await sendOtp();
  };

  const handleProviderLogin = (provider) => {
    window.location.href = buildProviderAuthUrl(provider);
  };

  const registerCard = (
    <div className={`card otp-card ${webSurface && !embedded ? 'otp-card--website' : ''}`}>
      <div className="auth-header">
        <div className="website-auth-inline-head website-auth-inline-head--compact">
          <h2>Kayit Ol</h2>
          <p>
            Website icinde hesap olustur, teklif almaya ve uygun oldugunda urun alanina gecmeye hazir ol.
          </p>
        </div>
        <button type="button" className="link-btn" onClick={() => navigate('/login')}>
          Giris Yap&apos;a don
        </button>
      </div>

      <p className="muted">
        E-posta ile kayit dogrulamasi yap. Ayni backend auth, OTP ve social auth altyapisi burada da calisir.
      </p>

      {webSurface ? (
        <div className="website-auth-register-benefits">
          <div className="website-auth-register-benefit">
            <strong>Talep olustur</strong>
            <span>Kategori ve konuma gore isabetli talep akisina hizli basla.</span>
          </div>
          <div className="website-auth-register-benefit">
            <strong>Teklifleri yonet</strong>
            <span>Gelen teklifleri ve profil gecmisini tek hesap uzerinden takip et.</span>
          </div>
          <div className="website-auth-register-benefit">
            <strong>Guven katmani</strong>
            <span>Moderasyon, dogrulama ve premium gorunurluk imkanlarini kullan.</span>
          </div>
        </div>
      ) : null}

      <div className="auth-social">
        <div className="muted small">Hizli devam et</div>
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
              <path d="M16.7 13.1c0 2.1 1.8 2.8 1.9 2.9-.0.1-.3 1.2-1 2.4-.6 1.1-1.3 2.1-2.4 2.1-1 0-1.3-.6-2.5-.6-1.1 0-1.5.6-2.5.6-1.1 0-1.9-1-2.6-2.1-1.4-2.2-2.5-6.2-1-8.9.7-1.3 2-2.2 3.4-2.2 1.1 0 2 .7 2.5.7.5 0 1.6-.8 2.8-.7.5 0 2 .2 3 1.6-.1.1-1.8 1-1.8 3.2z" />
              <path d="M14.9 3.2c.7-.8 1.2-1.9 1.1-3.2-1 .1-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 3 1.1.1 2.1-.6 2.7-1.3z" />
            </svg>
          </span>
          <span className="social-text">Apple ile devam et</span>
        </button>
      </div>

      <div className="auth-divider">
        <span>veya</span>
      </div>

      {step === 1 ? (
        <>
          <div className="form-group">
            <label>E-posta</label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ornek@mail.com"
            />
          </div>

          <button type="button" className="primary-btn" onClick={sendOtp} disabled={loadingSend}>
            {loadingSend ? 'Gonderiliyor...' : 'Kod Gonder'}
          </button>
        </>
      ) : (
        <>
          <p className="muted small">
            Kod suraya gonderildi: <strong>{targetLabel}</strong>
          </p>

          <div className="form-group">
            <label>Dogrulama Kodu</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="123456"
              maxLength={6}
            />
          </div>

          <div className="form-group">
            <label>Ad Soyad</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ad Soyad"
            />
          </div>

          <div className="form-group">
            <label>Sifre</label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Sifre"
            />
          </div>

          <button type="button" className="primary-btn" onClick={verifyOtp} disabled={loadingVerify}>
            {loadingVerify ? 'Dogrulaniyor...' : 'Dogrula ve Kayit Ol'}
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={resendOtp}
            disabled={resendSeconds > 0 || loadingSend}
          >
            {resendSeconds > 0 ? `Tekrar gonder (${resendSeconds}s)` : 'Kodu tekrar gonder'}
          </button>
        </>
      )}

      {error ? <div className="alert error">{error}</div> : null}
      {success ? <div className="alert success">{success}</div> : null}

      <div className="auth-footer">
        <span>Zaten hesabin var mi?</span>
        <button type="button" className="link-btn" onClick={() => navigate('/login')}>
          Giris Yap
        </button>
      </div>
    </div>
  );

  if (webSurface && embedded) {
    return registerCard;
  }

  return (
    <div className={`otp-page ${webSurface ? 'otp-page--website' : ''}`}>
      {registerCard}
    </div>
  );
}

export default RegisterOtp;
