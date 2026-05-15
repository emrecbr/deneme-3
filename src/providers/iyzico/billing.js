import crypto from 'crypto';
import {
  createConversationId,
  getIyzicoConfigAudit,
  getIyzicoClient,
  invokeIyzico,
  toIyzicoPrice
} from './client.js';
import { buildSurfaceUrl, getAppSurfaceConfig } from '../../config/surfaceConfig.js';

const safeDateTime = (value, fallback = new Date()) => {
  const date = value ? new Date(value) : fallback;
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
  }
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

const buildNameParts = (user) => {
  const fullName = String(user?.name || '').trim();
  const firstName = String(user?.firstName || '').trim();
  const lastName = String(user?.lastName || '').trim();

  if (firstName || lastName) {
    return {
      name: firstName || fullName.split(/\s+/)[0] || 'Talepet',
      surname: lastName || fullName.split(/\s+/).slice(1).join(' ') || 'Kullanici'
    };
  }

  const [derivedFirstName = 'Talepet', ...rest] = fullName.split(/\s+/).filter(Boolean);
  return {
    name: derivedFirstName || 'Talepet',
    surname: rest.join(' ') || 'Kullanici'
  };
};

const buildAddressParts = (user) => {
  const city =
    String(
      user?.locationSelection?.city ||
        user?.city ||
        'Istanbul'
    ).trim() || 'Istanbul';

  const district = String(user?.locationSelection?.district || '').trim();
  const neighborhood = String(user?.locationSelection?.neighborhood || '').trim();
  const street = String(user?.locationSelection?.street || '').trim();

  const address = [neighborhood, district, street, city].filter(Boolean).join(', ') || 'Talepet dijital hizmet kaydi';
  return {
    city,
    country: 'Turkey',
    zipCode: '34000',
    address
  };
};

const buildBuyerProfile = ({ user, clientIp }) => {
  const { name, surname } = buildNameParts(user);
  const addressParts = buildAddressParts(user);
  const contactName = `${name} ${surname}`.trim();
  const phone = String(user?.phoneE164 || user?.phone || '+905000000000').trim() || '+905000000000';
  const identitySeed = crypto
    .createHash('sha256')
    .update(String(user?._id || user?.id || user?.email || user?.phone || 'talepet-review'))
    .digest('hex')
    .replace(/\D/g, '');
  const identityNumber = `${identitySeed}11111111111`.slice(0, 11);

  return {
    buyer: {
      id: user?._id?.toString?.() || user?.id || user?.email || createConversationId(),
      name,
      surname,
      gsmNumber: phone.startsWith('+') ? phone : `+${phone.replace(/\D/g, '')}`,
      email: user?.email || 'review@talepet.net.tr',
      identityNumber,
      lastLoginDate: safeDateTime(user?.lastLoginAt, new Date()),
      registrationDate: safeDateTime(user?.createdAt, new Date()),
      registrationAddress: addressParts.address,
      ip: clientIp || '127.0.0.1',
      city: addressParts.city,
      country: addressParts.country,
      zipCode: addressParts.zipCode
    },
    billingAddress: {
      contactName,
      city: addressParts.city,
      country: addressParts.country,
      address: addressParts.address,
      zipCode: addressParts.zipCode
    },
    shippingAddress: {
      contactName,
      city: addressParts.city,
      country: addressParts.country,
      address: addressParts.address,
      zipCode: addressParts.zipCode
    }
  };
};

const buildBasketItem = ({ plan, paymentId }) => {
  const digitalLabel = plan?.isRecurring ? 'Premium uyelik hizmeti' : 'Dijital gorunurluk hizmeti';
  return {
    id: String(paymentId || plan?.code || createConversationId()),
    name: plan?.name || plan?.code || 'Talepet Dijital Hizmeti',
    category1: 'Digital Services',
    category2: plan?.isRecurring ? 'Membership' : 'Visibility',
    itemType: getIyzicoClient().constructor.BASKET_ITEM_TYPE.VIRTUAL,
    price: toIyzicoPrice(plan?.price),
    description: digitalLabel
  };
};

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

const buildCheckoutRequest = ({ user, plan, mode, paymentId, clientIp, returnUrl, conversationId, userAgent }) => {
  const Iyzipay = getIyzicoClient().constructor;
  const price = toIyzicoPrice(plan?.price);
  const { buyer, billingAddress, shippingAddress } = buildBuyerProfile({ user, clientIp });
  const paymentGroup =
    plan?.code === 'listing_extra' || String(plan?.code || '').startsWith('featured')
      ? Iyzipay.PAYMENT_GROUP.LISTING
      : mode === 'subscription'
        ? Iyzipay.PAYMENT_GROUP.SUBSCRIPTION
        : Iyzipay.PAYMENT_GROUP.PRODUCT;
  const paymentChannel = /iphone|ipad|android|mobile/i.test(String(userAgent || ''))
    ? Iyzipay.PAYMENT_CHANNEL.MOBILE_WEB
    : Iyzipay.PAYMENT_CHANNEL.WEB;

  return {
    locale: Iyzipay.LOCALE.TR,
    conversationId,
    price,
    paidPrice: price,
    currency: plan?.currency || Iyzipay.CURRENCY.TRY,
    basketId: String(paymentId),
    paymentChannel,
    paymentGroup,
    callbackUrl: returnUrl,
    buyer,
    shippingAddress,
    billingAddress,
    basketItems: [buildBasketItem({ plan, paymentId })]
  };
};

