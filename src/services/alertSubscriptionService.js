import mongoose from 'mongoose';
import Category from '../../models/Category.js';
import NotificationSubscription from '../../models/NotificationSubscription.js';
import NotificationLog from '../../models/NotificationLog.js';
import Notification from '../../models/Notification.js';
import SubscriptionMatch from '../../models/SubscriptionMatch.js';
import AppSetting from '../../models/AppSetting.js';
import RFQ from '../../models/RFQ.js';
import { applyExpiryFilter, backfillMissingExpiresAt, getListingExpiryDays, markExpiredRfqs } from '../utils/rfqExpiry.js';
import { sendPushToUser } from './pushNotificationService.js';

const ALLOWED_TYPES = new Set(['category', 'category_city', 'category_city_district', 'keyword']);
const THROTTLE_WINDOW_MS = 60 * 1000;
const DEFAULT_DAILY_PUSH_LIMIT = 5;
const DAILY_LIMIT_CACHE_TTL_MS = 60 * 1000;
let dailyLimitCache = { value: DEFAULT_DAILY_PUSH_LIMIT, ts: 0 };

const toIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'object' && value._id) {
    return String(value._id);
  }
  return String(value);
};

const normalizeText = (value) => {
  let text = String(value || '').trim().toLowerCase();
  text = text
    .replace(/[Ä°I]/g, 'i')
    .replace(/Ä±/g, 'i')
    .replace(/ÄŸ/g, 'g')
    .replace(/ÅŸ/g, 's')
    .replace(/Ã§/g, 'c')
    .replace(/Ã¶/g, 'o')
    .replace(/Ã¼/g, 'u');
  text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
};

const buildSubscriptionKey = ({ type, categoryId, cityId, districtId, keywordNormalized }) => {
  return [type || '', categoryId || '', cityId || '', districtId || '', keywordNormalized || ''].join('|');
};

const inferType = ({ categoryId, cityId, districtId, keyword }) => {
  if (keyword) return 'keyword';
  if (categoryId && cityId && districtId) return 'category_city_district';
  if (categoryId && cityId) return 'category_city';
  if (categoryId) return 'category';
  return null;
};

const buildActiveRfqQuery = (extra = {}) => {
  const query = {
    status: 'open',
    isDeleted: { $ne: true }
  };
  applyExpiryFilter(query, new Date());
  if (extra.segment) {
    query.segment = extra.segment;
  }
  if (extra.city) {
    query.city = extra.city;
  }
  if (extra.district) {
    query.district = extra.district;
  }
  return query;
};

const ensureRfqLifecycle = async () => {
  const now = new Date();
  const expiryDays = await getListingExpiryDays();
  await backfillMissingExpiresAt(expiryDays);
  await markExpiredRfqs(now);
};

const loadCategoryContext = async () => {
  const categories = await Category.find({ isActive: { $ne: false } })
    .select('_id name slug parent segment')
    .lean();

  const byId = new Map();
  const bySlug = new Map();
  const byName = new Map();

  categories.forEach((category) => {
    const id = String(category._id);
    const slug = String(category.slug || '').trim().toLowerCase();
    const normalizedName = normalizeText(category.name);
    byId.set(id, category);
    if (slug) bySlug.set(slug, category);
    if (normalizedName && !byName.has(normalizedName)) {
      byName.set(normalizedName, category);
    }
  });

  return { byId, bySlug, byName };
};

const resolveCategoryDescriptor = (rawCategory, context) => {
  if (!rawCategory) return null;

  const directId = toIdString(rawCategory);
  if (directId && mongoose.isValidObjectId(directId) && context.byId.has(directId)) {
    return context.byId.get(directId);
  }

  const slugCandidate =
    typeof rawCategory === 'string'
      ? String(rawCategory).trim().toLowerCase()
      : typeof rawCategory === 'object' && rawCategory.slug
        ? String(rawCategory.slug).trim().toLowerCase()
        : '';
  if (slugCandidate && context.bySlug.has(slugCandidate)) {
    return context.bySlug.get(slugCandidate);
  }

  const nameCandidate =
    typeof rawCategory === 'string'
      ? normalizeText(rawCategory)
      : typeof rawCategory === 'object' && rawCategory.name
        ? normalizeText(rawCategory.name)
        : '';
  if (nameCandidate && context.byName.has(nameCandidate)) {
    return context.byName.get(nameCandidate);
  }

  return null;
};

