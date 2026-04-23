import RFQ from '../../models/RFQ.js';
import User from '../../models/User.js';
import AdminAuditLog from '../../models/AdminAuditLog.js';
import AdminDashboardSnapshot from '../../models/AdminDashboardSnapshot.js';
import { backfillMissingExpiresAt, getListingExpiryDays, markExpiredRfqs } from '../utils/rfqExpiry.js';

const STATUS_OPEN = 'open';
const STATUS_CLOSED = 'closed';
const SNAPSHOT_KEY = 'default';
const DEFAULT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_STALE_MS = 5 * 60 * 1000;

let refreshPromise = null;
let jobTimer = null;

const toPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const getDashboardSnapshotTtlMs = () =>
  toPositiveNumber(process.env.ADMIN_DASHBOARD_SUMMARY_TTL_MS, DEFAULT_STALE_MS);

export const getDashboardSnapshotRefreshMs = () =>
  toPositiveNumber(process.env.ADMIN_DASHBOARD_SUMMARY_REFRESH_MS, DEFAULT_REFRESH_INTERVAL_MS);

const buildDashboardPayload = async () => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const baseQuery = { isDeleted: { $ne: true } };

  const [rfqTotal, rfqLast24, userTotal, userLast24, rfqOpen, rfqClosed, rfqAwarded, moderationCount] =
    await Promise.all([
      RFQ.countDocuments(baseQuery),
      RFQ.countDocuments({ ...baseQuery, createdAt: { $gte: since } }),
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: since } }),
      RFQ.countDocuments({ ...baseQuery, status: STATUS_OPEN }),
      RFQ.countDocuments({ ...baseQuery, status: STATUS_CLOSED }),
      RFQ.countDocuments({ ...baseQuery, status: 'awarded' }),
      RFQ.countDocuments({ ...baseQuery, status: STATUS_OPEN, moderatedAt: { $exists: false } })
    ]);

  const [recentRfqs, moderationQueue, audit] = await Promise.all([
    RFQ.find(baseQuery).sort({ createdAt: -1 }).limit(6).select('_id title status createdAt city district').lean(),
    RFQ.find({ ...baseQuery, status: STATUS_OPEN, moderatedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(6)
      .select('_id title status createdAt city district')
      .lean(),
    AdminAuditLog.find().sort({ createdAt: -1 }).limit(10).lean()
  ]);

  return {
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
  };
};

const persistSnapshot = async (payload, source) => {
  const computedAt = new Date();
  const snapshot = await AdminDashboardSnapshot.findOneAndUpdate(
    { key: SNAPSHOT_KEY },
    {
      $set: {
        data: payload,
        computedAt,
        source
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  ).lean();

  return snapshot;
};

export const getStoredDashboardSnapshot = async () => {
  return AdminDashboardSnapshot.findOne({ key: SNAPSHOT_KEY }).lean();
};

export const isDashboardSnapshotStale = (snapshot) => {
  if (!snapshot?.computedAt) {
    return true;
  }
  return Date.now() - new Date(snapshot.computedAt).getTime() > getDashboardSnapshotTtlMs();
};

export const computeDashboardSnapshot = async ({ source = 'manual', runMaintenance = false } = {}) => {
  if (runMaintenance) {
    const listingExpiryDays = await getListingExpiryDays();
    await backfillMissingExpiresAt(listingExpiryDays);
    await markExpiredRfqs(new Date());
  }

  const payload = await buildDashboardPayload();
  return persistSnapshot(payload, source);
};

export const queueDashboardSnapshotRefresh = ({ source = 'async-refresh', runMaintenance = true } = {}) => {
  if (!refreshPromise) {
    refreshPromise = computeDashboardSnapshot({ source, runMaintenance })
      .catch((error) => {
        console.error('ADMIN_DASHBOARD_REFRESH_FAILED', source, error?.message || error);
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

export const startAdminDashboardJob = () => {
  if (jobTimer) {
    return jobTimer;
  }

  const intervalMs = getDashboardSnapshotRefreshMs();

  queueDashboardSnapshotRefresh({ source: 'startup', runMaintenance: true }).catch(() => null);

  jobTimer = setInterval(() => {
    queueDashboardSnapshotRefresh({ source: 'interval', runMaintenance: true }).catch(() => null);
  }, intervalMs);

  return jobTimer;
};
