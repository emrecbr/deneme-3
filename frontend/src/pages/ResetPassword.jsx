import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';

const onlyDigits = (v) => String(v || '').replace(/\D/g, '');
const normalizeTrMobileTo10Digits = (v) => {
  let d = onlyDigits(v);
  if (d.startsWith('90')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length > 10) d = d.slice(0, 10);
  return d;
};
const toE164TR = (d10) => (/^[5]\d{9}$/.test(d10) ? `+90${d10}` : '');
const normalizeEmail = (v) =>
  String(v || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const passwordPolicy = (value) => {
  const text = String(value || '');
  return text.length >= 8;
};

function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const methodFromQuery = params.get('method') || '';
  const emailFromQuery = params.get('email') || '';
  const phoneFromQuery = params.get('phone') || '';

  const [method, setMethod] = useState(methodFromQuery === 'sms' ? 'sms' : 'email');
  const [email, setEmail] = useState(emailFromQuery);
  const [phoneDigits, setPhoneDigits] = useState(
    phoneFromQuery.replace('+90', '').replace(/\D/g, '').slice(0, 10)
  );
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resetSessionToken, setResetSessionToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownLeft((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownLeft]);

  const handleVerify = async (event) => {
    event.preventDefault();
    setError('');
    setInfo('');
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Kod 6 haneli olmalı.');
      return;
    }
    try {
      setVerifying(true);
      if (method === 'email') {
        const em = normalizeEmail(email);
        if (!isValidEmail(em)) {
          setError('Geçerli bir e-posta gir.');
          return;
        }
        const res = await api.post('/auth/password/verify', {
          method: 'email',
          email: em,
          code: code.trim()
        });
        const data = res?.data;
        setResetSessionToken(data?.resetSessionToken || '');
        setInfo('Doğrulama başarılı. Yeni şifre oluştur.');
      } else {
        const e164 = toE164TR(phoneDigits);
        if (!e164) {
          setError('Telefon 10 hane olmalı (5xx...).');
          return;
        }
        const res = await api.post('/auth/password/verify', {
          method: 'sms',
          phone: e164,
          code: code.trim()
        });
        const data = res?.data;
        setResetSessionToken(data?.resetSessionToken || '');
        setInfo('Doğrulama başarılı. Yeni şifre oluştur.');
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Doğrulama başarısız.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setInfo('');
    try {
      setResending(true);
      if (method === 'email') {
        const em = normalizeEmail(email);
        if (!isValidEmail(em)) {
          setError('Geçerli bir e-posta gir.');
          return;
        }
        await api.post('/auth/password/forgot', { method: 'email', email: em });
      } else {
        const e164 = toE164TR(phoneDigits);
        if (!e164) {
          setError('Telefon 10 hane olmalı (5xx...).');
          return;
        }
        await api.post('/auth/password/forgot', { method: 'sms', phone: e164 });
      }
      setInfo('Eğer hesap varsa doğrulama kodu gönderildi.');
      setCooldownLeft(60);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Kod gönderilemedi.');
    } finally {
      setResending(false);
    }
  };

  const handleReset = async (event) => {
    event.preventDefault();
    setError('');
    setInfo('');
    if (!resetSessionToken) {
      setError('Doğrulama gerekiyor.');
      return;
    }
    if (!newPassword || !confirmPassword) {
      setError('Şifre alanları zorunlu.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Şifreler eşleşmiyor.');
      return;
    }
    if (!passwordPolicy(newPassword)) {
      setError('Şifre en az 8 karakter olmalı.');
      return;
    }
    try {
      setSaving(true);
      await api.post('/auth/password/reset', {
        resetSessionToken,
        newPassword
      });
      setInfo('Şifre güncellendi.');
      setTimeout(() => navigate('/login'), 1200);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Şifre güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="card auth-card">
        <div className="auth-logo">Talepet</div>
        <h1 className="auth-title">Şifre Sıfırla</h1>
        <p className="auth-subtitle">Doğrula ve yeni şifre oluştur.</p>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${method === 'email' ? 'active' : ''}`}
            onClick={() => {
              setMethod('email');
              setError('');
              setInfo('');
            }}
          >
            E-posta
          </button>
          <button
            type="button"
            className={`auth-tab ${method === 'sms' ? 'active' : ''}`}
            onClick={() => {
              setMethod('sms');
              setError('');
              setInfo('');
            }}
          >
            Telefon
          </button>
        </div>

        <form className="auth-form" onSubmit={handleVerify}>
          {method === 'email' ? (
            <div className="auth-field">
              <label>E-posta</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ornek@mail.com"
              />
            </div>
          ) : (
            <div className="auth-field">
              <label>Telefon</label>
              <div className="auth-phone-wrap">
                <span className="auth-prefix">+90</span>
                <input
                  type="tel"
                  value={phoneDigits}
                  onChange={(event) => setPhoneDigits(normalizeTrMobileTo10Digits(event.target.value))}
                  placeholder="5xx xxx xx xx"
                  autoComplete="tel"
                  inputMode="tel"
                />
              </div>
            </div>
          )}
          <div className="auth-field">
            <label>Kod</label>
            <input
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
            />
          </div>
          <div className="auth-footer-links">
            <button type="submit" className="secondary-btn" disabled={verifying}>
              {verifying ? 'Doğrulanıyor...' : 'Kodu Doğrula'}
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={handleResend}
              disabled={resending || cooldownLeft > 0}
            >
              {cooldownLeft > 0 ? `Tekrar gönder (${cooldownLeft}s)` : resending ? 'Gönderiliyor...' : 'Kodu tekrar gönder'}
            </button>
          </div>
        </form>

        {resetSessionToken ? (
          <form className="auth-form" onSubmit={handleReset}>
            <div className="auth-field">
              <label>Yeni Şifre</label>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Yeni şifre"
                autoComplete="new-password"
              />
            </div>
            <div className="auth-field">
              <label>Yeni Şifre (Tekrar)</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Yeni şifre tekrar"
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="primary-btn" disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
            </button>
          </form>
        ) : null}

        {error ? <div className="auth-alert">{error}</div> : null}
        {info ? <div className="auth-alert">{info}</div> : null}

        <button type="button" className="link-btn auth-forgot" onClick={() => navigate('/login')}>
          Giriş ekranına dön
        </button>
      </div>
    </div>
  );
}

export default ResetPassword;
