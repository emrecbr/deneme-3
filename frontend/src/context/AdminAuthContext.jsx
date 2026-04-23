import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import adminApi from '../api/adminApi';
import { clearAdminSurfaceStorage, hasAdminAccess } from '../admin/adminAuthStorage';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const clearSession = useCallback(() => {
    clearAdminSurfaceStorage();
    setAdmin(null);
    setError('');
  }, []);

  const checkAdminAuth = useCallback(async () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('admin_token');

    if (!token) {
      setAdmin(null);
      setLoading(false);
      return null;
    }

    try {
      const response = await adminApi.get('/admin/auth/me');
      const adminData = response.data?.admin || response.data;

      if (!adminData) {
        throw new Error('admin not found in /admin/auth/me response');
      }

      setAdmin(adminData);
      return adminData;
    } catch (_error) {
      clearSession();
      setError('Admin oturumu bulunamadi.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    checkAdminAuth();
  }, [checkAdminAuth]);

  const login = useCallback(
    async (email, password) => {
      setError('');
      const response = await adminApi.post('/admin/auth/login', { email, password });
      const token = response.data?.token;

      if (!token) {
        throw new Error('Token bulunamadi.');
      }

      localStorage.setItem('admin_token', token);

      try {
        const adminResponse = await adminApi.get('/admin/auth/me');
        const adminData = adminResponse.data?.admin || adminResponse.data;

        if (!adminData) {
          const error = new Error('Admin oturumu dogrulanamadi.');
          error.code = 'ADMIN_SESSION_VERIFY_FAILED';
          throw error;
        }

        if (!hasAdminAccess(adminData)) {
          const error = new Error(`Admin yetkisi yok: ${adminData?.email || email}`);
          error.code = 'ADMIN_ROLE_REQUIRED';
          error.accountEmail = adminData?.email || email;
          throw error;
        }

        setAdmin(adminData);
        return adminData;
      } catch (error) {
        clearSession();
        throw error;
      }
    },
    [clearSession]
  );

  const logout = useCallback(
    async () => {
      try {
        await adminApi.post('/admin/auth/logout');
      } catch (_error) {
        // ignore
      }
      clearSession();
    },
    [clearSession]
  );

  const value = useMemo(
    () => ({
      admin,
      loading,
      error,
      isAuthenticated: Boolean(admin),
      login,
      logout,
      checkAdminAuth,
      clearSession
    }),
    [admin, checkAdminAuth, clearSession, error, loading, login, logout]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  }
  return context;
}
