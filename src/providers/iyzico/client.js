import crypto from 'crypto';
import Iyzipay from 'iyzipay';

const DEFAULT_IYZICO_BASE_URL = 'https://sandbox-api.iyzipay.com';
const IYZIPAY_SDK = Iyzipay?.default || Iyzipay;

const trimTrailingSlash = (value) => String(value || '').trim().replace(/\/+$/, '');

const safeHost = (value) => {
  try {
    return new URL(value).host;
  } catch (_error) {
    return null;
  }
};

export const createConversationId = () => crypto.randomBytes(12).toString('hex');

export const getIyzicoConfig = () => {
  const envBaseUrl = trimTrailingSlash(process.env.IYZICO_BASE_URL || '');
  const baseUrl = envBaseUrl || DEFAULT_IYZICO_BASE_URL;

  return {
    apiKey: String(process.env.IYZICO_API_KEY || '').trim(),
    secretKey: String(process.env.IYZICO_SECRET_KEY || '').trim(),
    baseUrl,
    baseUrlSource: envBaseUrl ? 'env' : 'fallback'
  };
};

export const getIyzicoConfigAudit = () => {
  const { apiKey, secretKey, baseUrl, baseUrlSource } = getIyzicoConfig();
  return {
    hasApiKey: Boolean(apiKey),
    hasSecretKey: Boolean(secretKey),
    baseUrl,
    baseUrlHost: safeHost(baseUrl),
    baseUrlSource,
    isSandbox: /sandbox/i.test(baseUrl),
    isLive: /\.iyzipay\.com$/i.test(safeHost(baseUrl) || '') && !/sandbox/i.test(baseUrl)
  };
};

const assertIyzicoConfig = () => {
  const config = getIyzicoConfig();
  if (!config.apiKey || !config.secretKey) {
    const error = new Error('IYZICO credentials are missing');
    error.code = 'iyzico_credentials_missing';
    error.audit = getIyzicoConfigAudit();
    throw error;
  }
  return config;
};

export const getIyzicoClient = () => {
  const { apiKey, secretKey, baseUrl } = assertIyzicoConfig();
  return new IYZIPAY_SDK({
    apiKey,
    secretKey,
    uri: baseUrl
  });
};

export const invokeIyzico = (resourceName, methodName, payload = {}) =>
  new Promise((resolve, reject) => {
    try {
      const client = getIyzicoClient();
      const resource = client?.[resourceName];
      const method = resource?.[methodName];

      if (typeof method !== 'function') {
        const error = new Error(`Iyzico resource method not found: ${resourceName}.${methodName}`);
        error.code = 'iyzico_method_missing';
        error.audit = getIyzicoConfigAudit();
        reject(error);
        return;
      }

      method.call(resource, payload, (err, result) => {
        if (err) {
          err.audit = getIyzicoConfigAudit();
          reject(err);
          return;
        }
        resolve(result);
      });
    } catch (error) {
      error.audit = error.audit || getIyzicoConfigAudit();
      reject(error);
    }
  });

export const toIyzicoPrice = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) {
    return '0.00';
  }
  return amount.toFixed(2);
};
