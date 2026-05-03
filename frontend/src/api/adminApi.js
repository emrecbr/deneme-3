import axios from 'axios';
import { API_BASE_URL } from './axios';
import { readAdminToken } from '../admin/adminAuthStorage';

const adminApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000
});

adminApi.interceptors.request.use((config) => {
  // Keep admin JWT attachment isolated to the admin surface helper.
  const token = readAdminToken();
  config.headers = config.headers || {};
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default adminApi;
