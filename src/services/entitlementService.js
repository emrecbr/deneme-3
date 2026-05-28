import UserEntitlement from '../../models/UserEntitlement.js';

const MAX_ENTITLEMENT_HISTORY = 20;

const normalizeQuantity = (value, fallback = 1) => {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number) || number < 0) {
    return fallback;
  }
  return number;
};

export const createEntitlementRecord = async ({
  userId,
  entitlementType,
  source = 'purchase',
  quantity = 1,
  usedQuantity = 0,
  startAt = new Date(),
  expiresAt = null,
  grantedByAdminId = null,
  note = '',
  paymentId = null,
  metadata = {}
}) => {
  if (paymentId) {
    const existing = await UserEntitlement.findOne({ paymentId, entitlementType, source });
    if (existing) return existing;
  }

  return UserEntitlement.create({
    userId,
    entitlementType,
    source,
    quantity: normalizeQuantity(quantity),
    usedQuantity: normalizeQuantity(usedQuantity, 0),
    startAt,
    expiresAt,
    grantedByAdminId,
    note,
    paymentId,
    metadata
  });
};

export const consumeFeaturedEntitlement = async (userId, quantity = 1) => {
  const amount = Math.max(Number.parseInt(quantity, 10) || 1, 1);
  const now = new Date();
  const candidates = await UserEntitlement.find({
    userId,
    entitlementType: 'featured_listing',
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
  }).sort({ expiresAt: 1, createdAt: 1 });

  let remaining = amount;
  for (const entitlement of candidates) {
    if (remaining <= 0) break;
    const available = Math.max(Number(entitlement.quantity || 0) - Number(entitlement.usedQuantity || 0), 0);
    if (available <= 0) continue;
    const used = Math.min(available, remaining);
    entitlement.usedQuantity = Number(entitlement.usedQuantity || 0) + used;
    await entitlement.save();
    remaining -= used;
  }
};

export const revertFeaturedEntitlement = async (userId, quantity = 1) => {
  const amount = Math.max(Number.parseInt(quantity, 10) || 1, 1);
  const candidates = await UserEntitlement.find({
    userId,
    entitlementType: 'featured_listing',
    usedQuantity: { $gt: 0 }
  }).sort({ updatedAt: -1, createdAt: -1 });

  let remaining = amount;
  for (const entitlement of candidates) {
    if (remaining <= 0) break;
    const revertAmount = Math.min(Number(entitlement.usedQuantity || 0), remaining);
    entitlement.usedQuantity = Math.max(Number(entitlement.usedQuantity || 0) - revertAmount, 0);
    await entitlement.save();
    remaining -= revertAmount;
  }
};

export const getUserEntitlementsSummary = async (userId) => {
  const history = await UserEntitlement.find({ userId })
    .sort({ createdAt: -1 })
    .limit(MAX_ENTITLEMENT_HISTORY)
    .populate('grantedByAdminId', 'name email')
    .lean();

  return {
    history,
    latestPremiumGrant:
      history.find((item) => item.entitlementType === 'premium' && item.source === 'admin_grant') || null,
    latestFeaturedGrant:
      history.find((item) => item.entitlementType === 'featured_listing' && item.source === 'admin_grant') || null
  };
};
