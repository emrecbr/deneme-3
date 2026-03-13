import RfqFlowEvent from '../models/RfqFlowEvent.js';

const buildDateRange = (from, to) => {
  const range = {};
  if (from) {
    const start = new Date(from);
    if (!Number.isNaN(start.getTime())) range.$gte = start;
  }
  if (to) {
    const end = new Date(to);
    if (!Number.isNaN(end.getTime())) range.$lte = end;
  }
  return Object.keys(range).length ? range : null;
};

export const getRfqFlowSteps = async (req, res, next) => {
  try {
    const from = req.query.from;
    const to = req.query.to;
    const range = buildDateRange(from, to);
    const match = {};
    if (range) match.createdAt = range;

    const stats = await RfqFlowEvent.aggregate([
      { $match: match },
      { $group: { _id: { step: '$step', event: '$event' }, count: { $sum: 1 } } }
    ]);

    const stepMap = new Map();
    stats.forEach((item) => {
      const stepKey = String(item._id.step);
      if (!stepMap.has(stepKey)) {
        stepMap.set(stepKey, { step: item._id.step, views: 0, completes: 0, blocked: 0 });
      }
      const target = stepMap.get(stepKey);
      if (item._id.event === 'step_view') target.views += item.count;
      if (item._id.event === 'step_complete') target.completes += item.count;
      if (item._id.event === 'step_blocked') target.blocked += item.count;
    });

    return res.status(200).json({
      success: true,
      items: Array.from(stepMap.values()).sort((a, b) => a.step - b.step)
    });
  } catch (error) {
    return next(error);
  }
};

export const getRfqValidationAnalytics = async (req, res, next) => {
  try {
    const from = req.query.from;
    const to = req.query.to;
    const range = buildDateRange(from, to);
    const match = { event: 'step_blocked' };
    if (range) match.createdAt = range;

    const stats = await RfqFlowEvent.aggregate([
      { $match: match },
      { $group: { _id: { step: '$step', field: '$field', error: '$error' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 50 }
    ]);

    const items = stats.map((item) => ({
      step: item._id.step,
      field: item._id.field || 'unknown',
      error: item._id.error || 'Bilinmeyen hata',
      count: item.count
    }));

    return res.status(200).json({ success: true, items });
  } catch (error) {
    return next(error);
  }
};
