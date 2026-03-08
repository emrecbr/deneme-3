import twilio from 'twilio';

const getEnv = (key) => (process.env[key] || '').trim();

const getTwilioClient = () => {
  const accountSid = getEnv('TWILIO_ACCOUNT_SID');
  const apiKeySid = getEnv('TWILIO_API_KEY_SID');
  const apiKeySecret = getEnv('TWILIO_API_KEY_SECRET');
  const authToken = getEnv('TWILIO_AUTH_TOKEN');

  if (!accountSid) {
    const error = new Error('Twilio ACCOUNT_SID eksik.');
    error.code = 'TWILIO_NOT_CONFIGURED';
    error.statusCode = 501;
    throw error;
  }

  if (apiKeySid && apiKeySecret) {
    return twilio(apiKeySid, apiKeySecret, { accountSid });
  }
  if (authToken) {
    return twilio(accountSid, authToken);
  }

  const error = new Error('Twilio credentials eksik.');
  error.code = 'TWILIO_NOT_CONFIGURED';
  error.statusCode = 501;
  throw error;
};

const mapTwilioError = (error) => {
  const message = String(error?.message || '');
  const lower = message.toLowerCase();
  const code = error?.code;

  if (code === 21211 || lower.includes('invalid') || lower.includes('not a valid phone')) {
    const err = new Error('Numara formatı hatalı.');
    err.code = 'TWILIO_INVALID_PHONE';
    err.statusCode = 400;
    return err;
  }

  if (
    code === 21608 ||
    lower.includes('trial') ||
    lower.includes('unverified') ||
    lower.includes('verified')
  ) {
    const err = new Error('Twilio trial: sadece doğrulanmış numaralara SMS gönderilebilir.');
    err.code = 'TWILIO_TRIAL_UNVERIFIED';
    err.statusCode = 403;
    return err;
  }

  if (
    code === 21408 ||
    lower.includes('permission') ||
    lower.includes('not enabled') ||
    lower.includes('geo')
  ) {
    const err = new Error('Bu ülkeye SMS gönderimi kapalı.');
    err.code = 'TWILIO_GEO_BLOCKED';
    err.statusCode = 403;
    return err;
  }

  const err = new Error('SMS gönderilemedi.');
  err.code = 'TWILIO_SEND_FAILED';
  err.statusCode = error?.status || 500;
  return err;
};

export const sendOtpSms = async ({ phone, code }) => {
  const provider = getEnv('SMS_PROVIDER') || 'twilio';
  if (provider === 'mock') {
    if (process.env.NODE_ENV !== 'production') {
      console.log('SMS_OTP_MOCK', phone, code);
    }
    return { sid: 'mock', status: 'mocked' };
  }

  const client = getTwilioClient();
  const messagingServiceSid = getEnv('TWILIO_MESSAGING_SERVICE_SID');
  const from = getEnv('TWILIO_FROM');

  if (!messagingServiceSid && !from) {
    const error = new Error('Twilio Messaging Service veya From numarası eksik.');
    error.code = 'TWILIO_NOT_CONFIGURED';
    error.statusCode = 501;
    throw error;
  }

  const body = `Doğrulama kodun: ${code}`;

  try {
    if (messagingServiceSid) {
      return await client.messages.create({
        to: phone,
        messagingServiceSid,
        body
      });
    }
    return await client.messages.create({
      to: phone,
      from,
      body
    });
  } catch (error) {
    console.error('TWILIO_SMS_FAIL', {
      code: error?.code,
      message: error?.message,
      status: error?.status
    });
    throw mapTwilioError(error);
  }
};
