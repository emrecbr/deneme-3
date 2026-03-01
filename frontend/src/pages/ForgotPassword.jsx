import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { post } from '../api/client';

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

function ForgotPassword() {
  const navigate = useNavigate();
  const [method, setMethod] = useState('email');
  const [email, setEmail] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setInfo('');
    if (method === 'email') {
      const em = normalizeEmail(email);
      if (!isValidEmail(em)) {
        setError('Geçerli bir e-posta gir.');
        return;
      }
      try {
        setLoading(true);
        await post('/api/auth/password/forgot', { method: 'email', email: em });
        setInfo('Eğer hesap varsa talimatlar gönderildi.');
      } catch (requestError) {
        setError(requestError?.message || 'Talimatlar gönderilemedi.');
      } finally {
        setLoading(false);
      }
      return;
    }

    const e164 = toE164TR(phoneDigits);
    if (!e164) {
      setError('Telefon 10 hane olmalı (5xx...).');
      return;
    }
    try {
      setLoading(true);
      await post('/api/auth/password/forgot', { method: 'sms', phone: e164 });
      setInfo('Eğer hesap varsa talimatlar gönderildi.');
    } catch (requestError) {
      if (requestError?.data?.code === 'TWILIO_TRIAL_UNVERIFIED') {
        setError('SMS gönderilemedi. Trial hesap sadece doğrulanmış numaralara SMS gönderir.');
      } else if (requestError?.data?.code === 'TWILIO_GEO_BLOCKED') {
        setError('Bu ülkeye SMS gönderimi kapalı.');
      } else if (requestError?.data?.code === 'TWILIO_INVALID_PHONE') {
        setError('Numara formatı hatalı (5XXXXXXXXX).');
      } else {
        setError(requestError?.message || 'Talimatlar gönderilemedi.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="card auth-card">
        <div className="auth-logo">Talepet</div>
        <h1 className="auth-title">Şifremi Unuttum</h1>
        <p className="auth-subtitle">Şifre sıfırlama talimatlarını gönder.</p>
        <p className="muted small">
          Google/Apple ile giriş yaptıysan şifren sağlayıcıdadır. İstersen uygulama şifresi oluşturabilirsin.
        </p>

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

        <form onSubmit={handleSubmit} className="auth-form">
          {method === 'email' ? (
            <div className="auth-field">
              <label htmlFor="email">E-posta</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ornek@mail.com"
                autoComplete="email"
                inputMode="email"
              />
            </div>
          ) : (
            <div className="auth-field">
              <label htmlFor="phone">Telefon</label>
              <div className="auth-phone-wrap">
                <span className="auth-prefix">+90</span>
                <input
                  id="phone"
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

          {error ? <div className="auth-alert">{error}</div> : null}
          {info ? <div className="auth-alert">{info}</div> : null}

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Gönderiliyor...' : 'Sıfırlama Gönder'}
          </button>
        </form>

        <button type="button" className="link-btn auth-forgot" onClick={() => navigate('/login')}>
          Giriş ekranına dön
        </button>
      </div>
    </div>
  );
}

export default ForgotPassword;
