import mongoose from 'mongoose';
import RFQ from '../models/RFQ.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import Category from '../models/Category.js';
import City from '../models/City.js';
import District from '../models/District.js';
import { applyExpiryFilter, backfillMissingExpiresAt, getListingExpiryDays, markExpiredRfqs, computeExpiresAt } from '../src/utils/rfqExpiry.js';

const normalize = (value) => String(value || '').trim();
const normalizeLower = (value) => normalize(value).toLowerCase();
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    if (!Number.isNaN(start.getTime())) {
      range.$gte = start;
    }
  }
  if (to) {
    const end = new Date(to);
    if (!Number.isNaN(end.getTime())) {
      range.$lte = end;
    }
  }
  return Object.keys(range).length ? range : null;
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

const resolveCategoryFilter = async (category) => {
  const categoryId = normalize(category);
  if (!categoryId) return null;
  if (mongoose.isValidObjectId(categoryId)) {
    return { category: new mongoose.Types.ObjectId(categoryId) };
  }
  const slug = normalizeLower(categoryId);
  if (!slug) return null;
  const categoryDoc = await Category.findOne({ slug }).select('_id').lean();
  if (!categoryDoc?._id) return null;
  return { category: categoryDoc._id };
};

const appendAndCondition = (query, condition) => {
  if (!condition || !Object.keys(condition).length) return;
  if (!Array.isArray(query.$and)) {
    query.$and = [];
  }
  query.$and.push(condition);
};

const resolveCityFilter = async (city) => {
  const cityValue = normalize(city);
  if (!cityValue) return null;

  if (mongoose.isValidObjectId(cityValue)) {
    const cityId = new mongoose.Types.ObjectId(cityValue);
    const cityDoc = await City.findById(cityId).select('_id name').lean();
    const exactName = cityDoc?.name ? new RegExp(`^${escapeRegex(cityDoc.name)}$`, 'i') : null;
    const clauses = [{ city: cityId }];
    if (exactName) {
      clauses.push({ 'locationData.city': exactName });
      clauses.push({ city: exactName });
    }
    return {
      cityId,
      cityName: cityDoc?.name || '',
      condition: clauses.length === 1 ? clauses[0] : { $or: clauses }
    };
  }

  const exactName = new RegExp(`^${escapeRegex(cityValue)}$`, 'i');
  const cityDoc = await City.findOne({ name: exactName })
    .select('_id')
    .lean();

  const clauses = [{ 'locationData.city': exactName }, { city: exactName }];
  if (cityDoc?._id) {
    clauses.unshift({ city: cityDoc._id });
  }

  return {
    cityId: cityDoc?._id || null,
    cityName: cityValue,
    condition: { $or: clauses }
  };
};

const resolveDistrictFilter = async (district, cityMeta = null) => {
  const districtValue = normalize(district);
  if (!districtValue) return null;

  if (mongoose.isValidObjectId(districtValue)) {
    const districtId = new mongoose.Types.ObjectId(districtValue);
    const districtDoc = await District.findById(districtId).select('_id name city').lean();
    const exactName = districtDoc?.name ? new RegExp(`^${escapeRegex(districtDoc.name)}$`, 'i') : null;
    const clauses = [{ district: districtId }];
    if (exactName) {
      clauses.push({ 'locationData.district': exactName });
      clauses.push({ district: exactName });
    }
    return {
      districtId,
      districtName: districtDoc?.name || '',
      cityId: districtDoc?.city || null,
      condition: clauses.length === 1 ? clauses[0] : { $or: clauses }
    };
  }

  const exactName = new RegExp(`^${escapeRegex(districtValue)}$`, 'i');
  const districtQuery = { name: exactName };
  if (cityMeta?.cityId && mongoose.isValidObjectId(cityMeta.cityId)) {
    districtQuery.city = cityMeta.cityId;
  }
  const districtDoc = await District.findOne(districtQuery)
    .select('_id')
    .lean();

  const clauses = [{ 'locationData.district': exactName }, { district: exactName }];
  if (districtDoc?._id) {
    clauses.unshift({ district: districtDoc._id });
  }

  return {
    districtId: districtDoc?._id || null,
    districtName: districtValue,
    cityId: cityMeta?.cityId || null,
    condition: { $or: clauses }
  };
};

