import crypto from 'crypto';
import { createConversationId, requestIyzico } from './client.js';
import { buildSurfaceUrl, getAppSurfaceConfig } from '../../config/surfaceConfig.js';

const resolveAppBaseUrl = () => {
  const appSurface = getAppSurfaceConfig();
  if (appSurface.value) {
    return appSurface.value;
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:5173';
  }

  return '';
};

export const createCheckout = async ({ user, plan, mode, paymentId }) => {
  const conversationId = createConversationId();
  const appBaseUrl = resolveAppBaseUrl();
  if (!appBaseUrl) {
    const error = new Error('APP_BASE_URL is not configured');
    error.code = 'app_base_url_missing';
    error.context = 'createCheckout';
    throw error;
  }

  const returnUrl = buildSurfaceUrl('app', '/premium/return', { paymentId }) || `${appBaseUrl}/premium/return?paymentId=${paymentId}`;
  const payload = {
    conversationId,
    price: plan.price,
    currency: plan.currency || 'TRY',
    buyer: {
      id: user._id?.toString?.() || user.id,
      name: user.name || 'Kullanici',
      email: user.email
    },
    planCode: plan.code,
    mode,
    callbackUrl: returnUrl
  };

  try {
    const response = await requestIyzico('/payment/checkout', payload);
    const checkoutUrl = response?.paymentPageUrl || response?.checkoutFormContent || '';
    if (!checkoutUrl) {
      const error = new Error('Provider checkout URL missing');
      error.code = 'provider_checkout_url_missing';
      error.context = 'createCheckout';
      error.payload = {
        responseKeys: response ? Object.keys(response) : []
      };
      throw error;
    }
    return {
      checkoutUrl,
      providerPaymentId: response?.paymentId || response?.paymentReferenceCode || null,
      conversationId,
      returnUrl,
      raw: response
    };
  } catch (error) {
    error.context = error.context || 'createCheckout';
    error.publicCode = error.publicCode || error.code || 'provider_checkout_failed';
    throw error;
  }
};

export const cancelSubscription = async ({ providerSubId }) => {
  if (!providerSubId) {
    throw new Error('providerSubId is required for subscription cancel');
  }

  const payload = {
    subscriptionReferenceCode: providerSubId
  };

  try {
    const response = await requestIyzico('/subscription/cancel', payload);
    return response;
  } catch (error) {
    error.context = 'cancelSubscription';
    throw error;
  }
};

export const generateEventHash = (rawBody) => {
  return crypto.createHash('sha256').update(rawBody || '').digest('hex');
};
