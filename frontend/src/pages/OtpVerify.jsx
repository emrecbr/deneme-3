import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { isAbsoluteHref, resolvePostAuthHref } from '../config/surfaces';

const EMAIL_REGEX = /\S+@\S+\.\S+/;

const normalizePhone = (value) => String(value || '').trim();

function OtpVerify({ onVerified }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [channel, setChannel] = useState('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
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

  const targetLabel = useMemo(() => {
    if (channel === 'email') {
      return email.trim();
    }
    return normalizePhone(phone);
  }, [channel, email, phone]);

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
    if (channel === 'email') {
      if (!email.trim()) {
        return 'E-posta zorunlu.';
      }
      if (!EMAIL_REGEX.test(email.trim())) {
        return 'E-posta formatı geçersiz.';
      }
      return '';
    }
    if (!phone.trim()) {
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
        channel === 'email'
          ? { channel, email: email.trim() }
          : { channel, phone: normalizePhone(phone) };

      await api.post('/auth/otp/send', payload);
      setStep(2);
      setResendSeconds(60);
      setSuccess('Kod gönderildi.');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Kod gönderilemedi.');
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
    setLoadingVerify(true);
    try {
      const payload =
        channel === 'email'
          ? { channel, email: email.trim(), code: code.trim() }
          : { channel, phone: normalizePhone(phone), code: code.trim() };

      await api.post('/auth/otp/verify', payload);
      setSuccess('Doğrulama başarılı.');
      if (typeof onVerified === 'function') {
        onVerified();
      } else {
        completeAuthRedirect();
      }
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

  return (
    <div className="otp-page">
      <div className="card otp-card">
        <h2>OTP Doğrulama</h2>
        <p className="muted">E-posta veya telefon ile doğrulama yap.</p>

        <div className="otp-channel">
          <button
            type="button"
            className={`secondary-btn ${channel === 'email' ? 'active' : ''}`}
            onClick={() => {
              setChannel('email');
              setStep(1);
              setCode('');
              resetMessages();
            }}
          >
            E-posta
          </button>
          <button
            type="button"
            className={`secondary-btn ${channel === 'sms' ? 'active' : ''}`}
            onClick={() => {
              setChannel('sms');
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
            {channel === 'email' ? (
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

            <button
              type="button"
              className="primary-btn"
              onClick={verifyOtp}
              disabled={loadingVerify}
            >
              {loadingVerify ? 'Doğrulanıyor…' : 'Doğrula'}
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
      </div>
    </div>
  );
}

export default OtpVerify;
