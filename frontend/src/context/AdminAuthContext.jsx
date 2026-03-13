import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import adminApi from '../api/adminApi';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const clearSession = useCallback(() => {
    localStorage.removeItem('admin_token');
    setAdmin(null);
  }, []);

  const checkAdminAuth = useCallback(async () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('admin_token');
    if (!token) {
      setAdmin(null);
      setLoading(false);
      return;
    }
    try {
      const response = await adminApi.get('/admin/auth/me');
      const adminData = response.data?.admin || response.data;
      if (!adminData) {
        throw new Error('admin not found in /admin/auth/me response');
      }
      setAdmin(adminData);
    } catch (_error) {
      clearSession();
      setError('Admin oturumu bulunamadı.');
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
        throw new Error('Token bulunamadı.');
      }
      localStorage.setItem('admin_token', token);
      await checkAdminAuth();
      return response.data?.admin || null;
    },
    [checkAdminAuth]
  );

  const logout = useCallback(async () => {
    try {
      await adminApi.post('/admin/auth/logout');
    } catch (_error) {
      // ignore
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({
      admin,
      loading,
      error,
      isAuthenticated: Boolean(admin),
      login,
      logout,
      checkAdminAuth
    }),
    [admin, checkAdminAuth, error, loading, login, logout]
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
