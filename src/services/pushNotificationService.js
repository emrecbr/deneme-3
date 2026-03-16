import NotificationPreference from '../../models/NotificationPreference.js';
import NotificationLog from '../../models/NotificationLog.js';
import NotificationDevice from '../../models/NotificationDevice.js';
import { getNotificationTemplate, notificationPreferenceMap } from '../utils/notificationTemplates.js';

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
const ONESIGNAL_API_URL = process.env.ONESIGNAL_API_URL || 'https://onesignal.com/api/v1/notifications';
// TODO(post-launch): segment/journey bazli gonderim ve advanced analytics eklenebilir.

const isPushConfigured = () => Boolean(ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY);

const buildOneSignalRequest = ({ externalIds, title, body, data }) => ({
  app_id: ONESIGNAL_APP_ID,
  include_aliases: {
    external_id: externalIds
  },
  headings: { tr: title, en: title },
  contents: { tr: body, en: body },
  data: data || {}
});

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch (_error) {
    parsed = { raw: text };
  }
  return { ok: response.ok, status: response.status, data: parsed };
};

const getPreferenceForUser = async (userId) => {
  if (!userId) return null;
  return NotificationPreference.findOne({ user: userId }).lean();
};

const isAllowedByPreference = (preferences, type) => {
  if (!preferences) return true;
  if (!preferences.pushEnabled) return false;
  const key = notificationPreferenceMap[type];
  if (!key) return true;
  return Boolean(preferences[key]);
};

const logResult = async ({ userId, type, title, body, payload, status, providerMessageId, providerResponse }) => {
  return NotificationLog.create({
    user: userId || undefined,
    provider: 'onesignal',
    channel: 'push',
    type,
    title,
    body,
    payload,
    status,
    providerMessageId: providerMessageId || undefined,
    providerResponse,
    sentAt: status === 'sent' ? new Date() : undefined,
    failedAt: status === 'failed' ? new Date() : undefined
  });
};

export const upsertNotificationDevice = async ({ userId, externalId, subscriptionId, platform, appVersion }) => {
  if (!userId || !externalId) return;
  await NotificationDevice.findOneAndUpdate(
    { user: userId },
    {
      user: userId,
      onesignalExternalId: externalId,
      lastKnownSubscriptionId: subscriptionId || undefined,
      platform,
      appVersion,
      lastSeenAt: new Date()
    },
    { upsert: true, new: true }
  );
};

export const saveNotificationPreferences = async (userId, prefs) => {
  if (!userId) return null;
  const payload = {
    pushEnabled: prefs.pushEnabled,
    offerNotifications: prefs.offerNotifications,
    messageNotifications: prefs.messageNotifications,
    systemNotifications: prefs.systemNotifications,
    marketingNotifications: prefs.marketingNotifications,
    paymentNotifications: prefs.paymentNotifications,
    listingNotifications: prefs.listingNotifications
  };
  return NotificationPreference.findOneAndUpdate({ user: userId }, payload, { upsert: true, new: true });
};

export const sendPushToUser = async ({ userId, type, payload = {}, title, body }) => {
  const template = getNotificationTemplate(type, { ...payload, title, body });
  const finalTitle = title || template.title;
  const finalBody = body || template.body;
  const preferences = await getPreferenceForUser(userId);
  if (!isAllowedByPreference(preferences, type)) {
    await logResult({
      userId,
      type,
      title: finalTitle,
      body: finalBody,
      payload,
      status: 'failed',
      providerResponse: { reason: 'preferences_disabled' }
    });
    return { ok: false, reason: 'preferences_disabled' };
  }
  if (!isPushConfigured()) {
    await logResult({
      userId,
      type,
      title: finalTitle,
      body: finalBody,
      payload,
      status: 'failed',
      providerResponse: { reason: 'provider_not_configured' }
    });
    return { ok: false, reason: 'provider_not_configured' };
  }

  const result = await fetchJson(ONESIGNAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`
    },
    body: JSON.stringify(buildOneSignalRequest({ externalIds: [String(userId)], title: finalTitle, body: finalBody, data: payload }))
  });

  if (!result.ok) {
    await logResult({
      userId,
      type,
      title: finalTitle,
      body: finalBody,
      payload,
      status: 'failed',
      providerResponse: result.data
    });
    return { ok: false, reason: 'provider_error', details: result.data };
  }

  await logResult({
    userId,
    type,
    title: finalTitle,
    body: finalBody,
    payload,
    status: 'sent',
    providerMessageId: result.data?.id,
    providerResponse: result.data
  });

  return { ok: true, data: result.data };
};

export const sendPushToUsers = async ({ userIds, type, payload = {}, title, body }) => {
  const results = [];
  for (const userId of userIds || []) {
    // eslint-disable-next-line no-await-in-loop
    const result = await sendPushToUser({ userId, type, payload, title, body });
    results.push({ userId, ...result });
  }
  return results;
};

export const sendPushToExternalId = async ({ externalId, type, payload = {}, title, body }) => {
  const template = getNotificationTemplate(type, { ...payload, title, body });
  const finalTitle = title || template.title;
  const finalBody = body || template.body;
  if (!isPushConfigured()) {
    await logResult({
      userId: null,
      type,
      title: finalTitle,
      body: finalBody,
      payload,
      status: 'failed',
      providerResponse: { reason: 'provider_not_configured', externalId }
    });
    return { ok: false, reason: 'provider_not_configured' };
  }

  const result = await fetchJson(ONESIGNAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`
    },
    body: JSON.stringify(buildOneSignalRequest({ externalIds: [String(externalId)], title: finalTitle, body: finalBody, data: payload }))
  });

  if (!result.ok) {
    await logResult({
      userId: null,
      type,
      title: finalTitle,
      body: finalBody,
      payload,
      status: 'failed',
      providerResponse: result.data
    });
    return { ok: false, reason: 'provider_error', details: result.data };
  }

  await logResult({
    userId: null,
    type,
    title: finalTitle,
    body: finalBody,
    payload,
    status: 'sent',
    providerMessageId: result.data?.id,
    providerResponse: result.data
  });

  return { ok: true, data: result.data };
};
