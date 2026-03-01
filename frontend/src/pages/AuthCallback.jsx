import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function AuthCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || window.location.hash.replace('#', '').replace('token=', '');
    if (!token) {
      setError('Token bulunamadi.');
      return;
    }
    login(token)
      .then(() => navigate('/'))
      .catch(() => setError('Giris tamamlanamadi.'));
  }, [login, navigate]);

  return (
    <div className="page auth-page">
      <div className="card auth-card">
        <h1 className="auth-title">Giris kontrol ediliyor...</h1>
        {error ? <div className="auth-alert">{error}</div> : null}
      </div>
    </div>
  );
}

export default AuthCallback;