export const listAdminRfqs = async (req, res, next) => {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const q = normalize(req.query.q || req.query.search);
    const status = normalize(req.query.status);
    const includeExpired = normalize(req.query.includeExpired) === 'true';
    const userId = normalize(req.query.userId || req.query.buyerId);
    const createdFrom = req.query.createdFrom;
    const createdTo = req.query.createdTo;
    const city = req.query.city;
    const district = req.query.district;
    const category = req.query.category;
    const moderationStatus = normalize(req.query.moderationStatus);
    const flagged = normalize(req.query.flagged);
    const followUp = normalize(req.query.followUp);

    const query = { isDeleted: { $ne: true } };
    const now = new Date();
    const listingExpiryDays = await getListingExpiryDays();
    await backfillMissingExpiresAt(listingExpiryDays);
    await markExpiredRfqs(now);

    if (status === 'pending') {
      query.status = 'open';
      query.moderationStatus = 'pending';
    } else if (status) {
      query.status = status;
    }
    if (moderationStatus) {
      query.moderationStatus = moderationStatus;
    }
    if (flagged === 'true') {
      query.isFlagged = true;
    } else if (flagged === 'false') {
      query.isFlagged = { $ne: true };
    }
    if (followUp === 'true') {
      query.followUp = true;
    } else if (followUp === 'false') {
      query.followUp = { $ne: true };
    }
    if (q) {
      appendAndCondition(query, {
        $or: [
        { title: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') }
        ]
      });
    }
    if (userId && mongoose.isValidObjectId(userId)) {
      query.buyer = new mongoose.Types.ObjectId(userId);
    }

    const createdRange = buildDateRange(createdFrom, createdTo);
    if (createdRange) {
      query.createdAt = createdRange;
    }

    const categoryFilter = await resolveCategoryFilter(category);
    const cityFilter = await resolveCityFilter(city);
    const districtFilter = await resolveDistrictFilter(district, cityFilter);

    if (categoryFilter) {
      appendAndCondition(query, categoryFilter);
    }
    if (cityFilter?.condition) {
      appendAndCondition(query, cityFilter.condition);
    }
    if (districtFilter?.condition) {
      appendAndCondition(query, districtFilter.condition);
    }

    if (!includeExpired && status !== 'expired') {
      applyExpiryFilter(query, now);
    }

    if (Array.isArray(query.$and) && query.$and.length === 0) {
      delete query.$and;
    }

    const [items, total] = await Promise.all([
      RFQ.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('buyer', 'name email role')
        .populate('category', 'name slug parent')
        .lean(),
      RFQ.countDocuments(query)
    ]);

    const cityIds = Array.from(
      new Set(
        items
          .map((item) => item.city)
          .filter((value) => value && mongoose.isValidObjectId(value))
          .map((value) => String(value))
      )
    );
    const districtIds = Array.from(
      new Set(
        items
          .map((item) => item.district)
          .filter((value) => value && mongoose.isValidObjectId(value))
          .map((value) => String(value))
      )
    );

    const [cityDocs, districtDocs] = await Promise.all([
      cityIds.length ? City.find({ _id: { $in: cityIds } }).select('name').lean() : [],
      districtIds.length ? District.find({ _id: { $in: districtIds } }).select('name city').lean() : []
    ]);

    const cityMap = new Map(cityDocs.map((doc) => [String(doc._id), doc]));
    const districtMap = new Map(districtDocs.map((doc) => [String(doc._id), doc]));

    items.forEach((item) => {
      if (item.city && mongoose.isValidObjectId(item.city)) {
        item.city = cityMap.get(String(item.city)) || item.city;
      } else if (typeof item.city === 'string' && item.city.trim()) {
        item.city = { name: item.city.trim() };
      }

      if (item.district && mongoose.isValidObjectId(item.district)) {
        item.district = districtMap.get(String(item.district)) || item.district;
      } else if (typeof item.district === 'string' && item.district.trim()) {
        item.district = { name: item.district.trim() };
      }
    });

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

export const getAdminRfq = async (req, res, next) => {
  try {
    const rfq = await RFQ.findById(req.params.id)
      .populate('buyer', 'name email role')
      .populate('category', 'name slug parent')
      .populate('city', 'name')
      .populate('district', 'name city')
      .lean();

    if (!rfq) {
      return res.status(404).json({ success: false, message: 'RFQ not found.' });
    }
    if (rfq.isDeleted) {
      return res.status(404).json({ success: false, message: 'RFQ not found.' });
    }

    return res.status(200).json({ success: true, data: rfq });
  } catch (error) {
    return next(error);
  }
};

export const updateAdminRfq = async (req, res, next) => {
  try {
    const rfq = await RFQ.findById(req.params.id);
    if (!rfq) {
      return res.status(404).json({ success: false, message: 'RFQ not found.' });
    }

    const {
      title,
      description,
      categoryId,
      cityId,
      districtId,
      latitude,
      longitude,
      moderationNote
    } = req.body || {};

    if (title !== undefined) rfq.title = normalize(title);
    if (description !== undefined) rfq.description = normalize(description);

    if (categoryId) {
      if (mongoose.isValidObjectId(categoryId)) {
        rfq.category = new mongoose.Types.ObjectId(categoryId);
      } else {
        rfq.category = categoryId;
      }
    }

    if (cityId && mongoose.isValidObjectId(cityId)) {
      rfq.city = new mongoose.Types.ObjectId(cityId);
    }
    if (districtId && mongoose.isValidObjectId(districtId)) {
      rfq.district = new mongoose.Types.ObjectId(districtId);
    }

    if (latitude !== undefined && longitude !== undefined) {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        rfq.location = {
          type: 'Point',
          coordinates: [lng, lat]
        };
      }
    }

    if (moderationNote !== undefined) {
      rfq.moderationNote = normalize(moderationNote);
      rfq.moderatedBy = req.admin?.id || null;
      rfq.moderatedAt = new Date();
    }

    await rfq.save();

    await logAdminAction(req, 'rfq_update', { rfqId: rfq._id });

    return res.status(200).json({ success: true, data: rfq });
  } catch (error) {
    return next(error);
  }
};

export const updateAdminRfqStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body || {};
    const nextStatus = normalize(status);
    if (!nextStatus) {
      return res.status(400).json({ success: false, message: 'status zorunlu.' });
    }

    if (!['open', 'closed', 'awarded', 'expired'].includes(nextStatus)) {
      return res.status(400).json({ success: false, message: 'Geçersiz status.' });
    }

    const rfq = await RFQ.findById(req.params.id);
    if (!rfq) {
      return res.status(404).json({ success: false, message: 'RFQ not found.' });
    }

    const prevStatus = rfq.status;
    rfq.status = nextStatus;
    if (nextStatus === 'expired') {
      rfq.expiredAt = new Date();
    } else if (prevStatus === 'expired') {
      rfq.expiredAt = null;
    }
    rfq.statusUpdatedBy = req.admin?.id || null;
    rfq.statusUpdatedAt = new Date();
    if (note !== undefined) {
      rfq.moderationNote = normalize(note);
      rfq.moderatedBy = req.admin?.id || null;
      rfq.moderatedAt = new Date();
    }

    await rfq.save();

    await logAdminAction(req, 'rfq_status_update', {
      rfqId: rfq._id,
      status: nextStatus
    });

    return res.status(200).json({ success: true, data: rfq });
  } catch (error) {
    return next(error);
  }
};

