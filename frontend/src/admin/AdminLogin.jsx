import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { clearAdminSurfaceStorage } from './adminAuthStorage';
import { sanitizeAdminErrorMessage } from './adminErrorUtils';

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, admin, clearSession } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(true);
  const hasCleanedRef = useRef(false);

  const resolveReturnPath = () => {
    const stateReturn = typeof location.state?.returnTo === 'string' ? location.state.returnTo : '';
    const params = new URLSearchParams(location.search || '');
    const queryReturn = params.get('returnTo') || '';
    const candidate = stateReturn || queryReturn || '/admin';
    return candidate.startsWith('/admin') ? candidate : '/admin';
  };

  useEffect(() => {
    if (hasCleanedRef.current) {
      return;
    }

    hasCleanedRef.current = true;
    clearAdminSurfaceStorage();
    clearSession();
    setResetting(false);
  }, [clearSession]);

  useEffect(() => {
    if (admin) {
      navigate(resolveReturnPath(), { replace: true });
    }
  }, [admin, navigate, location.search, location.state]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate(resolveReturnPath(), { replace: true });
    } catch (err) {
      if (err?.code === 'ADMIN_ROLE_REQUIRED') {
        setError(`Admin yetkisi yok: ${err.accountEmail || email}`);
      } else if (err?.code === 'ADMIN_SESSION_VERIFY_FAILED' || err?.code === 'ADMIN_ME_MISSING') {
        setError('Admin oturumu dogrulanamadi.');
      } else {
        setError(sanitizeAdminErrorMessage(err, 'Giris basarisiz.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login">
      <div className="admin-login-card">
        <h1>Admin Girisi</h1>
        <p>Talepet yonetim paneline erisin</p>
        <div className="admin-info">
          Admin login ekrani acildiginda bu domaine ait eski auth kayitlari temizlenir. Boylece buyer token kalintisi
          admin guard kararini etkileyemez.
        </div>
        <form onSubmit={handleSubmit}>
          <label htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@talepet.net.tr"
            autoComplete="email"
            required
          />
          <label htmlFor="admin-password">Sifre</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
          {error ? <div className="admin-error">{error}</div> : null}
          <button type="submit" disabled={loading || resetting}>
            {resetting ? 'Oturum temizleniyor...' : loading ? 'Giris yapiliyor...' : 'Giris Yap'}
          </button>
        </form>
      </div>
    </div>
  );
}
