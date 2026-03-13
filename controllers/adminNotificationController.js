import AuthLog from '../models/AuthLog.js';

const parsePage = (value) => Math.max(Number.parseInt(value, 10) || 1, 1);
const parseLimit = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 20;
  return Math.min(Math.max(parsed, 1), 100);
};

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

const listAuthLogs = async (req, res, channel) => {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const status = String(req.query.status || '').trim();
  const event = String(req.query.event || '').trim();
  const target = String(req.query.target || '').trim();
  const from = req.query.from;
  const to = req.query.to;

  const query = { channel };
  if (status) query.status = status;
  if (event) query.event = event;
  if (target) query.target = new RegExp(target, 'i');
  const range = buildDateRange(from, to);
  if (range) query.createdAt = range;

  const [items, total] = await Promise.all([
    AuthLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuthLog.countDocuments(query)
  ]);

  return res.status(200).json({
    success: true,
    items,
    pagination: {
      page,
      limit,
      total,
      hasMore: page * limit < total
    }
  });
};

export const listOtpLogs = async (req, res, next) => {
  try {
    return await listAuthLogs(req, res, 'email');
  } catch (error) {
    return next(error);
  }
};

export const listSmsLogs = async (req, res, next) => {
  try {
    return await listAuthLogs(req, res, 'sms');
  } catch (error) {
    return next(error);
  }
};
