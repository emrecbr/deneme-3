import ChatReport from '../models/ChatReport.js';
import AdminAuditLog from '../models/AdminAuditLog.js';

const normalize = (value) => String(value || '').trim();
const parsePage = (value) => Math.max(Number.parseInt(value, 10) || 1, 1);
const parseLimit = (value) => Math.min(Math.max(Number.parseInt(value, 10) || 20, 1), 100);
const ALLOWED_STATUSES = new Set(['open', 'reviewed', 'dismissed', 'action_taken']);

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
    // audit errors should not block moderation actions
  }
};

export const listAdminChatReports = async (req, res, next) => {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const status = normalize(req.query.status);
    const reason = normalize(req.query.reason);

    const match = {};
    if (status) match.status = status;
    if (reason) match.reason = reason;

    const [items, total] = await Promise.all([
      ChatReport.find(match)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({ path: 'reporterId', select: 'name email phone' })
        .populate({ path: 'reportedUserId', select: 'name email phone' })
        .populate({ path: 'chatId', select: 'lastMessage status rfq' })
        .populate({ path: 'messageId', select: 'content sender createdAt' })
        .populate({ path: 'rfqId', select: 'title status' })
        .lean(),
      ChatReport.countDocuments(match)
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

export const updateAdminChatReport = async (req, res, next) => {
  try {
    const status = normalize(req.body?.status);
    if (!ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({ success: false, message: 'Durum geçersiz.' });
    }

    const report = await ChatReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Chat şikayeti bulunamadı.' });
    }

    report.status = status;
    report.reviewedBy = req.admin?.id || undefined;
    report.reviewedAt = new Date();
    await report.save();

    await logAdminAction(req, 'chat_report_review', {
      reportId: report._id,
      status
    });

    return res.status(200).json({ success: true, data: report });
  } catch (error) {
    return next(error);
  }
};