const buildCategoryChain = (category, context) => {
  const ids = new Set();
  let current = category;
  while (current?._id) {
    const currentId = String(current._id);
    if (ids.has(currentId)) break;
    ids.add(currentId);
    const parentId = toIdString(current.parent);
    current = parentId ? context.byId.get(parentId) : null;
  }
  return ids;
};

const buildRfqDescriptor = (rfq, context) => {
  const category = resolveCategoryDescriptor(rfq?.category, context);
  const categoryChain = category ? buildCategoryChain(category, context) : new Set();
  const segment = String(rfq?.segment || category?.segment || '').trim().toLowerCase();
  return {
    rfq,
    category,
    categoryChain,
    categoryId: category?._id ? String(category._id) : '',
    cityId: toIdString(rfq?.city),
    districtId: toIdString(rfq?.district),
    buyerId: toIdString(rfq?.buyer),
    segment,
    searchText: normalizeText(`${rfq?.title || ''} ${rfq?.description || ''}`)
  };
};

const matchSubscriptionAgainstRfq = (subscription, rfqDescriptor, context) => {
  if (!subscription?.isActive || !rfqDescriptor?.rfq?._id) {
    return null;
  }

  if (subscription.type === 'keyword') {
    if (!subscription.keywordNormalized || !rfqDescriptor.searchText) {
      return null;
    }
    return rfqDescriptor.searchText.includes(subscription.keywordNormalized) ? 'keyword' : null;
  }

  const subscriptionCategory = resolveCategoryDescriptor(subscription.category, context);
  const subscriptionCategoryId = subscriptionCategory?._id ? String(subscriptionCategory._id) : '';
  if (!subscriptionCategoryId) {
    return null;
  }

  const subscriptionSegment = String(subscriptionCategory.segment || '').trim().toLowerCase();
  if (subscriptionSegment && rfqDescriptor.segment && subscriptionSegment !== rfqDescriptor.segment) {
    return null;
  }

  if (!rfqDescriptor.categoryChain.has(subscriptionCategoryId)) {
    return null;
  }

  const subscriptionCityId = toIdString(subscription.city);
  const subscriptionDistrictId = toIdString(subscription.district);

  if (subscription.type === 'category') {
    return 'category';
  }
  if (subscription.type === 'category_city') {
    return subscriptionCityId && subscriptionCityId === rfqDescriptor.cityId ? 'category_city' : null;
  }
  if (subscription.type === 'category_city_district') {
    return subscriptionCityId &&
      subscriptionDistrictId &&
      subscriptionCityId === rfqDescriptor.cityId &&
      subscriptionDistrictId === rfqDescriptor.districtId
      ? 'category_city_district'
      : null;
  }
  return null;
};

const buildMatchInsert = ({ subscription, rfqDescriptor, matchedBy }) => ({
  subscription: subscription._id,
  user: subscription.user,
  rfq: rfqDescriptor.rfq._id,
  category: rfqDescriptor.category?._id || undefined,
  city: rfqDescriptor.rfq?.city || undefined,
  district: rfqDescriptor.rfq?.district || undefined,
  matchedBy,
  isNotified: false
});

const upsertMatchRecord = async ({ subscription, rfqDescriptor, matchedBy }) => {
  const existing = await SubscriptionMatch.findOne({
    subscription: subscription._id,
    rfq: rfqDescriptor.rfq._id
  }).lean();
  if (existing) {
    return { inserted: false, matchId: existing._id };
  }

  const created = await SubscriptionMatch.create(buildMatchInsert({ subscription, rfqDescriptor, matchedBy }));
  return { inserted: true, matchId: created._id };
};

