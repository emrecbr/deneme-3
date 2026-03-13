import AdminAuditLog from '../models/AdminAuditLog.js';

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

const moduleToPrefix = (module) => {
  switch (module) {
    case 'rfq':
      return /^rfq_/;
    case 'user':
      return /^user_/;
    case 'category':
      return /^category_/;
    case 'city':
      return /^city_/;
    case 'district':
      return /^district_/;
    case 'settings':
      return /settings/;
    case 'location':
      return /^location_/;
    case 'auth':
      return /login|logout/;
    case 'content':
      return /^content_/;
    case 'search':
      return /^search_/;
    default:
      return null;
  }
};

export const listAdminAuditLogs = async (req, res, next) => {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const action = String(req.query.action || '').trim();
    const adminId = String(req.query.adminId || '').trim();
    const module = String(req.query.module || '').trim();
    const from = req.query.from;
    const to = req.query.to;

    const match = {};
    if (action) {
      match.action = action;
    }
    if (adminId) {
      match.adminId = adminId;
    }
    if (module) {
      const prefix = moduleToPrefix(module);
      if (prefix) {
        match.action = prefix;
      }
    }
    const range = buildDateRange(from, to);
    if (range) {
      match.createdAt = range;
    }

    const [items, total] = await Promise.all([
      AdminAuditLog.find(match)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AdminAuditLog.countDocuments(match)
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
  } catch (error) {
    return next(error);
  }
};
