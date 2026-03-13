import AuthLog from '../../models/AuthLog.js';

const maskEmail = (email) => {
  const value = String(email || '').trim();
  if (!value.includes('@')) return value;
  const [name, domain] = value.split('@');
  if (name.length <= 2) return `**@${domain}`;
  return `${name[0]}***${name.slice(-1)}@${domain}`;
};

const maskPhone = (phone) => {
  const value = String(phone || '').trim();
  if (value.length <= 4) return `***${value}`;
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
};

export const logAuthEvent = async ({
  channel,
  event,
  status,
  target,
  errorMessage,
  provider,
  meta
}) => {
  try {
    const maskedTarget = channel === 'email' ? maskEmail(target) : maskPhone(target);
    await AuthLog.create({
      channel,
      event,
      status,
      target,
      maskedTarget,
      errorMessage,
      provider,
      meta
    });
  } catch (_error) {
    // do not block auth flow
  }
};
