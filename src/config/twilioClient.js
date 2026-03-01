import twilio from 'twilio';

const getEnv = (key) => (process.env[key] || '').trim();

export const getTwilioClient = () => {
  const accountSid = getEnv('TWILIO_ACCOUNT_SID');
  const serviceSid = getEnv('TWILIO_VERIFY_SERVICE_SID');
  const apiKeySid = getEnv('TWILIO_API_KEY_SID');
  const apiKeySecret = getEnv('TWILIO_API_KEY_SECRET');
  const authToken = getEnv('TWILIO_AUTH_TOKEN');

  if (!accountSid || !serviceSid) {
    const error = new Error('Twilio konfigurasyonu eksik: ACCOUNT_SID veya VERIFY_SERVICE_SID yok.');
    error.code = 'TWILIO_NOT_CONFIGURED';
    error.statusCode = 501;
    throw error;
  }

  let client;
  if (apiKeySid && apiKeySecret) {
    client = twilio(apiKeySid, apiKeySecret, { accountSid });
  } else if (authToken) {
    client = twilio(accountSid, authToken);
  } else {
    const error = new Error('Twilio credentials missing. API Key veya Auth Token bulunamadı.');
    error.code = 'TWILIO_NOT_CONFIGURED';
    error.statusCode = 501;
    throw error;
  }

  return { client, serviceSid };
};
