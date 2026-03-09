import { normalizeTrPhoneE164 } from '../utils/phone.js';

const getEnv = (key, fallback = '') => (process.env[key] || fallback).trim();

const maskSensitive = (text, values) => {
  if (!text) return text;
  let masked = String(text);
  values.forEach((val) => {
    if (!val) return;
    const safe = String(val).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    masked = masked.replace(new RegExp(safe, 'g'), '***');
  });
  return masked;
};

const parseResponseText = (text) => {
  try {
    return { json: JSON.parse(text), text };
  } catch (_err) {
    return { json: null, text };
  }
};

const normalizedDigits = (phone) => String(phone || '').replace(/\D/g, '');

const buildUrl = (base, path) => {
  if (!base) return path;
  return base.endsWith('/') ? `${base.slice(0, -1)}${path}` : `${base}${path}`;
};

const sendSmsViaIletiMerkezi = async ({ phone, code }) => {
  const apiKey = getEnv('ILETIMERKEZI_API_KEY');
  const apiHash = getEnv('ILETIMERKEZI_API_HASH');
  const sender = getEnv('ILETIMERKEZI_SENDER');
  const baseUrl = getEnv('ILETIMERKEZI_BASE_URL', 'https://api.iletimerkezi.com');

  if (!apiKey || !apiHash || !sender) {
    const error = new Error('İleti Merkezi credentials eksik.');
    error.code = 'CONFIG_MISSING_ILETIMERKEZI';
    error.statusCode = 501;
    error.provider = 'iletimerkezi';
    throw error;
  }

  const message = `Doğrulama kodun: ${code}`;
  const timeoutMs = Number(getEnv('SMS_SEND_TIMEOUT_MS', '15000')) || 15000;
  const iysValue = String(getEnv('ILETIMERKEZI_IYS', '0')) || '0';

  const digits = normalizedDigits(phone);
  const payload = {
    request: {
      authentication: { key: apiKey, hash: apiHash },
      order: {
        sender: sender.trim(),
        sendDateTime: [],
        iys: iysValue,
        message: {
          text: message,
          receipents: {
            number: [digits]
          }
        }
      }
    }
  };

  const url = buildUrl(baseUrl || 'https://api.iletimerkezi.com', '/v1/send-sms/json');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();
    const parsed = parseResponseText(rawText);
    const bodyPreview = maskSensitive(rawText, [apiKey, apiHash, sender, digits]).slice(0, 1200);
    const responseStatusCode = parsed?.json?.response?.status?.code;
    const responseStatusMessage = parsed?.json?.response?.status?.message;

    if (!response.ok) {
      console.error('SMS_SEND_FAIL', {
        provider: 'iletimerkezi',
        httpStatus: response.status,
        contentType,
        responseStatusCode,
        responseStatusMessage,
        bodyPreview
      });
      const error = new Error('SMS gönderilemedi.');
      error.code = 'SMS_SEND_FAILED';
      error.statusCode = 502;
      error.provider = 'iletimerkezi';
      throw error;
    }

    if (!responseStatusCode || String(responseStatusCode) !== '200') {
      console.error('SMS_SEND_FAIL', {
        provider: 'iletimerkezi',
        httpStatus: response.status,
        contentType,
        responseStatusCode,
        responseStatusMessage,
        bodyPreview
      });
      const error = new Error('SMS gönderilemedi.');
      error.code = 'SMS_SEND_FAILED';
      error.statusCode = 502;
      error.provider = 'iletimerkezi';
      throw error;
    }

    return {
      provider: 'iletimerkezi',
      status: 'sent',
      to: digits.replace(/.(?=.{4})/g, '*')
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      console.error('SMS_SEND_FAIL', {
        provider: 'iletimerkezi',
        httpStatus: 408,
        bodyPreview: 'timeout'
      });
      const err = new Error('SMS gönderilemedi.');
      err.code = 'SMS_SEND_TIMEOUT';
      err.statusCode = 502;
      err.provider = 'iletimerkezi';
      throw err;
    }
    console.error('SMS_SEND_FAIL', {
      provider: 'iletimerkezi',
      httpStatus: error?.statusCode,
      bodyPreview: String(error?.message || '').slice(0, 1200)
    });
    const err = new Error('SMS gönderilemedi.');
    err.code = error?.code || 'SMS_SEND_FAILED';
    err.statusCode = 502;
    err.provider = 'iletimerkezi';
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const sendOtpSms = async ({ phone, code }) => {
  const provider = getEnv('SMS_PROVIDER', 'iletimerkezi');
  const normalizedPhone = normalizeTrPhoneE164(phone);
  if (!normalizedPhone) {
    const error = new Error('Telefon geçersiz.');
    error.code = 'INVALID_PHONE';
    error.statusCode = 400;
    error.provider = provider;
    throw error;
  }

  if (provider === 'mock') {
    if (process.env.NODE_ENV !== 'production') {
      console.log('SMS_OTP_MOCK', normalizedPhone, code);
    }
    return { provider: 'mock', status: 'sent' };
  }

  if (provider === 'iletimerkezi') {
    return sendSmsViaIletiMerkezi({ phone: normalizedPhone, code });
  }

  const error = new Error('SMS provider geçersiz.');
  error.code = 'SMS_PROVIDER_INVALID';
  error.statusCode = 500;
  error.provider = provider;
  throw error;
};
