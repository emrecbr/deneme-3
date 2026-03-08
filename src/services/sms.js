const getEnv = (key, fallback = '') => (process.env[key] || fallback).trim();

const normalizePhone = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('05') && digits.length === 11) {
    return `+90${digits.slice(1)}`;
  }
  if (digits.startsWith('5') && digits.length === 10) {
    return `+90${digits}`;
  }
  if (digits.startsWith('90') && digits.length === 12) {
    return `+${digits}`;
  }
  return raw;
};

const maskPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `+${digits.slice(0, 3)}***${digits.slice(-4)}`;
};

export const sendOtpSms = async ({ phone, code }) => {
  const provider = getEnv('SMS_PROVIDER', 'iletimerkezi');
  const normalizedPhone = normalizePhone(phone);

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
  const username = getEnv('ILETIMERKEZI_USERNAME');
  const password = getEnv('ILETIMERKEZI_PASSWORD');
  const sender = getEnv('ILETIMERKEZI_SENDER');
  const baseUrlRaw = getEnv('ILETIMERKEZI_BASE_URL', 'https://api.iletimerkezi.com');
  const baseUrl = baseUrlRaw.endsWith('/v1/send-sms') ? baseUrlRaw : `${baseUrlRaw}/v1/send-sms`;

  if ((!apiKey && (!username || !password)) || !sender) {
    const error = new Error('İleti Merkezi credentials eksik.');
    error.code = 'CONFIG_MISSING_ILETIMERKEZI';
    error.statusCode = 501;
    error.provider = 'iletimerkezi';
    throw error;
  }

  const message = `Doğrulama kodun: ${code}`;
  const controller = new AbortController();
  const timeoutMs = Number(getEnv('SMS_SEND_TIMEOUT_MS', '15000')) || 15000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const authentication = apiKey
    ? { apiKey }
    : { username, password };

  const payload = {
    request: {
      authentication,
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

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('SMS_SEND_FAIL', {
        provider: 'iletimerkezi',
        status: response.status,
        data
      });
      const error = new Error('SMS gönderilemedi.');
      error.code = 'SMS_SEND_FAILED';
      error.statusCode = response.status || 500;
      error.provider = 'iletimerkezi';
      throw error;
    }

    const statusCode = data?.response?.status?.code || data?.response?.status?.status;
    if (statusCode && String(statusCode) !== '200') {
      console.error('SMS_SEND_FAIL', {
        provider: 'iletimerkezi',
        status: response.status,
        data
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
      to: maskPhone(phone)
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      console.error('SMS_SEND_FAIL', {
        provider: 'iletimerkezi',
        status: 408,
        message: 'timeout'
      });
      const err = new Error('SMS gönderilemedi.');
      err.code = 'SMS_SEND_TIMEOUT';
      err.statusCode = 500;
      err.provider = 'iletimerkezi';
      throw err;
    }
    console.error('SMS_SEND_FAIL', {
      provider: 'iletimerkezi',
      status: error?.statusCode,
      message: error?.message
    });
    const err = new Error('SMS gönderilemedi.');
    err.code = error?.code || 'SMS_SEND_FAILED';
    err.statusCode = error?.statusCode || 500;
    err.provider = 'iletimerkezi';
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};
