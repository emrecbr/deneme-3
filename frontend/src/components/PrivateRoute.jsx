import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const path = typeof window !== 'undefined' ? window.location?.pathname || '' : '';
  const hasStoredToken = typeof window !== 'undefined' ? Boolean(localStorage.getItem('token')) : false;

  if (loading) {
    return null;
  }

  if (!user) {
    if (path.startsWith('/premium')) {
      console.info('PREMIUM_REDIRECT_TO_LOGIN', {
        source: 'private_route',
        path,
        hasUser: false,
        hasStoredToken
      });
    }
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default PrivateRoute;
