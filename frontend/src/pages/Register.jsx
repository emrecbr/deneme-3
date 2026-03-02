import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

function Register() {
  const navigate = useNavigate();
  const apiBase = (import.meta.env.VITE_API_URL || 'https://api.talepet.net.tr/api')
    .trim()
    .replace(/\/$/, '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [helper, setHelper] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setHelper('');
    if (!password) {
      setError('Şifre zorunlu');
      return;
    }
    if (!passwordConfirm) {
      setError('Şifre tekrarı zorunlu');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Şifreler eşleşmiyor');
      return;
    }
    const policyOk =
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[^A-Za-z0-9]/.test(password);
    if (!policyOk) {
      setError('Şifre en az 8 karakter, 1 büyük harf, 1 sayı ve 1 özel karakter içermeli.');
      return;
    }
    setLoading(true);

    try {
      const response = await api.post('/auth/register', { name, email, password });

      if (!response.data.success) {
        setError(response.data.message || 'Kayıt başarısız.');
        return;
      }

      alert('Kayıt başarılı');
      navigate('/login');
    } catch (registerError) {
      setError(registerError.response?.data?.message || 'Kayıt başarısız.');
    } finally {
      setLoading(false);
    }
  };

  const buildAuthUrl = (provider) => {
    return `${apiBase}/auth/${provider}`;
  };

  const handleProviderLogin = (provider) => {
    window.location.href = buildAuthUrl(provider);
  };

  return (
    <div className="page">
      <div className="card auth-card">
        <div className="auth-header">
          <h1>Kayıt Ol</h1>
          <button type="button" className="link-btn" onClick={() => navigate('/login')}>
            Girişe dön
          </button>
        </div>

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

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Ad Soyad</label>
            <input
              id="name"
              name="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Şifre</label>
            <div className="auth-input-wrap">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                required
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

          <div className="form-group">
            <label htmlFor="passwordConfirm">Şifre (Tekrar)</label>
            <div className="auth-input-wrap">
              <input
                id="passwordConfirm"
                name="passwordConfirm"
                type={showPassword2 ? 'text' : 'password'}
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="auth-toggle"
                aria-label="Şifreyi göster/gizle"
                onClick={() => setShowPassword2((prev) => !prev)}
              >
                {showPassword2 ? 'Gizle' : 'Göster'}
              </button>
            </div>
          </div>

          <p className="muted small">
            Şifre en az 8 karakter, 1 büyük harf, 1 sayı ve 1 özel karakter içermeli.
          </p>

          <button type="submit" disabled={loading}>
            {loading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
          </button>

          {error ? <div className="error">{error}</div> : null}
          {helper ? <div className="muted small">{helper}</div> : null}
        </form>
      </div>
    </div>
  );
}

export default Register;