export const bulkUpdateRfqStatus = async (req, res, next) => {
  try {
    const { ids, status } = req.body || {};
    const nextStatus = normalize(status);
    if (!Array.isArray(ids) || ids.length === 0 || !nextStatus) {
      return res.status(400).json({ success: false, message: 'ids ve status zorunlu.' });
    }

    if (!['open', 'closed', 'awarded', 'expired'].includes(nextStatus)) {
      return res.status(400).json({ success: false, message: 'Geçersiz status.' });
    }

    const objectIds = ids.filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id));
    if (objectIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Geçerli RFQ id bulunamadı.' });
    }

    const updatePayload = {
      status: nextStatus,
      statusUpdatedBy: req.admin?.id || null,
      statusUpdatedAt: new Date()
    };
    if (nextStatus === 'expired') {
      updatePayload.expiredAt = new Date();
    } else {
      updatePayload.expiredAt = null;
    }

    const result = await RFQ.updateMany(
      { _id: { $in: objectIds } },
      {
        $set: {
          ...updatePayload
        }
      }
    );

    await logAdminAction(req, 'rfq_bulk_status_update', {
      count: objectIds.length,
      status: nextStatus
    });

    return res.status(200).json({ success: true, result });
  } catch (error) {
    return next(error);
  }
};

