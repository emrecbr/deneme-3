import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, {
  buildApiUrl,
  buildProtectedRequestConfig,
  readUserAccessToken,
  sanitizeNonAdminSurfaceAuthState,
  setUnauthorizedHandler
} from '../api/axios';
import { buildCurrentSurfaceHref } from '../config/surfaces';
import { normalizeListingQuotaSnapshot } from '../utils/listingQuota';

const AuthContext = createContext(null);
const AUTH_BOOTSTRAP_TIMEOUT_MS = 8000;
const AUTH_BOOTSTRAP_RETRY_DELAY_MS = 300;

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const isRetryableBootstrapError = (error) =>
  !error?.response || error?.code === 'ECONNABORTED' || error?.name === 'CanceledError';

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
    sanitizeNonAdminSurfaceAuthState();
    const storedToken = readUserAccessToken();

    if (!storedToken) {
      delete api.defaults.headers.common.Authorization;
      setUser(null);
      setLoading(false);
      return null;
    }

    api.defaults.headers.common.Authorization = `Bearer ${storedToken}`;

    if (import.meta.env.DEV) {
      console.info('AUTH_ME_REQUEST', {
        url: buildApiUrl('/auth/me'),
        host: typeof window !== 'undefined' ? window.location.hostname : ''
      });
    }

    try {
      let response = null;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          response = await api.get('/auth/me', {
            ...buildProtectedRequestConfig({
              timeout: AUTH_BOOTSTRAP_TIMEOUT_MS
            }),
            headers: {
              Authorization: `Bearer ${storedToken}`
            }
          });
          break;
        } catch (error) {
          if (attempt === 0 && isRetryableBootstrapError(error)) {
            await wait(AUTH_BOOTSTRAP_RETRY_DELAY_MS);
            continue;
          }
          throw error;
        }
      }

      const payload = response.data?.data || response.data || {};
      const userData = payload?.user || response.data?.user || payload;

      if (!userData) {
        throw new Error('user not found in /auth/me response');
      }

      localStorage.setItem('userName', userData.name || 'Kullanici');
      setUser(userData);
      return userData;
    } catch (error) {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        clearSession();
      } else if (!error?.response) {
        setUser(null);
        delete api.defaults.headers.common.Authorization;
        setNetworkError('Sunucuya su an ulasilamiyor. Website guest modda acildi.');
        if (import.meta.env.DEV) {
          console.warn('Auth network error:', {
            url: buildApiUrl('/auth/me'),
            message: error?.message || error
          });
        }
      } else if (import.meta.env.DEV) {
        console.warn('Auth check failed:', error?.message || error);
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
      const err = new Error(data?.message || 'SMS gonderilemedi');
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
    sanitizeNonAdminSurfaceAuthState();
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

  const listingQuota = useMemo(() => normalizeListingQuotaSnapshot(user?.listingQuota), [user]);

  const value = useMemo(
    () => ({
      user,
      listingQuota,
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
      listingQuota,
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
