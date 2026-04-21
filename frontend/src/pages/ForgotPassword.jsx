import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const normalizeEmail = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const canSend = useMemo(() => {
    if (loading) return false;
    return isValidEmail(normalizeEmail(email));
  }, [email, loading]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setInfo('');

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      setError('Gecerli bir e-posta gir.');
      return;
    }

    try {
      setLoading(true);
      await api.post('/auth/password/forgot', { method: 'email', email: normalizedEmail });
      setInfo('Eger hesap varsa dogrulama kodu gonderildi.');
      setSent(true);
      navigate(`/reset-password?email=${encodeURIComponent(normalizedEmail)}`);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Talimatlar gonderilemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="card auth-card">
        <div className="auth-logo">Talepet</div>
        <h1 className="auth-title">Sifremi Unuttum</h1>
        <p className="auth-subtitle">E-posta adresine sifre sifirlama kodu gonder.</p>
        <p className="muted small">
          Google veya Apple ile giris yaptiysan sifren saglayicidadir. Istersen uygulama sifresi
          olusturabilirsin.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
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

          {error ? <div className="auth-alert">{error}</div> : null}
          {info ? <div className="auth-alert">{info}</div> : null}

          <button type="submit" className="primary-btn" disabled={!canSend}>
            {loading ? 'Gonderiliyor...' : sent ? 'Kodu Tekrar Gonder' : 'Kod Gonder'}
          </button>
        </form>

        <button type="button" className="link-btn auth-forgot" onClick={() => navigate('/login')}>
          Giris ekranina don
        </button>
      </div>
    </div>
  );
}

export default ForgotPassword;
