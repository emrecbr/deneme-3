import axios from 'axios';

let unauthorizedHandler = null;

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
};

const ENV_API_BASE = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
const DEV_FALLBACK = 'http://localhost:3001/api';
export const API_BASE_URL = ENV_API_BASE || (import.meta.env.DEV ? DEV_FALLBACK : '');

if (import.meta.env.DEV) {
  console.log('VITE_API_URL', import.meta.env.VITE_API_URL);
} else if (!ENV_API_BASE) {
  console.warn('VITE_API_URL missing in prod build; API calls are disabled.');
}

const api = axios.create({
  baseURL: API_BASE_URL
});

api.interceptors.request.use((config) => {
  if (!API_BASE_URL && !import.meta.env.DEV) {
    return Promise.reject(new Error('VITE_API_URL missing in prod build.'));
  }
  const token = localStorage.getItem('token');

  config.headers = config.headers || {};
  config.headers['Cache-Control'] = 'no-cache';

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    return Promise.reject(error);
  }
);

export default api;
