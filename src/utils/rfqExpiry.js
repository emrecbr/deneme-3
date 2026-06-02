import AppSetting from '../../models/AppSetting.js';
import RFQ from '../../models/RFQ.js';
import AdminAuditLog from '../../models/AdminAuditLog.js';
import Notification from '../../models/Notification.js';
import { emitToRoom } from '../../config/socket.js';

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

const isValidDateValue = (value) => {
  if (!value) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime());
};

const notifyExpiringRfqs = async (now = new Date()) => {
  const soon = new Date(new Date(now).getTime() + 24 * 60 * 60 * 1000);
  const rfqs = await RFQ.find({
    status: 'open',
    isDeleted: { $ne: true },
    $or: [
      { expiresAt: { $gt: now, $lte: soon } },
      { deadline: { $gt: now, $lte: soon } }
    ]
  })
    .select('_id title buyer')
    .limit(200)
    .lean();

  await Promise.all(
    rfqs.map(async (rfq) => {
      if (!rfq?.buyer) return;
      const existing = await Notification.exists({
        user: rfq.buyer,
        type: 'listing_expiring',
        relatedId: rfq._id
      });
      if (existing) return;
      const notification = await Notification.create({
        user: rfq.buyer,
        title: 'Talebinizin süresi dolmak üzere',
        body: 'Talebinizin yayından kalkmasına kısa süre kaldı.',
        message: 'Talebinizin yayından kalkmasına kısa süre kaldı.',
        type: 'listing_expiring',
        relatedId: rfq._id,
        data: { rfqId: rfq._id },
        targetType: 'rfq',
        targetId: rfq._id,
        targetUrl: `/rfq/${rfq._id}`
      });
      emitToRoom(`user:${String(rfq.buyer)}`, 'notification:new', {
        notificationId: notification._id.toString(),
        type: 'listing_expiring',
        rfqId: rfq._id.toString()
      });
    })
  );
};

export const isRfqExpired = (rfq, now = new Date()) => {
  if (!rfq) return false;
  if (rfq.status === 'expired') return true;
  const nowTime = new Date(now).getTime();
  if (!Number.isFinite(nowTime)) return false;

  return [rfq.expiresAt, rfq.deadline].some((value) => {
    if (!isValidDateValue(value)) return false;
    return new Date(value).getTime() <= nowTime;
  });
};

export const applyExpiryFilter = (query, now = new Date()) => {
  const expiryClause = {
    $and: [
      { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }] },
      { $or: [{ deadline: { $exists: false } }, { deadline: null }, { deadline: { $gt: now } }] },
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
  await notifyExpiringRfqs(now);
  const result = await RFQ.updateMany(
    {
      status: 'open',
      $or: [
        { expiresAt: { $lte: now } },
        { deadline: { $lte: now } }
      ],
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