const shouldThrottle = (subscription) => {
  if (!subscription?.lastTriggeredAt) return false;
  return Date.now() - new Date(subscription.lastTriggeredAt).getTime() < THROTTLE_WINDOW_MS;
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
    .populate('category', 'name slug parent segment')
    .populate('city', 'name')
    .populate('district', 'name')
    .sort({ createdAt: -1 })
    .lean();
};

export const listUserSubscriptionsWithMatches = async (userId, limit = 10) => {
  await ensureRfqLifecycle();
  const subs = await listUserSubscriptions(userId);
  if (!subs.length) return [];

  const subIds = subs.map((s) => s._id);
  const matches = await SubscriptionMatch.find({ user: userId, subscription: { $in: subIds } })
    .sort({ createdAt: -1 })
    .lean();

  const rfqIds = [...new Set(matches.map((item) => toIdString(item.rfq)).filter(Boolean))];
  const activeRfqQuery = buildActiveRfqQuery();
  activeRfqQuery._id = { $in: rfqIds };

  const rfqs = await RFQ.find(activeRfqQuery)
    .populate('category', 'name slug parent segment')
    .populate('city', 'name')
    .populate('district', 'name')
    .select('title category city district createdAt status expiresAt isDeleted segment')
    .lean();

  const rfqMap = new Map(rfqs.map((rfq) => [String(rfq._id), rfq]));

  const grouped = new Map();
  matches.forEach((item) => {
    const subscriptionKey = String(item.subscription);
    const rfq = rfqMap.get(toIdString(item.rfq));
    if (!rfq) return;
    if (!grouped.has(subscriptionKey)) grouped.set(subscriptionKey, []);
    grouped.get(subscriptionKey).push({ ...item, rfq });
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
        categoryName: m.rfq?.category?.name || '',
        cityName: m.rfq?.city?.name || '',
        districtName: m.rfq?.district?.name || '',
        createdAt: m.createdAt,
        isSeen: m.isSeen,
        matchedBy: m.matchedBy
      })),
      unreadCount
    };
  });
};

