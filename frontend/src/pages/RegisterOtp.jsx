import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { buildProviderAuthUrl } from '../api/axios';
import { isAbsoluteHref, resolvePostAuthHref } from '../config/surfaces';

const EMAIL_REGEX = /\S+@\S+\.\S+/;

const onlyDigits = (v) => String(v || '').replace(/\D/g, '');
const normalizePhoneDigits = (v) => {
  let d = onlyDigits(v);
  if (d.startsWith('90')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length > 10) d = d.slice(0, 10);
  return d;
};
const toE164TR = (d10) => {
  if (!/^[5]\d{9}$/.test(d10)) return '';
  return `+90${d10}`;
};
const normalizePhone = (value) => toE164TR(normalizePhoneDigits(value));

function RegisterOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);

  const completeAuthRedirect = () => {
    const nextHref = resolvePostAuthHref('user');
    if (isAbsoluteHref(nextHref)) {
      window.location.href = nextHref;
      return;
    }
    navigate(nextHref, { replace: true });
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextMethod = params.get('method');
    const nextEmail = params.get('email');
    const nextPhone = params.get('phone');
    if (nextMethod === 'sms' || nextMethod === 'email') {
      setMethod(nextMethod);
    }
    if (nextEmail) {
      setEmail(String(nextEmail));
    }
    if (nextPhone) {
      setPhone(normalizePhoneDigits(String(nextPhone)));
    }
  }, [location.search]);

  const targetLabel = useMemo(() => {
    if (method === 'email') {
      return email.trim();
    }
    return normalizePhone(phone);
  }, [method, email, phone]);

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
    if (method === 'email') {
      if (!email.trim()) {
        return 'E-posta zorunlu.';
      }
      if (!EMAIL_REGEX.test(email.trim())) {
        return 'E-posta formatı geçersiz.';
      }
      return '';
    }
    if (!normalizePhone(phone)) {
      return 'Telefon zorunlu.';
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
      const payload =
        method === 'email'
          ? { method, email: email.trim() }
          : { method, phone: normalizePhone(phone) };

      await api.post('/auth/register/otp/send', payload);
      setStep(2);
      setResendSeconds(60);
      setSuccess('Kod gönderildi.');
    } catch (err) {
      if (err?.response?.data?.code === 'TWILIO_TRIAL_UNVERIFIED') {
        setError('SMS gönderilemedi. Trial hesap sadece doğrulanmış numaralara SMS gönderir.');
      } else if (err?.response?.data?.code === 'TWILIO_GEO_BLOCKED') {
        setError('Bu ülkeye SMS gönderimi kapalı.');
      } else if (err?.response?.data?.code === 'TWILIO_INVALID_PHONE') {
        setError('Numara formatı hatalı (5XXXXXXXXX).');
      } else {
        setError(err?.response?.data?.message || err?.message || 'Kod gönderilemedi.');
      }
    } finally {
      setLoadingSend(false);
    }
  };

  const verifyOtp = async () => {
    resetMessages();
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Kod 6 haneli olmalı.');
      return;
    }
    if (!name.trim()) {
      setError('Ad Soyad zorunlu.');
      return;
    }
    if (!password) {
      setError('Şifre zorunlu.');
      return;
    }
    setLoadingVerify(true);
    try {
      const payload =
        method === 'email'
          ? { method, email: email.trim(), code: code.trim(), name: name.trim(), password }
          : { method, phone: normalizePhone(phone), code: code.trim(), name: name.trim(), password };

      const res = await api.post('/auth/register/otp/verify', payload);
      const data = res?.data;
      if (data?.token) {
        localStorage.setItem('token', data.token);
      }
      setSuccess('Kayıt tamamlandı.');
      completeAuthRedirect();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Doğrulama başarısız.');
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

  const buildAuthUrl = (provider) => {
    return buildProviderAuthUrl(provider);
  };

  const handleProviderLogin = (provider) => {
    window.location.href = buildAuthUrl(provider);
  };

  return (
    <div className="otp-page">
      <div className="card otp-card">
        <div className="auth-header">
          <h2>Kayıt Ol</h2>
          <button type="button" className="link-btn" onClick={() => navigate('/login')}>
            Giriş Yap’a dön
          </button>
        </div>
        <p className="muted">E-posta veya telefon ile kayıt doğrulaması yap.</p>

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

        <div className="auth-divider">
          <span>veya</span>
        </div>

        <div className="otp-channel">
          <button
            type="button"
            className={`secondary-btn ${method === 'email' ? 'active' : ''}`}
            onClick={() => {
              setMethod('email');
              setStep(1);
              setCode('');
              resetMessages();
            }}
          >
            E-posta
          </button>
          <button
            type="button"
            className={`secondary-btn ${method === 'sms' ? 'active' : ''}`}
            onClick={() => {
              setMethod('sms');
              setStep(1);
              setCode('');
              resetMessages();
            }}
          >
            Telefon
          </button>
        </div>

        {step === 1 && (
          <>
            {method === 'email' ? (
              <div className="form-group">
                <label>E-posta</label>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
            ) : (
              <div className="form-group">
                <label>Telefon</label>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+90 5xx xxx xx xx"
                />
              </div>
            )}

            <button
              type="button"
              className="primary-btn"
              onClick={sendOtp}
              disabled={loadingSend}
            >
              {loadingSend ? 'Gönderiliyor…' : 'Kod Gönder'}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <p className="muted small">
              Kod şuraya gönderildi: <strong>{targetLabel}</strong>
            </p>

            <div className="form-group">
              <label>Doğrulama Kodu</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
              />
            </div>

            <div className="form-group">
              <label>Ad Soyad</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ad Soyad"
              />
            </div>

            <div className="form-group">
              <label>Şifre</label>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Şifre"
              />
            </div>

            <button
              type="button"
              className="primary-btn"
              onClick={verifyOtp}
              disabled={loadingVerify}
            >
              {loadingVerify ? 'Doğrulanıyor…' : 'Doğrula ve Kayıt Ol'}
            </button>

            <button
              type="button"
              className="secondary-btn"
              onClick={resendOtp}
              disabled={resendSeconds > 0 || loadingSend}
            >
              {resendSeconds > 0 ? `Tekrar gönder (${resendSeconds}s)` : 'Kodu tekrar gönder'}
            </button>
          </>
        )}

        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}

        <div className="auth-footer">
          <span>Zaten hesabın var mı?</span>
          <button type="button" className="link-btn" onClick={() => navigate('/login')}>
            Giriş Yap
          </button>
        </div>
      </div>
    </div>
  );
}

export default RegisterOtp;
