import crypto from 'crypto';

const IYZICO_BASE_URL = process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com';

export const createConversationId = () => crypto.randomBytes(12).toString('hex');

export const getIyzicoConfig = () => ({
  apiKey: process.env.IYZICO_API_KEY || '',
  secretKey: process.env.IYZICO_SECRET_KEY || '',
  baseUrl: IYZICO_BASE_URL
});

export const requestIyzico = async (endpoint, payload) => {
  const { apiKey, secretKey, baseUrl } = getIyzicoConfig();
  if (!apiKey || !secretKey) {
    throw new Error('IYZICO credentials are missing');
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `IYZWS ${apiKey}:${secretKey}`
    },
    body: JSON.stringify(payload || {})
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.errorMessage || 'Iyzico request failed');
    error.statusCode = response.status;
    error.payload = data;
    throw error;
  }

  return data;
};
