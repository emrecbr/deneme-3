import User from '../../models/User.js';
import AdminAuditLog from '../../models/AdminAuditLog.js';
import {
  consumeListingQuota,
  getListingQuotaSettings,
  getListingQuotaSnapshot,
  revertListingQuota
} from '../utils/listingQuota.js';
import { consumeFeaturedEntitlement, revertFeaturedEntitlement } from './entitlementService.js';

const FEATURED_DURATION_DAYS = 7;
const dayMs = 24 * 60 * 60 * 1000;

export const PUBLISHING_RIGHTS = {
  PREMIUM: 'premium',
  FEATURED: 'featured_listing',
  PAID_LISTING: 'paid_listing',
  FREE_LISTING: 'free_listing',
  STANDARD: 'standard'
};

const isPremiumActive = (user, now = new Date()) =>
  Boolean(user?.isPremium && (!user.premiumUntil || new Date(user.premiumUntil) > now));

const buildSummary = (user, settings, now = new Date()) => {
  const quota = getListingQuotaSnapshot(user, settings, now);
  const premiumActive = isPremiumActive(user, now);
  const featuredCredits = Number(user?.featuredCredits || 0);
  const paidListingCredits = Number(quota.paidListingCredits || 0);
  const freeListingCredits = Number(quota.remainingFree || 0);
  const rights = [
    {
      key: PUBLISHING_RIGHTS.PREMIUM,
      available: premiumActive,
      remaining: premiumActive ? 1 : 0,
      expiresAt: user?.premiumUntil || null
    },
    {
      key: PUBLISHING_RIGHTS.FEATURED,
      available: featuredCredits > 0,
      remaining: featuredCredits,
      expiresAt: null
    },
    {
      key: PUBLISHING_RIGHTS.PAID_LISTING,
      available: paidListingCredits > 0,
      remaining: paidListingCredits,
      expiresAt: null
    },
    {
      key: PUBLISHING_RIGHTS.FREE_LISTING,
      available: freeListingCredits > 0,
      remaining: freeListingCredits,
      expiresAt: quota.windowEnd || null
    },
    {
      key: PUBLISHING_RIGHTS.STANDARD,
      available: true,
      remaining: 1,
      expiresAt: null
    }
  ];

  return {
    selected: rights.find((right) => right.available) || rights[rights.length - 1],
    rights,
    quota,
    counts: {
      premium: premiumActive ? 1 : 0,
      featured: featuredCredits,
      paidListing: paidListingCredits,
      freeListing: freeListingCredits
    }
  };
};

export const getPublishingRightsSummary = async (userId, settings = null) => {
  const config = settings || (await getListingQuotaSettings());
  const user = await User.findById(userId).lean();
  if (!user) {
    return null;
  }
  return buildSummary(user, config);
};

export const consumePublishingRight = async ({ userId, requestedRight, settings = null }) => {
  const config = settings || (await getListingQuotaSettings());
  const user = await User.findById(userId);
  if (!user) {
    return { ok: false, status: 404, code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı.' };
  }

  const summary = buildSummary(user, config);
  const selectedKey = summary.selected?.key || PUBLISHING_RIGHTS.STANDARD;
  const requestedKey = String(requestedRight || selectedKey).trim();

  if (requestedKey && requestedKey !== selectedKey) {
    return {
      ok: false,
      status: 409,
      code: 'PUBLISHING_RIGHT_CHANGED',
      message: 'Yayın hakkı değişti. Lütfen son adımı yenileyip tekrar dene.',
      data: summary
    };
  }

  if (selectedKey === PUBLISHING_RIGHTS.FEATURED) {
    const featureUntil = new Date(Date.now() + FEATURED_DURATION_DAYS * dayMs);
    user.featuredCredits = Math.max(Number(user.featuredCredits || 0) - 1, 0);
    await user.save();
    await consumeFeaturedEntitlement(user._id, 1);
    return {
      ok: true,
      right: selectedKey,
      userId: user._id,
      featureUntil,
      featuredConsumed: true
    };
  }

  if (selectedKey === PUBLISHING_RIGHTS.PAID_LISTING || selectedKey === PUBLISHING_RIGHTS.FREE_LISTING) {
    const quotaResult = await consumeListingQuota({
      userId,
      settings: config,
      preferredMode: selectedKey === PUBLISHING_RIGHTS.PAID_LISTING ? 'paid' : 'free'
    });
    if (!quotaResult.ok) {
      return {
        ok: false,
        status: 402,
        code: 'LISTING_QUOTA_REACHED',
        message: 'Bu dönem için uygun ilan hakkı bulunamadı.',
        data: buildSummary(await User.findById(userId).lean(), config)
      };
    }
    return {
      ok: true,
      right: selectedKey,
      quotaConsumption: quotaResult
    };
  }

  return {
    ok: true,
    right: selectedKey
  };
};

export const revertPublishingRightConsumption = async ({ userId, consumption }) => {
  if (!userId || !consumption) return;
  if (consumption.quotaConsumption?.mode) {
    await revertListingQuota({
      userId,
      mode: consumption.quotaConsumption.mode,
      windowStarted: consumption.quotaConsumption.windowStarted
    });
  }
  if (consumption.featuredConsumed) {
    await User.findByIdAndUpdate(userId, { $inc: { featuredCredits: 1 } });
    await revertFeaturedEntitlement(userId, 1);
  }
};

export const logPublishingRightUsage = async ({ userId, rfqId, consumption }) => {
  if (!consumption?.right || consumption.right === PUBLISHING_RIGHTS.STANDARD) return;
  try {
    await AdminAuditLog.create({
      adminId: null,
      role: 'system',
      action: 'rfq_publishing_right_used',
      meta: {
        userId,
        rfqId,
        right: consumption.right
      }
    });
  } catch (_error) {
    // ignore audit errors
  }
};
