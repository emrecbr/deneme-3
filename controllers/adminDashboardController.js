import RFQ from '../models/RFQ.js';
import User from '../models/User.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import { backfillMissingExpiresAt, getListingExpiryDays, markExpiredRfqs } from '../src/utils/rfqExpiry.js';

const STATUS_OPEN = 'open';
const STATUS_CLOSED = 'closed';

export const getDashboardSummary = async (req, res, next) => {
  try {
    const listingExpiryDays = await getListingExpiryDays();
    await backfillMissingExpiresAt(listingExpiryDays);
    await markExpiredRfqs(new Date());

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const baseQuery = { isDeleted: { $ne: true } };

    const [
      rfqTotal,
      rfqLast24,
      userTotal,
      userLast24,
      rfqOpen,
      rfqClosed,
      rfqAwarded,
      moderationCount
    ] = await Promise.all([
      RFQ.countDocuments(baseQuery),
      RFQ.countDocuments({ ...baseQuery, createdAt: { $gte: since } }),
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: since } }),
      RFQ.countDocuments({ ...baseQuery, status: STATUS_OPEN }),
      RFQ.countDocuments({ ...baseQuery, status: STATUS_CLOSED }),
      RFQ.countDocuments({ ...baseQuery, status: 'awarded' }),
      RFQ.countDocuments({ ...baseQuery, status: STATUS_OPEN, moderatedAt: { $exists: false } })
    ]);

    const recentRfqs = await RFQ.find(baseQuery)
      .sort({ createdAt: -1 })
      .limit(6)
      .select('_id title status createdAt city district')
      .lean();

    const moderationQueue = await RFQ.find({ ...baseQuery, status: STATUS_OPEN, moderatedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(6)
      .select('_id title status createdAt city district')
      .lean();

    const audit = await AdminAuditLog.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return res.status(200).json({
      success: true,
      stats: {
        rfqTotal,
        rfqPending: moderationCount,
        rfqActive: rfqOpen,
        rfqPassive: rfqClosed + rfqAwarded,
        userTotal,
        userLast24,
        rfqLast24
      },
      recentRfqs,
      moderationQueue,
      recentAdminActions: audit
    });
  } catch (error) {
    return next(error);
  }
};
