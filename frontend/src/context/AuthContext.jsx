import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { setUnauthorizedHandler } from '../api/axios';
import { buildCurrentSurfaceHref } from '../config/surfaces';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState('');
  const [selectedCity, setSelectedCityState] = useState(() => {
    const raw = localStorage.getItem('selectedCity');
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (_error) {
      return null;
    }
  });
  const [selectedDistrict, setSelectedDistrictState] = useState(() => {
    const raw = localStorage.getItem('selectedDistrict');
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (_error) {
      return null;
    }
  });

  const clearSession = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    delete api.defaults.headers.common.Authorization;
    setUser(null);
  }, []);

  const logout = useCallback(
    ({ redirect = true } = {}) => {
      clearSession();
      api.post('/auth/logout').catch(() => null);
      if (redirect && window.location.pathname !== '/login') {
        window.location.href = buildCurrentSurfaceHref(window.location.pathname, '/login');
      }
    },
    [clearSession]
  );

  const checkAuth = useCallback(async () => {
    setLoading(true);
    setNetworkError('');
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      delete api.defaults.headers.common.Authorization;
      setUser(null);
      setLoading(false);
      return null;
    }
    api.defaults.headers.common.Authorization = `Bearer ${storedToken}`;

    try {
      const response = await api.get('/auth/me', {
        headers: {
          Authorization: `Bearer ${storedToken}`
        }
      });
      const payload = response.data?.data || response.data || {};
      const userData = payload?.user || response.data?.user || payload;

      if (!userData) {
        throw new Error('user not found in /auth/me response');
      }

      localStorage.setItem('userName', userData.name || 'Kullanici');
      setUser(userData);
      return userData;
    } catch (_error) {
      if (_error?.response?.status === 401 || _error?.response?.status === 403) {
        clearSession();
      } else if (!_error?.response) {
        setNetworkError('Sunucuya baglanilamadi. Lutfen backend’i baslatin.');
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Auth network error:', _error?.message || _error);
        }
      } else if (process.env.NODE_ENV !== 'production') {
        console.warn('Auth check failed:', _error?.message || _error);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(
    async (nextToken) => {
      localStorage.setItem('token', nextToken);
      api.defaults.headers.common.Authorization = `Bearer ${nextToken}`;
      const nextUser = await checkAuth();
      if (!nextUser) {
        const error = new Error('AUTH_BOOTSTRAP_FAILED');
        error.code = 'AUTH_BOOTSTRAP_FAILED';
        throw error;
      }
      return nextUser;
    },
    [checkAuth]
  );

  const loginWithEmail = useCallback(
    async (email, password) => {
      const response = await api.post('/auth/login', { email, password });
      const nextToken = response.data?.token || response.data?.accessToken;
      if (!nextToken) {
        throw new Error('Token bulunamadi.');
      }
      localStorage.setItem('token', nextToken);
      api.defaults.headers.common.Authorization = `Bearer ${nextToken}`;
      await checkAuth();
      return response.data?.data?.user || response.data?.user || response.data?.data || null;
    },
    [checkAuth]
  );

  const requestOtp = useCallback(async (phoneE164) => {
    try {
      const response = await api.post('/auth/phone/request-otp', { phoneE164 });
      return response.data;
    } catch (error) {
      const data = error?.response?.data;
      const err = new Error(data?.message || 'SMS gönderilemedi');
      err.code = data?.code;
      throw err;
    }
  }, []);

  const verifyOtp = useCallback(
    async (phoneE164, code) => {
      const response = await api.post('/auth/phone/verify-otp', { phoneE164, code });
      const nextToken = response.data?.token || response.data?.accessToken;
      if (!nextToken) {
        throw new Error('Token bulunamadi.');
      }
      localStorage.setItem('token', nextToken);
      api.defaults.headers.common.Authorization = `Bearer ${nextToken}`;
      await checkAuth();
      return response.data?.data?.user || response.data?.user || response.data?.data || null;
    },
    [checkAuth]
  );

  const retryAuth = useCallback(() => {
    checkAuth();
  }, [checkAuth]);

  const updateUser = useCallback((nextUser) => {
    setUser((prev) => {
      const merged = { ...(prev || {}), ...(nextUser || {}) };
      if (merged?.name) {
        localStorage.setItem('userName', merged.name);
      }
      return merged;
    });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout({ redirect: true });
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [logout]);

  const setSelectedCity = useCallback((city) => {
    if (city && city._id && city.name) {
      const normalized = { _id: String(city._id), name: String(city.name) };
      localStorage.setItem('selectedCity', JSON.stringify(normalized));
      setSelectedCityState(normalized);
      localStorage.removeItem('selectedDistrict');
      setSelectedDistrictState(null);
      return;
    }

    localStorage.removeItem('selectedCity');
    setSelectedCityState(null);
    localStorage.removeItem('selectedDistrict');
    setSelectedDistrictState(null);
  }, []);

  const setSelectedDistrict = useCallback((district) => {
    if (district && district._id && district.name) {
      const normalized = {
        _id: String(district._id),
        name: String(district.name),
        cityId: district.cityId ? String(district.cityId) : undefined
      };
      localStorage.setItem('selectedDistrict', JSON.stringify(normalized));
      setSelectedDistrictState(normalized);
      return;
    }

    localStorage.removeItem('selectedDistrict');
    setSelectedDistrictState(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      networkError,
      login,
      loginWithEmail,
      requestOtp,
      verifyOtp,
      updateUser,
      logout,
      checkAuth,
      retryAuth,
      selectedCity,
      setSelectedCity,
      selectedDistrict,
      setSelectedDistrict
    }),
    [
      checkAuth,
      loading,
      login,
      loginWithEmail,
      requestOtp,
      verifyOtp,
      updateUser,
      logout,
      networkError,
      retryAuth,
      selectedCity,
      selectedDistrict,
      setSelectedCity,
      setSelectedDistrict,
      user
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
