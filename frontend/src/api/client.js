const ENV_API_BASE = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
const DEV_FALLBACK = 'http://localhost:3001/api';
const API_BASE_URL = ENV_API_BASE || (import.meta.env.DEV ? DEV_FALLBACK : '');

if (import.meta.env.DEV) {
  console.log('VITE_API_URL', import.meta.env.VITE_API_URL);
} else if (!ENV_API_BASE) {
  console.warn('VITE_API_URL missing in prod build; API calls are disabled.');
}

const buildUrl = (path) => {
  if (!path.startsWith('/')) {
    return `${API_BASE_URL}/${path}`;
  }
  return `${API_BASE_URL}${path}`;
};

const parseJson = async (response) => {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    return { message: 'Yanıt çözümlenemedi.' };
  }
};

export const post = async (path, body) => {
  if (!API_BASE_URL && !import.meta.env.DEV) {
    throw new Error('VITE_API_URL missing in prod build.');
  }
  const response = await fetch(buildUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });

  const data = await parseJson(response);
  if (!response.ok) {
    const error = new Error(data?.message || 'İşlem başarısız.');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
};
