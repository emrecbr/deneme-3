import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { isAbsoluteHref, resolvePostAuthHref } from '../config/surfaces';
import { useAuth } from '../context/AuthContext';

const normalizeEmail = (v) =>
  String(v || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function EmailVerify() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingSignup, setLoadingSignup] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [signupName, setSignupName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupToken, setSignupToken] = useState('');

  const completeAuthRedirect = () => {
    const nextHref = resolvePostAuthHref('user', window.location.hostname);
    if (isAbsoluteHref(nextHref)) {
      window.location.href = nextHref;
      return;
    }
    navigate(nextHref, { replace: true });
  };

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
    setInfo('');
  };

  const send = async () => {
    resetMessages();
    const em = normalizeEmail(email);
    if (!em) {
      setError('E-posta zorunlu.');
      return;
    }
    if (!isValidEmail(em)) {
      setError('E-posta formatı geçersiz.');
      return;
    }
    setLoadingSend(true);
    try {
      await api.post('/auth/otp/send', { channel: 'email', email: em });
      setStep(2);
      setResendSeconds(60);
      setInfo('Kod gönderildi.');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Bağlantı hatası');
    } finally {
      setLoadingSend(false);
    }
  };

  const verify = async () => {
    resetMessages();
    const em = normalizeEmail(email);
    if (!isValidEmail(em)) {
      setError('Geçerli bir e-posta gir.');
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Kod 6 haneli olmalı.');
      return;
    }
    setLoadingVerify(true);
    try {
      const res = await api.post('/auth/otp/verify', {
        channel: 'email',
        email: em,
        code: code.trim()
      });
      const data = res?.data;

      if (data?.token) {
        localStorage.setItem('token', data.token);
        await login(data.token);
        completeAuthRedirect();
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
    if (!signupPassword) {
      setError('Şifre zorunlu.');
      return;
    }
    if (!signupToken) {
      setError('Signup token bulunamadı.');
      return;
    }
    setLoadingSignup(true);
    try {
      const res = await api.post('/auth/email/complete-signup', {
        signupToken,
        name: signupName.trim(),
        password: signupPassword
      });
      const data = res?.data;
      if (data?.token) {
        localStorage.setItem('token', data.token);
        await login(data.token);
        completeAuthRedirect();
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
    if (resendSeconds > 0 || loadingSend) {
      return;
    }
    await send();
  };

  return (
    <div className="otp-page">
      <div className="card otp-card">
        <h2>Email Doğrulama</h2>
        <p className="muted">E-posta adresin ile giriş yap.</p>

        {step === 1 && (
          <>
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
              Kod şu e-postaya gönderildi: <strong>{normalizeEmail(email)}</strong>
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
              {loadingVerify ? 'Doğrulanıyor…' : 'Doğrula'}
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
            <p className="muted">
              Bu e-posta kayıtlı değil. Yeni hesap oluşturmak ister misin?
            </p>
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
                autoComplete="new-password"
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

export default EmailVerify;
