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
  return text.length >= 3 && /[A-Z]/.test(text) && /[0-9]/.test(text) && /[^A-Za-z0-9]/.test(text);
};

function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const methodFromQuery = params.get('method') || '';
  const tokenFromQuery = params.get('token') || '';
  const emailFromQuery = params.get('email') || '';

  const [method, setMethod] = useState(methodFromQuery === 'sms' ? 'sms' : 'email');
  const [email, setEmail] = useState(emailFromQuery);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resetSessionToken, setResetSessionToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (method !== 'email' || !tokenFromQuery || !emailFromQuery) {
      return;
    }
    const verifyEmailToken = async () => {
      setError('');
      setInfo('');
      setVerifying(true);
      try {
        const em = normalizeEmail(emailFromQuery);
        const res = await api.post('/auth/password/verify', {
          method: 'email',
          email: em,
          token: tokenFromQuery
        });
        const data = res?.data;
        setResetSessionToken(data?.resetSessionToken || '');
        setInfo('Doğrulama başarılı. Yeni şifre oluştur.');
      } catch (requestError) {
        setError(requestError?.response?.data?.message || requestError?.message || 'Doğrulama başarısız.');
      } finally {
        setVerifying(false);
      }
    };
    verifyEmailToken();
  }, [method, tokenFromQuery, emailFromQuery]);

  const handleVerifySms = async (event) => {
    event.preventDefault();
    setError('');
    setInfo('');
    const e164 = toE164TR(phoneDigits);
    if (!e164) {
      setError('Telefon 10 hane olmalı (5xx...).');
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Kod 6 haneli olmalı.');
      return;
    }
    try {
      setVerifying(true);
      const res = await api.post('/auth/password/verify', {
        method: 'sms',
        phone: e164,
        code: code.trim()
      });
      const data = res?.data;
      setResetSessionToken(data?.resetSessionToken || '');
      setInfo('Doğrulama başarılı. Yeni şifre oluştur.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Doğrulama başarısız.');
    } finally {
      setVerifying(false);
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
      setError('Şifre en az 3 karakter, 1 büyük harf, 1 sayı ve 1 özel karakter içermeli.');
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
              if (!tokenFromQuery) {
                setMethod('email');
                setError('');
                setInfo('');
              }
            }}
            disabled={Boolean(tokenFromQuery)}
          >
            E-posta
          </button>
          <button
            type="button"
            className={`auth-tab ${method === 'sms' ? 'active' : ''}`}
            onClick={() => {
              if (!tokenFromQuery) {
                setMethod('sms');
                setError('');
                setInfo('');
              }
            }}
            disabled={Boolean(tokenFromQuery)}
          >
            Telefon
          </button>
        </div>

        {method === 'email' ? (
          <div className="auth-form">
            <div className="auth-field">
              <label>E-posta</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={Boolean(tokenFromQuery)}
                placeholder="ornek@mail.com"
              />
            </div>
            {!tokenFromQuery ? (
              <div className="muted small">E-posta linkiyle bu sayfayı açmalısın.</div>
            ) : null}
            {verifying ? <div className="muted small">Doğrulanıyor...</div> : null}
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleVerifySms}>
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
            <button type="submit" className="secondary-btn" disabled={verifying}>
              {verifying ? 'Doğrulanıyor...' : 'Kodu Doğrula'}
            </button>
          </form>
        )}

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
