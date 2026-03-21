import NotificationSubscription from '../../models/NotificationSubscription.js';
import NotificationLog from '../../models/NotificationLog.js';
import Notification from '../../models/Notification.js';
import SubscriptionMatch from '../../models/SubscriptionMatch.js';
import AppSetting from '../../models/AppSetting.js';
import { sendPushToUser } from './pushNotificationService.js';

const ALLOWED_TYPES = new Set(['category', 'category_city', 'category_city_district', 'keyword']);
const THROTTLE_WINDOW_MS = 60 * 1000;
const DEFAULT_DAILY_PUSH_LIMIT = 5;
const DAILY_LIMIT_CACHE_TTL_MS = 60 * 1000;
let dailyLimitCache = { value: DEFAULT_DAILY_PUSH_LIMIT, ts: 0 };

const normalizeText = (value) => {
  let text = String(value || '').trim().toLowerCase();
  text = text
    .replace(/[İI]/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u');
  text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
};

const buildSubscriptionKey = ({ type, categoryId, cityId, districtId, keywordNormalized }) => {
  return [
    type || '',
    categoryId || '',
    cityId || '',
    districtId || '',
    keywordNormalized || ''
  ].join('|');
};

const inferType = ({ categoryId, cityId, districtId, keyword }) => {
  if (keyword) return 'keyword';
  if (categoryId && cityId && districtId) return 'category_city_district';
  if (categoryId && cityId) return 'category_city';
  if (categoryId) return 'category';
  return null;
};

export const buildSubscriptionPayload = ({ type, categoryId, cityId, districtId, keyword, notifyPush, notifyInApp }) => {
  const inferred = type || inferType({ categoryId, cityId, districtId, keyword });
  if (!inferred || !ALLOWED_TYPES.has(inferred)) {
    return { error: 'invalid_type' };
  }

  const normalizedKeyword = keyword ? normalizeText(keyword) : '';
  if (inferred === 'keyword' && !normalizedKeyword) {
    return { error: 'keyword_required' };
  }

  if (inferred !== 'keyword' && !categoryId) {
    return { error: 'category_required' };
  }

  if (inferred === 'category_city' && !cityId) {
    return { error: 'city_required' };
  }

  if (inferred === 'category_city_district' && (!cityId || !districtId)) {
    return { error: 'district_required' };
  }

  const key = buildSubscriptionKey({
    type: inferred,
    categoryId,
    cityId,
    districtId,
    keywordNormalized: normalizedKeyword
  });

  return {
    type: inferred,
    category: categoryId || undefined,
    city: cityId || undefined,
    district: districtId || undefined,
    keyword: keyword || undefined,
    keywordNormalized: normalizedKeyword || undefined,
    notifyPush: notifyPush !== false,
    notifyInApp: Boolean(notifyInApp),
    key
  };
};

export const listUserSubscriptions = async (userId) => {
  return NotificationSubscription.find({ user: userId })
    .populate('category', 'name')
    .populate('city', 'name')
    .populate('district', 'name')
    .sort({ createdAt: -1 })
    .lean();
};

export const listUserSubscriptionsWithMatches = async (userId, limit = 3) => {
  const subs = await listUserSubscriptions(userId);
  if (!subs.length) return [];
  const subIds = subs.map((s) => s._id);
  const matches = await SubscriptionMatch.find({ user: userId, subscription: { $in: subIds } })
    .populate('rfq', 'title city district createdAt')
    .populate('city', 'name')
    .populate('district', 'name')
    .sort({ createdAt: -1 })
    .lean();

  const grouped = new Map();
  matches.forEach((item) => {
    const key = String(item.subscription);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  });

  return subs.map((sub) => {
    const list = grouped.get(String(sub._id)) || [];
    const recent = list.slice(0, limit);
    const unreadCount = list.filter((m) => !m.isSeen).length;
    return {
      ...sub,
      matches: recent.map((m) => ({
        _id: m._id,
        subscriptionId: m.subscription,
        rfqId: m.rfq?._id || m.rfq,
        title: m.rfq?.title || 'Yeni talep',
        cityName: m.city?.name || '',
        districtName: m.district?.name || '',
        createdAt: m.createdAt,
        isSeen: m.isSeen,
        matchedBy: m.matchedBy
      })),
      unreadCount
    };
  });
};

const hasDuplicateNotification = async ({ userId, rfqId, subscriptionId }) => {
  if (!userId || !rfqId || !subscriptionId) return false;
  const existing = await NotificationLog.findOne({
    user: userId,
    type: 'new_matching_rfq',
    'payload.rfqId': String(rfqId),
    'payload.subscriptionId': String(subscriptionId)
  }).lean();
  return Boolean(existing);
};

const shouldThrottle = (subscription) => {
  if (!subscription?.lastTriggeredAt) return false;
  return Date.now() - new Date(subscription.lastTriggeredAt).getTime() < THROTTLE_WINDOW_MS;
};

const getDailyPushLimit = async () => {
  const now = Date.now();
  if (now - dailyLimitCache.ts < DAILY_LIMIT_CACHE_TTL_MS) {
    return dailyLimitCache.value;
  }
  try {
    let doc = await AppSetting.findOne({ key: 'alert_push_daily_limit' }).lean();
    if (!doc) {
      doc = await AppSetting.create({
        key: 'alert_push_daily_limit',
        value: { limit: DEFAULT_DAILY_PUSH_LIMIT }
      });
    }
    const value = Number(doc?.value?.limit);
    dailyLimitCache = {
      value: Number.isFinite(value) && value > 0 ? value : DEFAULT_DAILY_PUSH_LIMIT,
      ts: now
    };
  } catch (_error) {
    dailyLimitCache = { value: DEFAULT_DAILY_PUSH_LIMIT, ts: now };
  }
  return dailyLimitCache.value;
};

const startOfToday = () => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getDailySentCount = async (userId) => {
  if (!userId) return 0;
  const limit = await getDailyPushLimit();
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  const count = await NotificationLog.countDocuments({
    user: userId,
    type: 'new_matching_rfq',
    channel: 'push',
    status: 'sent',
    createdAt: { $gte: startOfToday() }
  });
  return count;
};

const hasReachedDailyLimit = async (userId) => {
  if (!userId) return false;
  const limit = await getDailyPushLimit();
  if (!Number.isFinite(limit) || limit <= 0) return false;
  const count = await getDailySentCount(userId);
  return count >= limit;
};

const logSkippedPush = async ({ userId, payload, reason, meta }) => {
  await NotificationLog.create({
    user: userId || undefined,
    provider: 'onesignal',
    channel: 'push',
    type: 'new_matching_rfq',
    title: payload?.title || 'Yeni ilan',
    body: payload?.body || '',
    payload,
    status: 'failed',
    providerResponse: { reason, ...(meta || {}) }
  });
};

const matchCategorySubscriptions = (subscriptions, rfq) => {
  const categoryId = String(rfq?.category?._id || rfq?.category || '');
  const cityId = String(rfq?.city?._id || rfq?.city || '');
  const districtId = String(rfq?.district?._id || rfq?.district || '');

  return subscriptions.filter((sub) => {
    const subCategoryId = String(sub.category?._id || sub.category || '');
    const subCityId = String(sub.city?._id || sub.city || '');
    const subDistrictId = String(sub.district?._id || sub.district || '');
    if (subCategoryId !== categoryId) return false;
    if (sub.type === 'category') return true;
    if (sub.type === 'category_city') return subCityId === cityId;
    if (sub.type === 'category_city_district') {
      return subCityId === cityId && subDistrictId === districtId;
    }
    return false;
  });
};

const matchKeywordSubscriptions = (subscriptions, rfq) => {
  const text = normalizeText(`${rfq?.title || ''} ${rfq?.description || ''}`);
  if (!text) return [];
  return subscriptions.filter((sub) => {
    if (!sub.keywordNormalized) return false;
    return text.includes(sub.keywordNormalized);
  });
};

export const triggerMatchingAlertsForRfq = async (rfq) => {
  if (!rfq?._id) return { matched: 0, sent: 0 };
  const ownerId = String(rfq?.buyer?._id || rfq?.buyer || '');

  const [categorySubs, keywordSubs] = await Promise.all([
    NotificationSubscription.find({
      isActive: true,
      type: { $in: ['category', 'category_city', 'category_city_district'] },
      category: rfq?.category?._id || rfq?.category || undefined
    })
      .populate('category', 'name')
      .populate('city', 'name')
      .populate('district', 'name')
      .lean(),
    NotificationSubscription.find({ isActive: true, type: 'keyword' })
      .populate('category', 'name')
      .populate('city', 'name')
      .populate('district', 'name')
      .lean()
  ]);

  const matchedCategory = matchCategorySubscriptions(categorySubs, rfq).map((sub) => ({ sub, matchedBy: sub.type }));
  const matchedKeyword = matchKeywordSubscriptions(keywordSubs, rfq).map((sub) => ({ sub, matchedBy: 'keyword' }));
  const matched = [...matchedCategory, ...matchedKeyword];

  let sent = 0;
  for (const { sub: subscription, matchedBy } of matched) {
    const userId = String(subscription.user || '');
    if (!userId || userId === ownerId) continue;
    if (!subscription.isActive) continue;
    if (!subscription.notifyPush && !subscription.notifyInApp) continue;
    if (shouldThrottle(subscription)) continue;

    const existingMatch = await SubscriptionMatch.findOne({
      subscription: subscription._id,
      rfq: rfq._id
    }).lean();
    if (existingMatch) {
      continue;
    }

    if (await hasDuplicateNotification({ userId, rfqId: rfq._id, subscriptionId: subscription._id })) {
      continue;
    }

    const title = rfq?.title || 'Yeni ilan';
    const categoryName = subscription?.category?.name || '';
    const cityName = subscription?.city?.name || '';
    const body = categoryName
      ? `${categoryName}${cityName ? ` - ${cityName}` : ''} kategorisinde yeni ilan var.`
      : 'Takip ettiğin kriterle eşleşen yeni ilan var.';

    const payload = {
      rfqId: String(rfq._id),
      categoryId: String(rfq?.category?._id || rfq?.category || ''),
      cityId: String(rfq?.city?._id || rfq?.city || ''),
      districtId: String(rfq?.district?._id || rfq?.district || ''),
      subscriptionId: String(subscription._id),
      source: 'subscription_match',
      screen: 'subscriptions'
    };

    const matchRecord = await SubscriptionMatch.create({
      subscription: subscription._id,
      user: userId,
      rfq: rfq._id,
      category: rfq?.category?._id || rfq?.category || undefined,
      city: rfq?.city?._id || rfq?.city || undefined,
      district: rfq?.district?._id || rfq?.district || undefined,
      matchedBy,
      isNotified: false
    });

    if (subscription.notifyInApp) {
      await Notification.create({
        user: userId,
        message: `Yeni ilan: ${title}`,
        type: 'system',
        data: { ...payload, matchId: String(matchRecord._id) },
        relatedId: rfq._id
      });
    }

    if (subscription.notifyPush) {
      const limitReached = await hasReachedDailyLimit(userId);
      if (limitReached) {
        const limit = await getDailyPushLimit();
        const count = await getDailySentCount(userId);
        await logSkippedPush({
          userId,
          payload: { ...payload, matchId: String(matchRecord._id), title: `Yeni ilan: ${title}`, body },
          reason: 'daily_limit',
          meta: { limit, count }
        });
      } else {
        const pushResult = await sendPushToUser({
          userId,
          type: 'new_matching_rfq',
          title: `Yeni ilan: ${title}`,
          body,
          payload: { ...payload, matchId: String(matchRecord._id) }
        });
        if (pushResult?.ok) {
          await SubscriptionMatch.updateOne({ _id: matchRecord._id }, { $set: { isNotified: true } });
        }
      }
    }

    await NotificationSubscription.updateOne(
      { _id: subscription._id },
      { $set: { lastTriggeredAt: new Date() }, $inc: { triggerCount: 1 } }
    );

    sent += 1;
  }

  return { matched: matched.length, sent };
};
