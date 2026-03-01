import crypto from 'crypto';
import { generateEventHash } from './billing.js';

const getSignatureHeader = (req) => {
  return (
    req.headers['x-iyzico-signature'] ||
    req.headers['x-iyzico-signaturev2'] ||
    req.headers['x-iyzi-signature'] ||
    ''
  );
};

export const verifyWebhook = (req) => {
  const secret = process.env.IYZICO_WEBHOOK_SECRET || '';
  if (!secret) {
    throw new Error('IYZICO_WEBHOOK_SECRET missing');
  }
  const signatureHeader = String(getSignatureHeader(req) || '');
  if (!signatureHeader) {
    throw new Error('Webhook signature missing');
  }
  const rawBody = req.rawBody || req.body || '';
  const rawString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : JSON.stringify(rawBody);
  const hmac = crypto.createHmac('sha256', secret).update(rawString).digest('hex');
  const hmacBase64 = crypto.createHmac('sha256', secret).update(rawString).digest('base64');
  const normalized = signatureHeader.trim();
  const valid = normalized === hmac || normalized === hmacBase64;
  if (!valid) {
    throw new Error('Webhook signature invalid');
  }
  return true;
};

export const parseWebhook = (req) => {
  const rawBody = req.rawBody || req.body || {};
  const payload = Buffer.isBuffer(rawBody) ? JSON.parse(rawBody.toString('utf-8')) : rawBody;
  const rawType = payload?.eventType || payload?.event || payload?.type || '';
  const type = String(rawType).toLowerCase();

  let eventType = 'payment.failed';
  if (type.includes('payment') && type.includes('success')) {
    eventType = 'payment.succeeded';
  } else if (type.includes('payment') && type.includes('fail')) {
    eventType = 'payment.failed';
  } else if (type.includes('subscription') && type.includes('renew')) {
    eventType = 'subscription.renewed';
  } else if (type.includes('subscription') && (type.includes('cancel') || type.includes('canceled'))) {
    eventType = 'subscription.canceled';
  }

  const providerPaymentId =
    payload?.paymentId || payload?.paymentReferenceCode || payload?.payment?.id || payload?.payment?.paymentId || null;
  const providerSubId =
    payload?.subscriptionReferenceCode || payload?.subscriptionId || payload?.subscription?.id || null;
  const planCode = payload?.planCode || payload?.plan?.code || payload?.metadata?.planCode || null;
  const userId = payload?.userId || payload?.metadata?.userId || payload?.buyerId || payload?.customerId || null;
  const amount = Number(payload?.amount || payload?.price || payload?.payment?.amount || 0);
  const currency = payload?.currency || payload?.payment?.currency || 'TRY';
  const periodStart = payload?.periodStart || payload?.subscription?.periodStart || null;
  const periodEnd = payload?.periodEnd || payload?.subscription?.periodEnd || null;
  const eventId = payload?.eventId || payload?.id || generateEventHash(JSON.stringify(payload));

  return {
    eventId,
    eventType,
    userId,
    planCode,
    providerPaymentId,
    providerSubId,
    status: payload?.status || payload?.paymentStatus || null,
    amount,
    currency,
    periodStart: periodStart ? new Date(periodStart) : null,
    periodEnd: periodEnd ? new Date(periodEnd) : null,
    raw: payload
  };
};
