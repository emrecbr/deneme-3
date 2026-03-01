export const normalizeTrPhoneE164 = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  let normalized = digits;
  if (normalized.startsWith('90')) {
    normalized = normalized.slice(2);
  }
  if (normalized.startsWith('0')) {
    normalized = normalized.slice(1);
  }
  if (normalized.length !== 10 || !normalized.startsWith('5')) {
    return '';
  }
  return `+90${normalized}`;
};

export const ensureTrPhoneE164 = (value) => {
  const phone = normalizeTrPhoneE164(value);
  if (!phone) {
    const error = new Error('Telefon gecersiz. 10 hane olmalı (5XXXXXXXXX).');
    error.statusCode = 400;
    error.code = 'INVALID_PHONE';
    throw error;
  }
  return phone;
};
