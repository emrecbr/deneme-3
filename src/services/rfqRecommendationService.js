import mongoose from 'mongoose';
import Category from '../../models/Category.js';
import RFQ from '../../models/RFQ.js';
import SearchLog from '../../models/SearchLog.js';
import User from '../../models/User.js';
import { haversineDistanceKm } from '../utils/geoDistance.js';
import { applyExpiryFilter, backfillMissingExpiresAt, getListingExpiryDays, markExpiredRfqs } from '../utils/rfqExpiry.js';

const MAX_SEGMENT_CANDIDATES = 120;
const MAX_FALLBACK_CANDIDATES = 120;
const MAX_BEHAVIOR_LOGS = 15;
const MAX_FAVORITES = 20;
const ALLOWED_SEGMENTS = new Set(['goods', 'service', 'auto', 'jobseeker']);

const toIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'object' && value._id) {
    return String(value._id);
  }
  return String(value);
};

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const getCoords = (rfq) => {
  const raw = rfq?.location?.coordinates;
  if (Array.isArray(raw) && raw.length >= 2) {
    const lng = Number(raw[0]);
    const lat = Number(raw[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }
  return null;
};

const isFeaturedActive = (rfq) => {
  if (!rfq?.isFeatured || !rfq?.featuredUntil) {
    return false;
  }
  return new Date(rfq.featuredUntil).getTime() > Date.now();
};

const buildActiveQuery = (extra = {}) => {
  const query = {
    status: 'open',
    isDeleted: { $ne: true }
  };
  applyExpiryFilter(query, new Date());
  if (extra.segment) {
    query.segment = extra.segment;
  }
  if (extra.excludeId) {
    query._id = { $ne: extra.excludeId };
  }
  if (extra.ids?.length) {
    query._id = { $in: extra.ids };
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
    .select('_id name slug parent segment kind level')
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
  const chain = [];
  const ids = new Set();
  let current = category;

  while (current?._id) {
    const currentId = String(current._id);
    if (ids.has(currentId)) break;
    ids.add(currentId);
    chain.push(current);
    const parentId = toIdString(current.parent);
    current = parentId ? context.byId.get(parentId) : null;
  }

  return chain;
};

const buildRfqDescriptor = (rfq, context) => {
  const category = resolveCategoryDescriptor(rfq?.category, context);
  const chain = category ? buildCategoryChain(category, context) : [];
  const categoryIds = chain.map((item) => String(item._id));
  const segment = String(rfq?.segment || category?.segment || '').trim().toLowerCase();
  const cityId = toIdString(rfq?.city);
  const districtId = toIdString(rfq?.district);
  const searchText = normalizeText(
    `${rfq?.title || ''} ${rfq?.description || ''} ${chain.map((item) => item.name).join(' ')}`
  );

  return {
    rfq,
    id: toIdString(rfq?._id),
    category,
    categoryIds,
    categoryId: categoryIds[0] || '',
    parentCategoryId: categoryIds[1] || '',
    rootCategoryId: categoryIds[categoryIds.length - 1] || '',
    segment,
    cityId,
    districtId,
    buyerId: toIdString(rfq?.buyer),
    coords: getCoords(rfq),
    searchText,
    featuredActive: isFeaturedActive(rfq)
  };
};

const fetchBehaviorProfile = async ({ userId, context }) => {
  if (!userId || !mongoose.isValidObjectId(userId)) {
    return {
      hasSignals: false,
      categoryIds: new Set(),
      rootCategoryIds: new Set(),
      segmentCounts: new Map(),
      keywords: []
    };
  }

  const [searchLogs, user] = await Promise.all([
    SearchLog.find({ userId })
      .sort({ createdAt: -1 })
      .limit(MAX_BEHAVIOR_LOGS)
      .select('normalizedTerm categoryId')
      .lean(),
    User.findById(userId).select('favorites').lean()
  ]);

  const favoriteIds = Array.isArray(user?.favorites) ? user.favorites.slice(0, MAX_FAVORITES) : [];
  const favoriteRfqs = favoriteIds.length
    ? await RFQ.find(buildActiveQuery({ ids: favoriteIds }))
        .select('category segment title description city district location buyer featuredUntil isFeatured createdAt')
        .populate('category', 'name slug parent segment')
        .lean()
    : [];

  const categoryIds = new Set();
  const rootCategoryIds = new Set();
  const keywords = [];
  const segmentCounts = new Map();

  searchLogs.forEach((log) => {
    const categoryId = toIdString(log.categoryId);
    if (categoryId) {
      categoryIds.add(categoryId);
      const category = context.byId.get(categoryId);
      const chain = category ? buildCategoryChain(category, context) : [];
      const rootId = chain.length ? String(chain[chain.length - 1]._id) : '';
      if (rootId) rootCategoryIds.add(rootId);
      const segment = String(category?.segment || '').trim().toLowerCase();
      if (segment) {
        segmentCounts.set(segment, (segmentCounts.get(segment) || 0) + 1);
      }
    }
    const term = normalizeText(log.normalizedTerm || log.term);
    if (term) {
      keywords.push(term);
    }
  });

  favoriteRfqs.forEach((rfq) => {
    const descriptor = buildRfqDescriptor(rfq, context);
    if (descriptor.categoryId) categoryIds.add(descriptor.categoryId);
    if (descriptor.rootCategoryId) rootCategoryIds.add(descriptor.rootCategoryId);
    if (descriptor.segment) {
      segmentCounts.set(descriptor.segment, (segmentCounts.get(descriptor.segment) || 0) + 1);
    }
  });

  const uniqueKeywords = [...new Set(keywords)].slice(0, 10);

  return {
    hasSignals: Boolean(categoryIds.size || rootCategoryIds.size || uniqueKeywords.length || segmentCounts.size),
    categoryIds,
    rootCategoryIds,
    segmentCounts,
    keywords: uniqueKeywords
  };
};

const computeDistanceScore = (currentCoords, candidateCoords) => {
  if (!currentCoords || !candidateCoords) {
    return { score: 0, distanceKm: null };
  }

  const distanceKm = haversineDistanceKm(
    currentCoords.lat,
    currentCoords.lng,
    candidateCoords.lat,
    candidateCoords.lng
  );

  if (!Number.isFinite(distanceKm)) {
    return { score: 0, distanceKm: null };
  }

  if (distanceKm <= 5) return { score: 10, distanceKm };
  if (distanceKm <= 15) return { score: 7, distanceKm };
  if (distanceKm <= 30) return { score: 4, distanceKm };
  if (distanceKm <= 50) return { score: 2, distanceKm };
  return { score: 0, distanceKm };
};

const computeFreshnessScore = (createdAt) => {
  if (!createdAt) return 0;
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000);
  if (!Number.isFinite(ageDays)) return 0;
  if (ageDays <= 3) return 8;
  if (ageDays <= 7) return 6;
  if (ageDays <= 14) return 4;
  if (ageDays <= 30) return 2;
  return 0;
};

const scoreBehaviorSignals = ({ candidate, behavior }) => {
  let score = 0;
  const reasons = [];

  if (!behavior?.hasSignals) {
    return { score, reasons, matched: false };
  }

  let matched = false;

  if (candidate.categoryId && behavior.categoryIds.has(candidate.categoryId)) {
    score += 18;
    reasons.push('Kullanıcının ilgi gösterdiği kategori');
    matched = true;
  } else if (candidate.rootCategoryId && behavior.rootCategoryIds.has(candidate.rootCategoryId)) {
    score += 10;
    reasons.push('Kullanıcının ilgi gösterdiği ihtiyaç alanı');
    matched = true;
  }

  if (candidate.segment && behavior.segmentCounts.has(candidate.segment)) {
    score += 8;
    reasons.push('Kullanıcının ilgilendiği segment');
    matched = true;
  }

  if (behavior.keywords.length && candidate.searchText) {
    const keywordHit = behavior.keywords.find((keyword) => candidate.searchText.includes(keyword));
    if (keywordHit) {
      score += 12;
      reasons.push('Arama geçmişi ile uyumlu anahtar kelime');
      matched = true;
    }
  }

  return { score, reasons, matched };
};

const scoreCandidate = ({ current, candidate, behavior }) => {
  if (!candidate?.id || candidate.id === current.id) {
    return null;
  }

  let score = 0;
  const reasons = [];

  if (candidate.segment && candidate.segment === current.segment) {
    score += 30;
    reasons.push('Aynı segment');
  }

  let stage = 4;

  if (candidate.categoryId && candidate.categoryId === current.categoryId && candidate.segment === current.segment) {
    stage = 1;
    score += 50;
    reasons.push('Aynı kategori');
  } else if (
    candidate.segment === current.segment &&
    (
      (candidate.parentCategoryId && candidate.parentCategoryId === current.parentCategoryId && current.parentCategoryId) ||
      (candidate.rootCategoryId && candidate.rootCategoryId === current.rootCategoryId && current.rootCategoryId)
    )
  ) {
    stage = 2;
    if (candidate.parentCategoryId && candidate.parentCategoryId === current.parentCategoryId && current.parentCategoryId) {
      score += 32;
      reasons.push('Aynı üst kategori');
    } else {
      score += 24;
      reasons.push('Aynı ihtiyaç alanı');
    }
  }

  if (candidate.cityId && candidate.cityId === current.cityId) {
    score += 12;
    reasons.push('Aynı şehir');
  }
  if (candidate.districtId && candidate.districtId === current.districtId && current.districtId) {
    score += 8;
    reasons.push('Aynı ilçe');
  }

  const distanceResult = computeDistanceScore(current.coords, candidate.coords);
  if (distanceResult.score > 0) {
    score += distanceResult.score;
    reasons.push('Yakın konum');
  }

  const freshnessScore = computeFreshnessScore(candidate.rfq?.createdAt);
  if (freshnessScore > 0) {
    score += freshnessScore;
    reasons.push('Yeni talep');
  }

  if (candidate.featuredActive) {
    score += 2;
    reasons.push('Öne çıkarılmış');
  }

  const behaviorResult = scoreBehaviorSignals({ candidate, behavior });
  if (stage > 2 && behaviorResult.matched) {
    stage = 3;
  }
  score += behaviorResult.score;
  reasons.push(...behaviorResult.reasons);

  if (stage === 4 && candidate.segment && current.segment && candidate.segment !== current.segment && !behaviorResult.matched) {
    score -= 8;
  }

  return {
    stage,
    score,
    reasons: [...new Set(reasons)],
    distanceKm: distanceResult.distanceKm
  };
};

const fetchCandidatePool = async ({ current, excludedIds }) => {
  const basePopulate = [
    { path: 'category', select: 'name slug parent segment' },
    { path: 'city', select: 'name slug' },
    { path: 'district', select: 'name city' }
  ];

  const sameSegmentQuery = buildActiveQuery({
    segment: ALLOWED_SEGMENTS.has(current.segment) ? current.segment : undefined,
    excludeId: current.id
  });

  const sameSegment = await RFQ.find(sameSegmentQuery)
    .select('title description category segment city district buyer location isFeatured featuredUntil createdAt expiresAt status isDeleted')
    .populate(basePopulate)
    .sort({ createdAt: -1 })
    .limit(MAX_SEGMENT_CANDIDATES)
    .lean();

  const candidateMap = new Map();
  sameSegment.forEach((item) => {
    const itemId = toIdString(item._id);
    if (!itemId || excludedIds.has(itemId)) return;
    candidateMap.set(itemId, item);
  });

  if (candidateMap.size < MAX_SEGMENT_CANDIDATES) {
    const fallback = await RFQ.find(buildActiveQuery({ excludeId: current.id }))
      .select('title description category segment city district buyer location isFeatured featuredUntil createdAt expiresAt status isDeleted')
      .populate(basePopulate)
      .sort({ createdAt: -1 })
      .limit(MAX_FALLBACK_CANDIDATES)
      .lean();

    fallback.forEach((item) => {
      const itemId = toIdString(item._id);
      if (!itemId || excludedIds.has(itemId)) return;
      if (!candidateMap.has(itemId)) {
        candidateMap.set(itemId, item);
      }
    });
  }

  return [...candidateMap.values()];
};

export const getRecommendedRfqsForDetail = async ({ rfqId, userId, limit = 12 }) => {
  await ensureRfqLifecycle();

  const currentRfq = await RFQ.findById(rfqId)
    .populate('category', 'name slug parent segment')
    .populate('city', 'name slug')
    .populate('district', 'name city')
    .lean();

  if (!currentRfq || currentRfq.isDeleted) {
    const error = new Error('RFQ not found.');
    error.statusCode = 404;
    throw error;
  }

  if (currentRfq.status === 'expired' || (currentRfq.expiresAt && new Date(currentRfq.expiresAt) <= new Date())) {
    const error = new Error('RFQ expired.');
    error.statusCode = 410;
    throw error;
  }

  const categoryContext = await loadCategoryContext();
  const currentDescriptor = buildRfqDescriptor(currentRfq, categoryContext);
  const behaviorProfile = await fetchBehaviorProfile({ userId, context: categoryContext });
  const candidatePool = await fetchCandidatePool({
    current: currentDescriptor,
    excludedIds: new Set([currentDescriptor.id])
  });

  const seen = new Set([currentDescriptor.id]);
  const scored = [];

  candidatePool.forEach((candidateRfq) => {
    const descriptor = buildRfqDescriptor(candidateRfq, categoryContext);
    if (!descriptor.id || seen.has(descriptor.id)) {
      return;
    }
    seen.add(descriptor.id);

    const recommendation = scoreCandidate({
      current: currentDescriptor,
      candidate: descriptor,
      behavior: behaviorProfile
    });

    if (!recommendation) {
      return;
    }

    scored.push({
      rfq: candidateRfq,
      recommendation
    });
  });

  scored.sort((left, right) => {
    if (left.recommendation.stage !== right.recommendation.stage) {
      return left.recommendation.stage - right.recommendation.stage;
    }
    if (left.recommendation.score !== right.recommendation.score) {
      return right.recommendation.score - left.recommendation.score;
    }
    return new Date(right.rfq.createdAt || 0).getTime() - new Date(left.rfq.createdAt || 0).getTime();
  });

  const items = scored.slice(0, Math.max(1, Math.min(Number(limit) || 12, 24))).map((item) => ({
    ...item.rfq,
    recommendation: item.recommendation
  }));

  const stageSummary = items.reduce((acc, item) => {
    const key = `stage${item.recommendation.stage}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    items,
    meta: {
      currentRfqId: currentDescriptor.id,
      behaviorSignalsUsed: behaviorProfile.hasSignals,
      candidateCount: candidatePool.length,
      stageSummary
    }
  };
};
