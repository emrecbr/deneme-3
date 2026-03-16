import ModerationRule from '../models/ModerationRule.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import { normalizeText } from '../src/utils/moderation.js';

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

export const listModerationRules = async (req, res, next) => {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const search = normalize(req.query.search || req.query.q);
    const category = normalize(req.query.category);
    const severity = normalize(req.query.severity);
    const source = normalize(req.query.source);
    const isSeeded = req.query.isSeeded;
    const isActive = req.query.isActive;

    const query = {};
    if (search) {
      query.term = new RegExp(search, 'i');
    }
    if (category) {
      query.category = category;
    }
    if (severity) {
      query.severity = severity;
    }
    if (source) {
      query.source = source;
    }
    if (isSeeded !== undefined && isSeeded !== '') {
      query.isSeeded = String(isSeeded).toLowerCase() === 'true';
    }
    if (isActive !== undefined && isActive !== '') {
      query.isActive = String(isActive).toLowerCase() === 'true';
    }

    const [items, total] = await Promise.all([
      ModerationRule.find(query)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ModerationRule.countDocuments(query)
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

export const createModerationRule = async (req, res, next) => {
  try {
    const {
      term,
      category,
      severity,
      isActive,
      notes,
      matchType,
      riskScoreWeight,
      isSeeded,
      source
    } = req.body || {};
    if (!normalize(term)) {
      return res.status(400).json({ success: false, message: 'Kural metni zorunlu.' });
    }
    const normalized = normalizeText(term);
    const rule = await ModerationRule.create({
      term: normalize(term),
      normalizedTerm: normalized.compact,
      category: normalize(category) || 'other',
      severity: normalize(severity) || 'block',
      isActive: typeof isActive === 'boolean' ? isActive : true,
      notes: normalize(notes),
      matchType: normalize(matchType) || 'contains',
      riskScoreWeight: Number.isFinite(Number(riskScoreWeight)) ? Number(riskScoreWeight) : 0,
      isSeeded: Boolean(isSeeded),
      source: normalize(source) || (isSeeded ? 'seeded' : 'manual'),
      createdBy: req.admin?.id || null,
      updatedBy: req.admin?.id || null
    });
    await logAdminAction(req, 'moderation_rule_create', { ruleId: rule._id });
    return res.status(201).json({ success: true, data: rule });
  } catch (error) {
    return next(error);
  }
};

export const updateModerationRule = async (req, res, next) => {
  try {
    const rule = await ModerationRule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Kural bulunamadı.' });
    }
    const {
      term,
      category,
      severity,
      isActive,
      notes,
      matchType,
      riskScoreWeight,
      isSeeded,
      source
    } = req.body || {};
    if (term !== undefined) {
      const normalized = normalizeText(term);
      rule.term = normalize(term);
      rule.normalizedTerm = normalized.compact;
    }
    if (category !== undefined) rule.category = normalize(category);
    if (severity !== undefined) rule.severity = normalize(severity);
    if (matchType !== undefined) rule.matchType = normalize(matchType);
    if (isActive !== undefined) rule.isActive = Boolean(isActive);
    if (notes !== undefined) rule.notes = normalize(notes);
    if (riskScoreWeight !== undefined) {
      rule.riskScoreWeight = Number.isFinite(Number(riskScoreWeight)) ? Number(riskScoreWeight) : 0;
    }
    if (isSeeded !== undefined) rule.isSeeded = Boolean(isSeeded);
    if (source !== undefined) rule.source = normalize(source);
    rule.updatedBy = req.admin?.id || null;
    await rule.save();
    await logAdminAction(req, 'moderation_rule_update', { ruleId: rule._id });
    return res.status(200).json({ success: true, data: rule });
  } catch (error) {
    return next(error);
  }
};

export const deleteModerationRule = async (req, res, next) => {
  try {
    const rule = await ModerationRule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Kural bulunamadı.' });
    }
    await rule.deleteOne();
    await logAdminAction(req, 'moderation_rule_delete', { ruleId: rule._id });
    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
};
