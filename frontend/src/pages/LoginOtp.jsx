import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

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

function LoginOtp() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [method, setMethod] = useState('sms');
  const [step, setStep] = useState(1);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingSignup, setLoadingSignup] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [signupToken, setSignupToken] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = setInterval(() => {
      setResendSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  const resetMessages = () => {
    setError('');
    setInfo('');
  };

  const send = async () => {
    resetMessages();
    if (method === 'sms') {
      const e164 = toE164TR(phoneDigits);
      if (!e164) {
        setError('Telefon 10 haneli olmalı ve 5 ile başlamalı.');
        return;
      }
      setLoadingSend(true);
      try {
        await api.post('/auth/sms/send', { phone: e164 });
        setStep(2);
        setResendSeconds(60);
        setInfo('Kod gönderildi.');
      } catch (err) {
        if (err?.response?.data?.code === 'TWILIO_TRIAL_UNVERIFIED') {
          setError('SMS gönderilemedi. Trial hesap sadece doğrulanmış numaralara SMS gönderir.');
        } else if (err?.response?.data?.code === 'TWILIO_GEO_BLOCKED') {
          setError('Bu ülkeye SMS gönderimi kapalı.');
        } else if (err?.response?.data?.code === 'TWILIO_INVALID_PHONE') {
          setError('Numara formatı hatalı (5XXXXXXXXX).');
        } else {
          setError(err?.response?.data?.message || err?.message || 'Bağlantı hatası');
        }
      } finally {
        setLoadingSend(false);
      }
      return;
    }

    const em = normalizeEmail(email);
    if (!isValidEmail(em)) {
      setError('Geçerli bir e-posta gir.');
      return;
    }
    setLoadingSend(true);
    try {
      await api.post('/auth/otp/send', { channel: 'email', email: em });
      setStep(2);
      setResendSeconds(60);
      setInfo('Kod gönderildi.');
    } catch (err) {
      setError(err?.message || 'Bağlantı hatası');
    } finally {
      setLoadingSend(false);
    }
  };

  const verify = async () => {
    resetMessages();
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Kod 6 haneli olmalı.');
      return;
    }

    setLoadingVerify(true);
    try {
      let data;
      if (method === 'sms') {
        const e164 = toE164TR(phoneDigits);
        if (!e164) {
          setError('Telefon 10 haneli olmalı ve 5 ile başlamalı.');
          return;
        }
        const res = await api.post('/auth/sms/verify', { phone: e164, code: code.trim() });
        data = res?.data;
      } else {
        const em = normalizeEmail(email);
        if (!isValidEmail(em)) {
          setError('Geçerli bir e-posta gir.');
          return;
        }
        const res = await api.post('/auth/otp/verify', {
          channel: 'email',
          email: em,
          code: code.trim()
        });
        data = res?.data;
      }

      if (data?.token) {
        localStorage.setItem('token', data.token);
        await login(data.token);
        navigate('/app');
        return;
      }
      if (data?.signup_required) {
        setSignupToken(data.signupToken || '');
        setModalOpen(true);
        return;
      }
      setInfo(data?.message || 'Doğrulandı.');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Bağlantı hatası');
    } finally {
      setLoadingVerify(false);
    }
  };

  const completeSignup = async () => {
    resetMessages();
    if (!signupName.trim()) {
      setError('Ad Soyad zorunlu.');
      return;
    }
    if (!signupPassword.trim()) {
      setError('Şifre zorunlu.');
      return;
    }
    if (!signupToken) {
      setError('Signup token bulunamadı.');
      return;
    }

    setLoadingSignup(true);
    try {
      const endpoint =
        method === 'sms' ? '/auth/sms/complete-signup' : '/auth/email/complete-signup';
      const res = await api.post(endpoint, {
        signupToken,
        name: signupName.trim(),
        password: signupPassword
      });
      const data = res?.data;
      if (data?.token) {
        localStorage.setItem('token', data.token);
        await login(data.token);
        navigate('/app');
        return;
      }
      setInfo(data?.message || 'Kayıt tamamlandı.');
      setModalOpen(false);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Bağlantı hatası');
    } finally {
      setLoadingSignup(false);
    }
  };

  const resend = async () => {
    if (resendSeconds > 0 || loadingSend) return;
    await send();
  };

  return (
    <div className="otp-page">
      <div className="card otp-card">
        <h2>OTP ile Giriş</h2>
        <p className="muted">E-posta veya telefon ile doğrulama yap.</p>

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
            {method === 'sms' ? (
              <div className="form-group phone-row">
                <label>Telefon</label>
                <div className="phone-input">
                  <span className="phone-prefix">+90</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phoneDigits}
                    onChange={(e) =>
                      setPhoneDigits(normalizeTrMobileTo10Digits(e.target.value))
                    }
                    placeholder="5xx xxx xx xx"
                  />
                </div>
                <div className="input-helper">Sadece 10 hane yaz (5 ile başlayan).</div>
              </div>
            ) : (
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
            )}

            <button
              type="button"
              className="primary-btn"
              onClick={send}
              disabled={loadingSend}
            >
              {loadingSend ? 'Gönderiliyor…' : 'Kod Gönder'}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <p className="muted small">
              Kod şu hedefe gönderildi:{' '}
              <strong>
                {method === 'sms' ? toE164TR(phoneDigits) : normalizeEmail(email)}
              </strong>
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
            <button
              type="button"
              className="primary-btn"
              onClick={verify}
              disabled={loadingVerify}
            >
              {loadingVerify ? 'Doğrulanıyor…' : 'Doğrula / Giriş Yap'}
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={resend}
              disabled={resendSeconds > 0 || loadingSend}
            >
              {resendSeconds > 0 ? `Tekrar gönder (${resendSeconds}s)` : 'Kodu tekrar gönder'}
            </button>
          </>
        )}

        {error && <div className="alert error">{error}</div>}
        {info && <div className="alert success">{info}</div>}
      </div>

      {modalOpen && (
        <div className="otp-modal-overlay">
          <div className="otp-modal">
            <h3>Hesap Oluştur</h3>
            <p className="muted">Hesap oluşturmak ister misin?</p>
            <div className="form-group">
              <label>Ad Soyad</label>
              <input
                type="text"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                placeholder="Ad Soyad"
              />
            </div>
            <div className="form-group">
              <label>Şifre</label>
              <input
                type="password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="Şifre"
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setModalOpen(false)}
                disabled={loadingSignup}
              >
                Hayır
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={completeSignup}
                disabled={loadingSignup}
              >
                {loadingSignup ? 'Kaydediliyor…' : 'Hesap Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginOtp;