export const updateAdminRfqModeration = async (req, res, next) => {
  try {
    const { moderationStatus, moderationReason, moderationNote, isFlagged, followUp } = req.body || {};
    const rfq = await RFQ.findById(req.params.id);
    if (!rfq) {
      return res.status(404).json({ success: false, message: 'RFQ not found.' });
    }

    if (moderationStatus) {
      rfq.moderationStatus = normalize(moderationStatus);
    }
    if (moderationReason !== undefined) {
      rfq.moderationReason = normalize(moderationReason);
    }
    if (moderationNote !== undefined) {
      rfq.moderationNote = normalize(moderationNote);
    }
    if (typeof isFlagged === 'boolean') {
      rfq.isFlagged = isFlagged;
    }
    if (typeof followUp === 'boolean') {
      rfq.followUp = followUp;
    }

    rfq.moderatedBy = req.admin?.id || null;
    rfq.moderatedAt = new Date();

    await rfq.save();

    await logAdminAction(req, 'rfq_moderation_update', {
      rfqId: rfq._id,
      moderationStatus: rfq.moderationStatus,
      isFlagged: rfq.isFlagged,
      followUp: rfq.followUp
    });

    return res.status(200).json({ success: true, data: rfq });
  } catch (error) {
    return next(error);
  }
};

export const listExpiredRfqs = async (req, res, next) => {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const q = normalize(req.query.q || req.query.search);
    const query = {
      status: 'expired',
      isDeleted: { $ne: true }
    };
    if (q) {
      query.$or = [
        { title: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') }
      ];
    }
    const [items, total] = await Promise.all([
      RFQ.find(query)
        .sort({ expiredAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('buyer', 'name email role')
        .populate('category', 'name slug parent')
        .lean(),
      RFQ.countDocuments(query)
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

export const restoreExpiredRfq = async (req, res, next) => {
  try {
    const rfq = await RFQ.findById(req.params.id);
    if (!rfq) {
      return res.status(404).json({ success: false, message: 'RFQ not found.' });
    }
    if (rfq.isDeleted) {
      return res.status(400).json({ success: false, message: 'RFQ silinmiş.' });
    }
    const listingExpiryDays = await getListingExpiryDays();
    rfq.status = 'open';
    rfq.expiredAt = null;
    rfq.expiresAt = computeExpiresAt(new Date(), listingExpiryDays);
    rfq.statusUpdatedBy = req.admin?.id || null;
    rfq.statusUpdatedAt = new Date();
    await rfq.save();
    await logAdminAction(req, 'rfq_restore', { rfqId: rfq._id });
    return res.status(200).json({ success: true, data: rfq });
  } catch (error) {
    return next(error);
  }
};

export const deleteExpiredRfq = async (req, res, next) => {
  try {
    const rfq = await RFQ.findById(req.params.id);
    if (!rfq) {
      return res.status(404).json({ success: false, message: 'RFQ not found.' });
    }
    rfq.isDeleted = true;
    rfq.deletedAt = new Date();
    rfq.statusUpdatedBy = req.admin?.id || null;
    rfq.statusUpdatedAt = new Date();
    await rfq.save();
    await logAdminAction(req, 'rfq_delete', { rfqId: rfq._id });
    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
};
