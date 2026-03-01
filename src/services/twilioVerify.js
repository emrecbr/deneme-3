import twilio from 'twilio';

const getEnv = (key) => (process.env[key] || '').trim();

const getClient = () => {
  const accountSid = getEnv('TWILIO_ACCOUNT_SID');
  const authToken = getEnv('TWILIO_AUTH_TOKEN');
  if (!accountSid || !authToken) {
    const error = new Error('Twilio konfigurasyonu eksik.');
    error.statusCode = 500;
    throw error;
  }
  return {
    client: twilio(accountSid, authToken),
    serviceSid: getEnv('TWILIO_VERIFY_SERVICE_SID'),
    channel: getEnv('TWILIO_CHANNEL') || 'sms'
  };
};

export const sendSmsOtp = async (phone) => {
  const { client, serviceSid, channel } = getClient();
  if (!serviceSid) {
    const error = new Error('Twilio Verify Service SID eksik.');
    error.statusCode = 500;
    throw error;
  }
  return client.verify.v2.services(serviceSid).verifications.create({
    to: phone,
    channel
  });
};

export const checkSmsOtp = async (phone, code) => {
  const { client, serviceSid } = getClient();
  if (!serviceSid) {
    const error = new Error('Twilio Verify Service SID eksik.');
    error.statusCode = 500;
    throw error;
  }
  return client.verify.v2.services(serviceSid).verificationChecks.create({
    to: phone,
    code
  });
};