const summarizeProviderResponse = (response) => ({
  status: response?.status || null,
  errorCode: response?.errorCode || null,
  errorMessage: response?.errorMessage || null,
  errorGroup: response?.errorGroup || null,
  token: response?.token ? 'present' : 'missing',
  paymentPageUrl: response?.paymentPageUrl ? 'present' : 'missing',
  checkoutFormContent: response?.checkoutFormContent ? 'present' : 'missing',
  conversationId: response?.conversationId || null,
  paymentId: response?.paymentId || response?.paymentReferenceCode || null,
  keys: response ? Object.keys(response) : []
});

export const createCheckout = async ({ user, plan, mode, paymentId, clientIp, userAgent }) => {
  const conversationId = createConversationId();
  const appBaseUrl = resolveAppBaseUrl();
  if (!appBaseUrl) {
    const error = new Error('APP_BASE_URL is not configured');
    error.code = 'app_base_url_missing';
    error.context = 'createCheckout';
    error.audit = getIyzicoConfigAudit();
    throw error;
  }

  const returnUrl =
    buildSurfaceUrl('app', '/premium/return', { paymentId }) ||
    `${appBaseUrl}/premium/return?paymentId=${paymentId}`;
  const requestPayload = buildCheckoutRequest({
    user,
    plan,
    mode,
    paymentId,
    clientIp,
    returnUrl,
    conversationId,
    userAgent
  });

  try {
    const response = await invokeIyzico('checkoutFormInitialize', 'create', requestPayload);
    const summary = summarizeProviderResponse(response);

    if (response?.status && response.status !== 'success') {
      const error = new Error(response?.errorMessage || 'Iyzico checkout initialize failed');
      error.code = response?.errorCode || 'provider_checkout_failed';
      error.publicCode = 'provider_checkout_failed';
      error.context = 'createCheckout';
      error.payload = {
        responseKeys: summary.keys,
        providerStatus: summary.status,
        providerErrorCode: summary.errorCode,
        providerErrorMessage: summary.errorMessage,
        providerErrorGroup: summary.errorGroup,
        providerAudit: getIyzicoConfigAudit()
      };
      throw error;
    }

    const checkoutUrl = response?.paymentPageUrl || '';
    const checkoutFormContent = response?.checkoutFormContent || '';

    if (!checkoutUrl && !checkoutFormContent) {
      const error = new Error('Provider checkout payload missing redirect target');
      error.code = 'provider_checkout_payload_missing';
      error.publicCode = 'provider_checkout_failed';
      error.context = 'createCheckout';
      error.payload = {
        responseKeys: summary.keys,
        providerStatus: summary.status,
        providerAudit: getIyzicoConfigAudit()
      };
      throw error;
    }

    return {
      checkoutUrl: checkoutUrl || '',
      checkoutFormContent,
      providerPaymentId: response?.paymentId || response?.paymentReferenceCode || response?.token || null,
      conversationId,
      returnUrl,
      raw: response
    };
  } catch (error) {
    error.context = error.context || 'createCheckout';
    error.publicCode = error.publicCode || error.code || 'provider_checkout_failed';
    error.payload = {
      ...(error.payload || {}),
      providerAudit: error.payload?.providerAudit || getIyzicoConfigAudit()
    };
    throw error;
  }
};

export const cancelSubscription = async ({ providerSubId }) => {
  if (!providerSubId) {
    throw new Error('providerSubId is required for subscription cancel');
  }

  try {
    const response = await invokeIyzico('subscription', 'cancel', {
      subscriptionReferenceCode: providerSubId
    });
    if (response?.status && response.status !== 'success') {
      const error = new Error(response?.errorMessage || 'Iyzico subscription cancel failed');
      error.code = response?.errorCode || 'provider_subscription_cancel_failed';
      error.payload = {
        providerStatus: response?.status || null,
        providerErrorCode: response?.errorCode || null,
        providerErrorMessage: response?.errorMessage || null,
        responseKeys: response ? Object.keys(response) : [],
        providerAudit: getIyzicoConfigAudit()
      };
      throw error;
    }
    return response;
  } catch (error) {
    error.context = 'cancelSubscription';
    error.payload = {
      ...(error.payload || {}),
      providerAudit: error.payload?.providerAudit || getIyzicoConfigAudit()
    };
    throw error;
  }
};

export const generateEventHash = (rawBody) => {
  return crypto.createHash('sha256').update(rawBody || '').digest('hex');
};
