import mongoose from 'mongoose';
import IssueReport from '../models/IssueReport.js';
import User from '../models/User.js';
import RFQ from '../models/RFQ.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import { sendPushToUser } from '../src/services/pushNotificationService.js';

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
    // ignore audit errors
  }
};

const resolveUserIds = async (value) => {
  const query = normalize(value);
  if (!query) return null;
  if (mongoose.isValidObjectId(query)) {
    return [new mongoose.Types.ObjectId(query)];
  }
  const regex = new RegExp(query, 'i');
  const users = await User.find({ $or: [{ name: regex }, { email: regex }, { phone: regex }] })
    .select('_id')
    .limit(20)
    .lean();
  return users.map((item) => item._id);
};

export const listAdminIssueReports = async (req, res, next) => {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const q = normalize(req.query.q || req.query.search);
    const status = normalize(req.query.status);
    const sourceType = normalize(req.query.sourceType);
    const roleRelation = normalize(req.query.roleRelation);
    const reporter = normalize(req.query.reporter);
    const reported = normalize(req.query.reported);
    const relatedRfq = normalize(req.query.relatedRfqId || req.query.rfqId || req.query.rfq);
    const from = normalize(req.query.from);
    const to = normalize(req.query.to);

    const match = {};
    if (status) match.status = status;
    if (sourceType) match.sourceType = sourceType;
    if (roleRelation) match.roleRelation = roleRelation;
    if (q) {
      match.$or = [{ title: new RegExp(q, 'i') }, { description: new RegExp(q, 'i') }];
    }
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    }
    if (relatedRfq && mongoose.isValidObjectId(relatedRfq)) {
      match.relatedRfqId = new mongoose.Types.ObjectId(relatedRfq);
    }

    if (reporter) {
      const ids = await resolveUserIds(reporter);
      if (!ids || ids.length === 0) {
        return res.status(200).json({
          success: true,
          items: [],
          pagination: { page, limit, total: 0, hasMore: false }
        });
      }
      match.reporterUserId = { $in: ids };
    }
    if (reported) {
      const ids = await resolveUserIds(reported);
      if (!ids || ids.length === 0) {
        return res.status(200).json({
          success: true,
          items: [],
          pagination: { page, limit, total: 0, hasMore: false }
        });
      }
      match.reportedUserId = { $in: ids };
    }

    const [items, total] = await Promise.all([
      IssueReport.find(match)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({ path: 'reporterUserId', select: 'name email phone' })
        .populate({ path: 'reportedUserId', select: 'name email phone' })
        .populate({ path: 'relatedRfqId', select: 'title status buyer' })
        .lean(),
      IssueReport.countDocuments(match)
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

export const getAdminIssueReport = async (req, res, next) => {
  try {
    const report = await IssueReport.findById(req.params.id)
      .populate({ path: 'reporterUserId', select: 'name email phone role' })
      .populate({ path: 'reportedUserId', select: 'name email phone role' })
      .populate({ path: 'relatedRfqId', select: 'title status buyer city district' })
      .lean();

    if (!report) {
      return res.status(404).json({ success: false, message: 'Bildirim bulunamadı.' });
    }

    let source = null;
    if (report.sourceType === 'rfq' && report.sourceId) {
      source = await RFQ.findById(report.sourceId).select('title status buyer city district').lean();
    }
    if (report.sourceType === 'profile' && report.sourceId) {
      source = await User.findById(report.sourceId).select('name email phone role').lean();
    }

    return res.status(200).json({ success: true, data: report, source });
  } catch (error) {
    return next(error);
  }
};

export const updateAdminIssueReportStatus = async (req, res, next) => {
  try {
    const nextStatus = normalize(req.body?.status);
    const allowed = new Set(['new', 'under_review', 'resolved', 'rejected', 'closed']);
    if (!allowed.has(nextStatus)) {
      return res.status(400).json({ success: false, message: 'Durum geçersiz.' });
    }

    const report = await IssueReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Bildirim bulunamadı.' });
    }

    report.status = nextStatus;
    report.statusHistory.push({ status: nextStatus, adminId: req.admin?.id || null });
    await report.save();

    await logAdminAction(req, 'report_status_update', {
      reportId: report._id,
      status: nextStatus
    });

    if (nextStatus === 'resolved' && report.reporterUserId) {
      await sendPushToUser({
        userId: report.reporterUserId,
        type: 'report_resolved',
        payload: {
          reportId: report._id.toString(),
          sourceType: report.sourceType,
          sourceId: report.sourceId
        }
      });
    }

    return res.status(200).json({ success: true, data: report });
  } catch (error) {
    return next(error);
  }
};

export const addAdminIssueReportNote = async (req, res, next) => {
  try {
    const note = normalize(req.body?.note);
    if (!note) {
      return res.status(400).json({ success: false, message: 'Not gerekli.' });
    }

    const report = await IssueReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Bildirim bulunamadı.' });
    }

    report.adminNotes.push({ note, adminId: req.admin?.id || null });
    await report.save();

    await logAdminAction(req, 'report_note_add', {
      reportId: report._id
    });

    return res.status(201).json({ success: true, data: report.adminNotes.at(-1) });
  } catch (error) {
    return next(error);
  }
};
