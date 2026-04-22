import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAdminAuth } from '../context/AdminAuthContext';
import { clearAdminSurfaceStorage, hasAdminAccess, resolveAccountEmail } from './adminAuthStorage';

export default function AdminProtectedRoute({ children }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { admin, loading, logout: logoutAdmin, clearSession } = useAdminAuth();

  const handleReset = async () => {
    await Promise.allSettled([logoutAdmin()]);
    clearAdminSurfaceStorage();
    clearSession();
    navigate('/login', { replace: true });
  };

  if (loading) {
    return <div className="admin-shell-loading">Yukleniyor...</div>;
  }

  if (admin && hasAdminAccess(admin)) {
    return children;
  }

  const fallbackEmail = resolveAccountEmail(admin) || resolveAccountEmail(user);

  if (fallbackEmail) {
    return (
      <div className="admin-shell-loading">
        <div className="admin-guard-card">
          <h2>Admin yetkisi bulunamadi</h2>
          <p>
            Su hesapla giris yaptiniz: <strong>{fallbackEmail}</strong>. Admin erisimi icin admin yetkili bir
            hesapla giris yapin.
          </p>
          <button type="button" className="admin-btn" onClick={handleReset}>
            Oturumu Temizle ve Yeniden Giris Yap
          </button>
        </div>
      </div>
    );
  }

  return <Navigate to="/login" replace />;
}
