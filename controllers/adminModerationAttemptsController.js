import mongoose from 'mongoose';
import ModerationAttempt from '../models/ModerationAttempt.js';
import AdminAuditLog from '../models/AdminAuditLog.js';

const normalize = (value) => String(value || '').trim();
const parsePage = (value) => Math.max(Number.parseInt(value, 10) || 1, 1);
const parseLimit = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 20;
  return Math.min(Math.max(parsed, 1), 100);
};

const logAdminAction = async (req, action, meta = {}) => {
  try {
    await AdminAuditLog.create({
      adminId: req.admin?.id || null,
      role: req.admin?.role || null,
      action,
      ip: req.headers['x-forwarded-for'] || req.ip,
      userAgent: req.headers['user-agent'] || '',
      meta
    });
  } catch (_error) {
    // ignore
  }
};

export const listModerationAttempts = async (req, res, next) => {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const status = normalize(req.query.status);
    const contentType = normalize(req.query.contentType);
    const userId = normalize(req.query.userId);
    const search = normalize(req.query.search || req.query.q);
    const startDate = normalize(req.query.startDate);
    const endDate = normalize(req.query.endDate);

    const query = {};
    if (status) query.status = status;
    if (contentType) query.contentType = contentType;
    if (userId && mongoose.isValidObjectId(userId)) query.user = userId;
    if (search) {
      query.$or = [
        { attemptedTitle: new RegExp(search, 'i') },
        { attemptedDescription: new RegExp(search, 'i') },
        { matchedTerms: new RegExp(search, 'i') }
      ];
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      ModerationAttempt.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('user', 'name email phone')
        .lean(),
      ModerationAttempt.countDocuments(query)
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

export const getModerationAttempt = async (req, res, next) => {
  try {
    const attempt = await ModerationAttempt.findById(req.params.id)
      .populate('user', 'name email phone')
      .lean();
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Kayıt bulunamadı.' });
    }
    const userId = attempt.user?._id || attempt.user;
    const stats = userId
      ? await ModerationAttempt.aggregate([
          { $match: { user: mongoose.Types.ObjectId(userId) } },
          {
            $group: {
              _id: '$user',
              total: { $sum: 1 },
              blocked: {
                $sum: {
                  $cond: [{ $eq: ['$status', 'blocked'] }, 1, 0]
                }
              },
              lastAttempt: { $max: '$createdAt' }
            }
          }
        ])
      : [];

    return res.status(200).json({
      success: true,
      data: attempt,
      userStats: stats?.[0] || null
    });
  } catch (error) {
    return next(error);
  }
};

export const updateModerationAttempt = async (req, res, next) => {
  try {
    const { status, adminNotes } = req.body || {};
    const attempt = await ModerationAttempt.findById(req.params.id);
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Kayıt bulunamadı.' });
    }
    if (status) attempt.status = status;
    if (adminNotes !== undefined) attempt.adminNotes = normalize(adminNotes);
    await attempt.save();
    await logAdminAction(req, 'moderation_attempt_review', { attemptId: attempt._id, status: attempt.status });
    return res.status(200).json({ success: true, data: attempt });
  } catch (error) {
    return next(error);
  }
};

export const listModerationRiskUsers = async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const items = await ModerationAttempt.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: '$user',
          total: { $sum: 1 },
          blocked: { $sum: { $cond: [{ $eq: ['$decision', 'block'] }, 1, 0] } },
          review: { $sum: { $cond: [{ $eq: ['$decision', 'review'] }, 1, 0] } },
          lastAttempt: { $max: '$createdAt' },
          matchedTerms: { $push: '$matchedTerms' }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 50 }
    ]);

    const userIds = items.map((item) => item._id).filter(Boolean);
    const users = await mongoose.model('User').find({ _id: { $in: userIds } }).select('name email phone').lean();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const data = items.map((item) => {
      const user = item._id ? userMap.get(item._id.toString()) : null;
      const flatTerms = (item.matchedTerms || []).flat().filter(Boolean);
      const topTerms = Array.from(new Set(flatTerms)).slice(0, 5);
      return {
        userId: item._id,
        user,
        total: item.total,
        blocked: item.blocked,
        review: item.review,
        lastAttempt: item.lastAttempt,
        topTerms
      };
    });

    return res.status(200).json({ success: true, items: data });
  } catch (error) {
    return next(error);
  }
};
