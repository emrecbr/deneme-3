import AppSetting from '../../models/AppSetting.js';
import User from '../../models/User.js';
import AdminAuditLog from '../../models/AdminAuditLog.js';

const DEFAULT_SETTINGS = {
  periodDays: 30,
  maxFree: 5,
  extraPrice: 99,
  currency: 'TRY',
  extraEnabled: true,
  paymentMethodSetupEnabled: true,
  paymentMethodSetupPrice: 1
};

const dayMs = 24 * 60 * 60 * 1000;

const getSetting = async (key, fallback) => {
  const doc = await AppSetting.findOne({ key }).lean();
  return doc?.value ?? fallback;
};

export const getListingQuotaSettings = async () => {
  const raw = await getSetting('listing_quota_settings', DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(raw || {}) };
};

export const computeWindowEnd = (start, periodDays) => {
  const base = new Date(start);
  return new Date(base.getTime() + Number(periodDays || 0) * dayMs);
};

export const getListingQuotaSnapshot = (user, settings, now = new Date()) => {
  const maxFree = Number(settings?.maxFree || DEFAULT_SETTINGS.maxFree);
  const periodDays = Number(settings?.periodDays || DEFAULT_SETTINGS.periodDays);
  const windowStart = user?.listingQuotaWindowStart ? new Date(user.listingQuotaWindowStart) : null;
  const windowEnd = user?.listingQuotaWindowEnd ? new Date(user.listingQuotaWindowEnd) : null;
  const windowActive = Boolean(windowStart && windowEnd && windowEnd > now);
  const usedFree = windowActive ? Number(user?.listingQuotaUsedFree || 0) : 0;
  const remainingFree = Math.max(maxFree - usedFree, 0);
  return {
    periodDays,
    maxFree,
    usedFree,
    remainingFree,
    windowStart: windowActive ? windowStart : null,
    windowEnd: windowActive ? windowEnd : null,
    paidListingCredits: Number(user?.paidListingCredits || 0),
    extraPrice: Number(settings?.extraPrice || DEFAULT_SETTINGS.extraPrice),
    currency: settings?.currency || DEFAULT_SETTINGS.currency,
    extraEnabled: Boolean(settings?.extraEnabled ?? DEFAULT_SETTINGS.extraEnabled)
  };
};

const logQuotaAction = async (action, meta = {}) => {
  try {
    await AdminAuditLog.create({
      adminId: null,
      role: 'system',
      action,
      meta
    });
  } catch (_error) {
    // ignore audit errors
  }
};

export const consumeListingQuota = async ({ userId, settings }) => {
  const now = new Date();
  const config = settings || (await getListingQuotaSettings());
  const maxFree = Number(config.maxFree || DEFAULT_SETTINGS.maxFree);
  const periodDays = Number(config.periodDays || DEFAULT_SETTINGS.periodDays);

  const user = await User.findById(userId);
  if (!user) {
    return { ok: false, reason: 'user_not_found' };
  }

  const windowStart = user.listingQuotaWindowStart;
  const windowEnd = user.listingQuotaWindowEnd;
  const windowActive = Boolean(windowStart && windowEnd && windowEnd > now);
  const windowStarted = !windowActive;

  if (!windowActive) {
    user.listingQuotaWindowStart = now;
    user.listingQuotaWindowEnd = computeWindowEnd(now, periodDays);
    user.listingQuotaUsedFree = 0;
    await logQuotaAction('listing_quota_reset', {
      userId,
      windowStart: user.listingQuotaWindowStart,
      windowEnd: user.listingQuotaWindowEnd
    });
  }

  const usedFree = Number(user.listingQuotaUsedFree || 0);
  if (usedFree < maxFree) {
    user.listingQuotaUsedFree = usedFree + 1;
    await user.save();
    return {
      ok: true,
      mode: 'free',
      windowStarted,
      windowStart: user.listingQuotaWindowStart,
      windowEnd: user.listingQuotaWindowEnd,
      remainingFree: Math.max(maxFree - user.listingQuotaUsedFree, 0),
      paidListingCredits: Number(user.paidListingCredits || 0)
    };
  }

  if (config.extraEnabled && Number(user.paidListingCredits || 0) > 0) {
    user.paidListingCredits = Math.max(Number(user.paidListingCredits || 0) - 1, 0);
    await user.save();
    return {
      ok: true,
      mode: 'paid',
      windowStarted,
      windowStart: user.listingQuotaWindowStart,
      windowEnd: user.listingQuotaWindowEnd,
      remainingFree: 0,
      paidListingCredits: Number(user.paidListingCredits || 0)
    };
  }

  await logQuotaAction('listing_quota_limit_reached', {
    userId,
    maxFree,
    paidCredits: Number(user.paidListingCredits || 0)
  });

  return {
    ok: false,
    reason: 'limit_reached',
    windowStart: user.listingQuotaWindowStart,
    windowEnd: user.listingQuotaWindowEnd,
    remainingFree: 0,
    paidListingCredits: Number(user.paidListingCredits || 0)
  };
};

export const revertListingQuota = async ({ userId, mode, windowStarted }) => {
  if (!userId || !mode) {
    return;
  }
  if (mode === 'free') {
    const user = await User.findById(userId).select('listingQuotaUsedFree listingQuotaWindowStart listingQuotaWindowEnd');
    if (!user) return;
    const next = Math.max(Number(user.listingQuotaUsedFree || 0) - 1, 0);
    user.listingQuotaUsedFree = next;
    if (windowStarted && next === 0) {
      user.listingQuotaWindowStart = null;
      user.listingQuotaWindowEnd = null;
    }
    await user.save();
    return;
  }
  if (mode === 'paid') {
    await User.findByIdAndUpdate(userId, { $inc: { paidListingCredits: 1 } });
  }
};