export const hydrateSubscriptionWithMatches = async (userId, subscriptionId, limit = 10) => {
  const items = await listUserSubscriptionsWithMatches(userId, limit);
  return items.find((item) => String(item._id) === String(subscriptionId)) || null;
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

export const backfillSubscriptionMatches = async (subscriptionInput) => {
  const subscription =
    subscriptionInput?._id
      ? subscriptionInput
      : await NotificationSubscription.findById(subscriptionInput)
        .populate('category', 'name slug parent segment')
        .populate('city', 'name')
        .populate('district', 'name')
        .lean();

  if (!subscription?._id || !subscription.isActive) {
    return { matched: 0, inserted: 0 };
  }

  await ensureRfqLifecycle();
  const categoryContext = await loadCategoryContext();
  const subscriptionCategory = resolveCategoryDescriptor(subscription.category, categoryContext);
  const query = buildActiveRfqQuery({
    segment: subscriptionCategory?.segment || undefined,
    city: subscription.type === 'category_city' || subscription.type === 'category_city_district' ? subscription.city : undefined,
    district: subscription.type === 'category_city_district' ? subscription.district : undefined
  });

  const rfqs = await RFQ.find(query)
    .select('title description category segment city district buyer createdAt status expiresAt isDeleted')
    .lean();

  const operations = [];
  let matched = 0;

  rfqs.forEach((rfq) => {
    const descriptor = buildRfqDescriptor(rfq, categoryContext);
    if (!descriptor.rfq?._id) return;
    if (descriptor.buyerId && descriptor.buyerId === toIdString(subscription.user)) return;
    const matchedBy = matchSubscriptionAgainstRfq(subscription, descriptor, categoryContext);
    if (!matchedBy) return;
    matched += 1;
    operations.push({
      updateOne: {
        filter: {
          subscription: subscription._id,
          rfq: descriptor.rfq._id
        },
        update: {
          $setOnInsert: buildMatchInsert({
            subscription,
            rfqDescriptor: descriptor,
            matchedBy
          })
        },
        upsert: true
      }
    });
  });

  if (!operations.length) {
    return { matched, inserted: 0 };
  }

  const result = await SubscriptionMatch.bulkWrite(operations, { ordered: false });
  return {
    matched,
    inserted: result?.upsertedCount || 0
  };
};

export const triggerMatchingAlertsForRfq = async (rfq) => {
  if (!rfq?._id) return { matched: 0, sent: 0 };
  await ensureRfqLifecycle();

  const categoryContext = await loadCategoryContext();
  const rfqDescriptor = buildRfqDescriptor(rfq, categoryContext);
  const ownerId = rfqDescriptor.buyerId;

  const subscriptionQuery = {
    isActive: true,
    type: { $in: ['category', 'category_city', 'category_city_district', 'keyword'] }
  };
  if (rfqDescriptor.segment) {
    subscriptionQuery.$or = [
      { category: { $exists: false } },
      { category: { $ne: null } }
    ];
  }

  const subscriptions = await NotificationSubscription.find(subscriptionQuery)
    .populate('category', 'name slug parent segment')
    .populate('city', 'name')
    .populate('district', 'name')
    .lean();

  let matched = 0;
  let sent = 0;

  for (const subscription of subscriptions) {
    const userId = toIdString(subscription.user);
    if (!userId || userId === ownerId) continue;

    const matchedBy = matchSubscriptionAgainstRfq(subscription, rfqDescriptor, categoryContext);
    if (!matchedBy) continue;
    matched += 1;

    const { inserted, matchId } = await upsertMatchRecord({
      subscription,
      rfqDescriptor,
      matchedBy
    });

    if (!inserted) {
      continue;
    }

    const title = rfq?.title || 'Yeni ilan';
    const categoryName = rfqDescriptor.category?.name || subscription?.category?.name || '';
    const cityName = subscription?.city?.name || '';
    const body = categoryName
      ? `${categoryName}${cityName ? ` - ${cityName}` : ''} kategorisinde yeni ilan var.`
      : 'Takip ettiÄŸin kriterle eÅŸleÅŸen yeni ilan var.';

    const payload = {
      rfqId: String(rfq._id),
      categoryId: rfqDescriptor.categoryId,
      cityId: rfqDescriptor.cityId,
      districtId: rfqDescriptor.districtId,
      subscriptionId: String(subscription._id),
      source: 'subscription_match',
      screen: 'subscriptions'
    };

    if (subscription.notifyInApp) {
      await Notification.create({
        user: userId,
        message: `Yeni ilan: ${title}`,
        type: 'system',
        data: { ...payload, matchId: String(matchId) },
        relatedId: rfq._id
      });
    }

    if (subscription.notifyPush) {
      if (shouldThrottle(subscription)) {
        continue;
      }

      const duplicateNotification = await hasDuplicateNotification({
        userId,
        rfqId: rfq._id,
        subscriptionId: subscription._id
      });
      if (duplicateNotification) {
        continue;
      }

      const limitReached = await hasReachedDailyLimit(userId);
      if (limitReached) {
        const limit = await getDailyPushLimit();
        const count = await getDailySentCount(userId);
        await logSkippedPush({
          userId,
          payload: { ...payload, matchId: String(matchId), title: `Yeni ilan: ${title}`, body },
          reason: 'daily_limit',
          meta: { limit, count }
        });
      } else {
        const pushResult = await sendPushToUser({
          userId,
          type: 'new_matching_rfq',
          title: `Yeni ilan: ${title}`,
          body,
          payload: { ...payload, matchId: String(matchId) }
        });
        if (pushResult?.ok) {
          await SubscriptionMatch.updateOne({ _id: matchId }, { $set: { isNotified: true } });
        }
      }
    }

    await NotificationSubscription.updateOne(
      { _id: subscription._id },
      { $set: { lastTriggeredAt: new Date() }, $inc: { triggerCount: 1 } }
    );

    sent += 1;
  }

  return { matched, sent };
};
