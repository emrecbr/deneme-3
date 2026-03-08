import { normalizeTrPhoneE164 } from '../utils/phone.js';

const getEnv = (key, fallback = '') => (process.env[key] || fallback).trim();

const maskPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `+${digits.slice(0, 3)}***${digits.slice(-4)}`;
};

const buildUrl = (base, path) => {
  if (!base) return path;
  return base.endsWith('/') ? `${base.slice(0, -1)}${path}` : `${base}${path}`;
};

const parseResponseText = (text) => {
  try {
    return { json: JSON.parse(text), text };
  } catch (_err) {
    return { json: null, text };
  }
};

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

const isSuccessStatus = (parsed) => {
  if (!parsed) return false;
  const statusValue =
    parsed?.status ??
    parsed?.code ??
    parsed?.response?.status ??
    parsed?.response?.code ??
    parsed?.response?.status?.code ??
    parsed?.response?.status?.status;
  if (statusValue != null) {
    return String(statusValue) === '200' || String(statusValue).toLowerCase() === 'ok';
  }
  return false;
};

const hasSuccessText = (text) => {
  const lower = String(text || '').toLowerCase();
  if (!lower) return false;
  return lower.includes('ok') || lower.includes('success') || lower.includes('200');
};

const postIleti = async ({ url, payload, timeoutMs }) => {
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
    const text = await response.text();
    const parsed = parseResponseText(text);
    return { response, parsed, text, contentType };
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
    return { sid: 'mock', status: 'mocked' };
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
  const iys = Number(getEnv('ILETIMERKEZI_IYS', '0')) || 0;

  const formatA = {
    key: apiKey,
    hash: apiHash,
    sender,
    message,
    receivers: [phone],
    iys
  };

  const formatB = {
    request: {
      authentication: { key: apiKey, hash: apiHash },
      order: {
        sender,
        sendDateTime: '',
        message: {
          text: message,
          receipents: {
            number: [phone]
          }
        }
      }
    }
  };

  const endpoints = ['/v1/send-sms', '/v1/sms/send'];
  const formats = [
    { name: 'formatA', payload: formatA },
    { name: 'formatB', payload: formatB }
  ];

  let lastError;

  for (const endpoint of endpoints) {
    for (const fmt of formats) {
      const url = buildUrl(baseUrl, endpoint);
      try {
        const { response, parsed, text, contentType } = await postIleti({
          url,
          payload: fmt.payload,
          timeoutMs
        });

        const bodyPreview = maskSensitive(String(text || ''), [apiKey, apiHash, sender, phone]).slice(0, 1200);
        const parsedPreview = parsed?.json && Object.keys(parsed.json).length ? parsed.json : undefined;
        const successJson = response.ok && isSuccessStatus(parsed.json);
        const successText = response.ok && !parsed.json && hasSuccessText(text);

        if (successJson || successText) {
          return {
            provider: 'iletimerkezi',
            status: 'sent',
            to: maskPhone(phone)
          };
        }

        if (response.status === 404 || response.status === 405) {
          console.error('SMS_SEND_FAIL', {
            provider: 'iletimerkezi',
            httpStatus: response.status,
            contentType,
            endpointTried: endpoint,
            formatTried: fmt.name,
            bodyPreview,
            parsedPreview
          });
          continue;
        }

        console.error('SMS_SEND_FAIL', {
          provider: 'iletimerkezi',
          httpStatus: response.status,
          contentType,
          endpointTried: endpoint,
          formatTried: fmt.name,
          bodyPreview,
          parsedPreview
        });
        lastError = new Error('SMS gönderilemedi.');
        lastError.code = 'SMS_SEND_FAILED';
        lastError.statusCode = 502;
        lastError.provider = 'iletimerkezi';
      } catch (error) {
        if (error?.name === 'AbortError') {
          console.error('SMS_SEND_FAIL', {
            provider: 'iletimerkezi',
            httpStatus: 408,
            endpointTried: endpoint,
            formatTried: fmt.name,
            bodyPreview: 'timeout'
          });
          lastError = new Error('SMS gönderilemedi.');
          lastError.code = 'SMS_SEND_TIMEOUT';
          lastError.statusCode = 502;
          lastError.provider = 'iletimerkezi';
          continue;
        }
        console.error('SMS_SEND_FAIL', {
          provider: 'iletimerkezi',
          httpStatus: error?.statusCode,
          endpointTried: endpoint,
          formatTried: fmt.name,
          bodyPreview: String(error?.message || '').slice(0, 1200)
        });
        lastError = new Error('SMS gönderilemedi.');
        lastError.code = error?.code || 'SMS_SEND_FAILED';
        lastError.statusCode = 502;
        lastError.provider = 'iletimerkezi';
      }
    }
  }

  throw lastError || Object.assign(new Error('SMS gönderilemedi.'), {
    code: 'SMS_SEND_FAILED',
    statusCode: 502,
    provider: 'iletimerkezi'
  });
};
