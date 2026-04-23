import {
  computeDashboardSnapshot,
  getStoredDashboardSnapshot,
  isDashboardSnapshotStale,
  queueDashboardSnapshotRefresh
} from '../src/jobs/adminDashboardJob.js';

export const getDashboardSummary = async (req, res, next) => {
  try {
    let snapshot = await getStoredDashboardSnapshot();

    if (!snapshot) {
      snapshot = await computeDashboardSnapshot({ source: 'on-demand-light', runMaintenance: false });
    } else if (isDashboardSnapshotStale(snapshot)) {
      queueDashboardSnapshotRefresh({ source: 'stale-revalidate', runMaintenance: true }).catch(() => null);
    }

    return res.status(200).json({
      ...(snapshot?.data || { success: true, stats: {}, recentRfqs: [], moderationQueue: [], recentAdminActions: [] }),
      computedAt: snapshot?.computedAt || null,
      source: snapshot?.source || 'unknown',
      stale: isDashboardSnapshotStale(snapshot)
    });
  } catch (error) {
    return next(error);
  }
};

export const refreshDashboardSummary = async (req, res, next) => {
  try {
    queueDashboardSnapshotRefresh({
      source: `manual:${req.admin?.id || 'unknown'}`,
      runMaintenance: true
    }).catch(() => null);

    return res.status(202).json({
      success: true,
      message: 'Dashboard summary yenileme islemi kuyruga alindi.'
    });
  } catch (error) {
    return next(error);
  }
};
