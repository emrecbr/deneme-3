import mongoose from 'mongoose';
import Category from '../models/Category.js';
import RFQ from '../models/RFQ.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import SearchSuggestion from '../models/SearchSuggestion.js';

const ALLOWED_SEGMENTS = new Set(['goods', 'service', 'auto', 'jobseeker']);
const normalize = (value) => String(value || '').trim();
const normalizeSegment = (value) => String(value || '').trim().toLowerCase();
const slugify = (value) =>
  normalize(value)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const parsePage = (value) => Math.max(Number.parseInt(value, 10) || 1, 1);
const parseLimit = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 20;
  return Math.min(Math.max(parsed, 1), 100);
};

const syncCategoryKinds = async (ids = []) => {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean).map((item) => String(item))));
  for (const id of uniqueIds) {
    if (!mongoose.isValidObjectId(id)) continue;
    const category = await Category.findById(id).select('_id parent').lean();
    if (!category?._id) continue;
    const hasChildren = await Category.exists({ parent: category._id });
    const kind = !category.parent ? 'root' : hasChildren ? 'branch' : 'leaf';
    await Category.findByIdAndUpdate(category._id, { $set: { kind } });
  }
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

export const listAdminCategories = async (req, res, next) => {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    const parent = normalize(req.query.parent);
    const search = normalize(req.query.search || req.query.q);
    const segment = normalizeSegment(req.query.segment);

    const query = {};
    if (!includeInactive) {
      query.isActive = { $ne: false };
    }
    if (segment) {
      if (!ALLOWED_SEGMENTS.has(segment)) {
        return res.status(400).json({ success: false, message: 'Geçersiz segment.' });
      }
      query.segment = segment;
    }
    if (parent) {
      if (parent === 'any') {
        query.parent = { $ne: null };
      } else if (parent === 'none') {
        query.parent = null;
      } else {
        query.parent = mongoose.isValidObjectId(parent) ? parent : null;
      }
    }
    if (search) {
      query.name = new RegExp(search, 'i');
    }

    const [items, total] = await Promise.all([
      Category.find(query)
        .sort({ order: 1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Category.countDocuments(query)
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

export const createAdminCategory = async (req, res, next) => {
  try {
    const { name, slug, parent, order, isActive, segment } = req.body || {};
    if (!normalize(name)) {
      return res.status(400).json({ success: false, message: 'Kategori adı zorunlu.' });
    }
    const normalizedSegment = normalizeSegment(segment);
    if (normalizedSegment && !ALLOWED_SEGMENTS.has(normalizedSegment)) {
      return res.status(400).json({ success: false, message: 'Geçersiz segment.' });
    }

    let resolvedParent = null;
    let resolvedSegment = normalizedSegment || undefined;
    let resolvedLevel = 0;
    let resolvedKind = 'root';
    if (parent && mongoose.isValidObjectId(parent)) {
      const parentDoc = await Category.findById(parent).select('_id segment level').lean();
      if (!parentDoc?._id) {
        return res.status(404).json({ success: false, message: 'Parent kategori bulunamadı.' });
      }
      resolvedParent = parentDoc._id;
      const parentSegment = normalizeSegment(parentDoc.segment);
      if (normalizedSegment && parentSegment && normalizedSegment !== parentSegment) {
        return res.status(400).json({ success: false, message: 'Parent kategori ile segment uyuşmuyor.' });
      }
      resolvedSegment = resolvedSegment || parentSegment || undefined;
      resolvedLevel = Number(parentDoc.level || 0) + 1;
      resolvedKind = 'leaf';
    }

    const payload = {
      name: normalize(name),
      slug: normalize(slug) || slugify(name),
      parent: resolvedParent,
      segment: resolvedSegment,
      level: resolvedLevel,
      kind: resolvedKind,
      order: Number.isFinite(Number(order)) ? Number(order) : 0,
      isActive: typeof isActive === 'boolean' ? isActive : true
    };

    const category = await Category.create(payload);
    await syncCategoryKinds([category._id, resolvedParent]);
    await logAdminAction(req, 'category_create', { categoryId: category._id });
    return res.status(201).json({ success: true, data: category });
  } catch (error) {
    return next(error);
  }
};

export const updateAdminCategory = async (req, res, next) => {
  try {
    const { name, slug, parent, order, isActive, segment } = req.body || {};
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Kategori bulunamadı.' });
    }

    const normalizedSegment = segment !== undefined ? normalizeSegment(segment) : undefined;
    if (normalizedSegment && !ALLOWED_SEGMENTS.has(normalizedSegment)) {
      return res.status(400).json({ success: false, message: 'Geçersiz segment.' });
    }

    let relatedParentId = category.parent ? String(category.parent) : null;
    if (name !== undefined) category.name = normalize(name);
    if (slug !== undefined) category.slug = normalize(slug) || slugify(category.name);
    if (parent !== undefined) {
      if (parent && mongoose.isValidObjectId(parent)) {
        const parentDoc = await Category.findById(parent).select('_id segment level').lean();
        if (!parentDoc?._id) {
          return res.status(404).json({ success: false, message: 'Parent kategori bulunamadı.' });
        }
        const parentSegment = normalizeSegment(parentDoc.segment);
        const effectiveSegment = normalizedSegment !== undefined ? normalizedSegment : normalizeSegment(category.segment);
        if (effectiveSegment && parentSegment && effectiveSegment !== parentSegment) {
          return res.status(400).json({ success: false, message: 'Parent kategori ile segment uyuşmuyor.' });
        }
        category.parent = parentDoc._id;
        category.level = Number(parentDoc.level || 0) + 1;
        relatedParentId = String(parentDoc._id);
        if (!normalizedSegment && parentSegment) {
          category.segment = parentSegment;
        }
      } else {
        category.parent = null;
        category.level = 0;
        relatedParentId = null;
      }
    }
    if (order !== undefined) category.order = Number(order) || 0;
    if (isActive !== undefined) category.isActive = Boolean(isActive);
    if (normalizedSegment !== undefined) {
      category.segment = normalizedSegment || undefined;
    }

    await category.save();
    await syncCategoryKinds([category._id, relatedParentId]);
    await logAdminAction(req, 'category_update', { categoryId: category._id });
    return res.status(200).json({ success: true, data: category });
  } catch (error) {
    return next(error);
  }
};

export const listCategoryIssues = async (req, res, next) => {
  try {
    const categories = await Category.find().select('_id parent name').lean();
    const categoryIds = new Set(categories.map((item) => String(item._id)));

    const parentIssues = categories
      .filter((item) => item.parent && !categoryIds.has(String(item.parent)))
      .map((item) => ({
        type: 'missing_parent',
        categoryId: item._id,
        name: item.name,
        parentId: item.parent
      }));

    const rfqIssues = await RFQ.find({ category: { $type: 'string' } })
      .select('_id title category createdAt')
      .limit(50)
      .lean();

    return res.status(200).json({
      success: true,
      issues: {
        parentIssues,
        rfqCategoryIssues: rfqIssues
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const listSearchSuggestions = async (req, res, next) => {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    const search = normalize(req.query.search || req.query.q);

    const query = {};
    if (!includeInactive) query.isActive = { $ne: false };
    if (search) query.term = new RegExp(search, 'i');

    const [items, total] = await Promise.all([
      SearchSuggestion.find(query)
        .populate('category', 'name parent')
        .sort({ order: 1, term: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SearchSuggestion.countDocuments(query)
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

export const createSearchSuggestion = async (req, res, next) => {
  try {
    const { term, categoryId, order, isActive } = req.body || {};
    if (!normalize(term)) {
      return res.status(400).json({ success: false, message: 'Terim zorunlu.' });
    }
    const payload = {
      term: normalize(term),
      category: categoryId && mongoose.isValidObjectId(categoryId) ? categoryId : undefined,
      order: Number.isFinite(Number(order)) ? Number(order) : 0,
      isActive: typeof isActive === 'boolean' ? isActive : true
    };
    const suggestion = await SearchSuggestion.create(payload);
    await logAdminAction(req, 'search_suggestion_create', { suggestionId: suggestion._id });
    return res.status(201).json({ success: true, data: suggestion });
  } catch (error) {
    return next(error);
  }
};

export const updateSearchSuggestion = async (req, res, next) => {
  try {
    const { term, categoryId, order, isActive } = req.body || {};
    const suggestion = await SearchSuggestion.findById(req.params.id);
    if (!suggestion) {
      return res.status(404).json({ success: false, message: 'Öneri bulunamadı.' });
    }

    if (term !== undefined) suggestion.term = normalize(term);
    if (categoryId !== undefined) {
      suggestion.category = categoryId && mongoose.isValidObjectId(categoryId) ? categoryId : undefined;
    }
    if (order !== undefined) suggestion.order = Number(order) || 0;
    if (isActive !== undefined) suggestion.isActive = Boolean(isActive);

    await suggestion.save();
    await logAdminAction(req, 'search_suggestion_update', { suggestionId: suggestion._id });
    return res.status(200).json({ success: true, data: suggestion });
  } catch (error) {
    return next(error);
  }
};
