import mongoose from 'mongoose';
import IssueReport from '../models/IssueReport.js';
import RFQ from '../models/RFQ.js';
import User from '../models/User.js';

const normalize = (value) => String(value || '').trim();

const resolveUserId = (value) => (mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null);

export const createIssueReport = async (req, res, next) => {
  try {
    const reporterId = req.user?.id;
    if (!reporterId) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    const title = normalize(req.body?.title);
    const description = normalize(req.body?.description);
    const category = normalize(req.body?.category);
    const sourceType = normalize(req.body?.sourceType);
    const sourceIdRaw = req.body?.sourceId;
    const relatedRfqIdRaw = req.body?.relatedRfqId;
    const reportedUserIdRaw = req.body?.reportedUserId;
    const roleRelation = normalize(req.body?.roleRelation) || 'other';

    if (!title || title.length < 3) {
      return res.status(400).json({ success: false, message: 'Başlık en az 3 karakter olmalı.' });
    }
    if (!description || description.length < 10) {
      return res.status(400).json({ success: false, message: 'Açıklama en az 10 karakter olmalı.' });
    }
    if (!['rfq', 'profile'].includes(sourceType)) {
      return res.status(400).json({ success: false, message: 'Kaynak tipi geçersiz.' });
    }

    const sourceId = resolveUserId(sourceIdRaw);
    const relatedRfqId = resolveUserId(relatedRfqIdRaw);
    let reportedUserId = resolveUserId(reportedUserIdRaw);

    if (sourceType === 'rfq') {
      const targetRfqId = relatedRfqId || sourceId;
      if (!targetRfqId) {
        return res.status(400).json({ success: false, message: 'RFQ bilgisi gerekli.' });
      }
      const rfq = await RFQ.findById(targetRfqId).select('buyer').lean();
      if (!rfq) {
        return res.status(404).json({ success: false, message: 'RFQ bulunamadı.' });
      }
      if (rfq?.buyer && !reportedUserId) {
        reportedUserId = rfq.buyer;
      }
    }

    if (sourceType === 'profile') {
      if (!sourceId) {
        return res.status(400).json({ success: false, message: 'Profil bilgisi gerekli.' });
      }
      const targetUser = await User.findById(sourceId).select('_id').lean();
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'Profil bulunamadı.' });
      }
      if (!reportedUserId && String(sourceId) !== String(reporterId)) {
        reportedUserId = sourceId;
      }
    }

    if (reportedUserId && String(reportedUserId) === String(reporterId)) {
      return res.status(400).json({ success: false, message: 'Kendini şikayet edemezsin.' });
    }

    const report = await IssueReport.create({
      reporterUserId: reporterId,
      reportedUserId: reportedUserId || undefined,
      relatedRfqId: relatedRfqId || undefined,
      sourceType,
      sourceId: sourceId || relatedRfqId || undefined,
      roleRelation,
      category: category || undefined,
      title,
      description
    });

    return res.status(201).json({ success: true, data: report });
  } catch (error) {
    return next(error);
  }
};

export const listMyReports = async (req, res, next) => {
  try {
    const reporterId = req.user?.id;
    if (!reporterId) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }
    const items = await IssueReport.find({ reporterUserId: reporterId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return res.status(200).json({ success: true, items });
  } catch (error) {
    return next(error);
  }
};
