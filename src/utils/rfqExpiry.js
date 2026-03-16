import AppSetting from '../../models/AppSetting.js';
import RFQ from '../../models/RFQ.js';
import AdminAuditLog from '../../models/AdminAuditLog.js';

const DEFAULT_LISTING_EXPIRY_DAYS = 30;

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const getListingExpiryDays = async () => {
  try {
    const doc = await AppSetting.findOne({ key: 'listing_expiry_days' }).lean();
    const raw = doc?.value;
    const value = typeof raw === 'object' && raw ? raw.days : raw;
    const parsed = toNumber(value);
    return parsed && parsed > 0 ? parsed : DEFAULT_LISTING_EXPIRY_DAYS;
  } catch (_error) {
    return DEFAULT_LISTING_EXPIRY_DAYS;
  }
};

export const computeExpiresAt = (createdAt, days) => {
  if (!createdAt || !days) return null;
  const base = new Date(createdAt);
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
};

export const applyExpiryFilter = (query, now = new Date()) => {
  const expiryClause = {
    $and: [
      { $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }] },
      { status: { $ne: 'expired' } },
      { isDeleted: { $ne: true } }
    ]
  };
  if (query.$and) {
    query.$and.push(expiryClause);
  } else {
    query.$and = [expiryClause];
  }
  return query;
};

export const markExpiredRfqs = async (now = new Date()) => {
  const result = await RFQ.updateMany(
    {
      status: 'open',
      expiresAt: { $lte: now },
      isDeleted: { $ne: true }
    },
    {
      $set: {
        status: 'expired',
        expiredAt: now,
        statusUpdatedAt: now
      }
    }
  );
  const modified = result?.modifiedCount || result?.nModified || 0;
  if (modified > 0) {
    try {
      await AdminAuditLog.create({
        adminId: null,
        role: 'system',
        action: 'listing_expired',
        meta: { count: modified },
        userAgent: 'system',
        ip: 'system'
      });
    } catch (_err) {
      // ignore
    }
  }
};

export const backfillMissingExpiresAt = async (days) => {
  if (!days) return;
  try {
    await RFQ.updateMany(
      {
        expiresAt: { $exists: false },
        createdAt: { $exists: true },
        isDeleted: { $ne: true }
      },
      [
        {
          $set: {
            expiresAt: {
              $dateAdd: {
                startDate: '$createdAt',
                unit: 'day',
                amount: days
              }
            }
          }
        }
      ]
    );
  } catch (_error) {
    // ignore backfill errors
  }
};
