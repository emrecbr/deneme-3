const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

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
