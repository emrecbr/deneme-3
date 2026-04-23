const INTERNAL_ERROR_PATTERNS = [/api is not defined/i, /is not defined/i, /referenceerror/i];

export const sanitizeAdminErrorMessage = (error, fallbackMessage) => {
  const backendMessage = error?.response?.data?.message;
  const rawMessage = backendMessage || error?.message || '';

  if (INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(String(rawMessage)))) {
    return fallbackMessage;
  }

  return rawMessage || fallbackMessage;
};
