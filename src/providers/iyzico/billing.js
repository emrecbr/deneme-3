import crypto from 'crypto';
import { createConversationId, requestIyzico } from './client.js';

const fallbackCheckoutUrl = (paymentId) => {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
  return `${baseUrl}/premium/return?paymentId=${paymentId}`;
};

export const createCheckout = async ({ user, plan, mode, paymentId }) => {
  const conversationId = createConversationId();
  const returnUrl = `${process.env.APP_BASE_URL || 'http://localhost:5173'}/premium/return?paymentId=${paymentId}`;
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
    return {
      checkoutUrl: response?.paymentPageUrl || response?.checkoutFormContent || fallbackCheckoutUrl(paymentId),
      providerPaymentId: response?.paymentId || response?.paymentReferenceCode || null,
      conversationId,
      returnUrl,
      raw: response
    };
  } catch (_error) {
    return {
      checkoutUrl: fallbackCheckoutUrl(paymentId),
      providerPaymentId: null,
      conversationId,
      returnUrl,
      raw: { fallback: true }
    };
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
