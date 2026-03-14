import mongoose from 'mongoose';
import City from '../models/City.js';
import District from '../models/District.js';
import RFQ from '../models/RFQ.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import AppSetting from '../models/AppSetting.js';

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

const DEFAULT_RADIUS_SETTINGS = {
  min: 5,
  max: 80,
  step: 1,
  default: 30,
  cityFallbackEnabled: true,
  liveLocationEnabled: true
};

const ensureRadiusSettings = async () => {
  let doc = await AppSetting.findOne({ key: 'radius_settings' });
  if (!doc) {
    doc = await AppSetting.create({ key: 'radius_settings', value: DEFAULT_RADIUS_SETTINGS });
  }
  return doc;
};

export const listAdminCities = async (req, res, next) => {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const search = normalize(req.query.search || req.query.q);
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';

    const query = {};
    if (search) query.name = new RegExp(search, 'i');
    if (!includeInactive) query.isActive = { $ne: false };

    const [items, total] = await Promise.all([
      City.find(query)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      City.countDocuments(query)
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

export const createAdminCity = async (req, res, next) => {
  try {
    const { name, slug, isActive, center, radiusKm, areaKm2 } = req.body || {};
    if (!normalize(name)) {
      return res.status(400).json({ success: false, message: 'Şehir adı zorunlu.' });
    }
    const payload = {
      name: normalize(name),
      slug: normalize(slug),
      isActive: typeof isActive === 'boolean' ? isActive : true
    };
    if (Number.isFinite(Number(radiusKm))) payload.radiusKm = Number(radiusKm);
    if (Number.isFinite(Number(areaKm2))) payload.areaKm2 = Number(areaKm2);
    if (center?.coordinates?.length === 2) {
      payload.center = { type: 'Point', coordinates: center.coordinates };
    }

    const city = await City.create(payload);
    await logAdminAction(req, 'city_create', { cityId: city._id });
    return res.status(201).json({ success: true, data: city });
  } catch (error) {
    return next(error);
  }
};

export const updateAdminCity = async (req, res, next) => {
  try {
    const { name, slug, isActive, center, radiusKm, areaKm2 } = req.body || {};
    const city = await City.findById(req.params.id);
    if (!city) {
      return res.status(404).json({ success: false, message: 'Şehir bulunamadı.' });
    }
    if (name !== undefined) city.name = normalize(name);
    if (slug !== undefined) city.slug = normalize(slug);
    if (isActive !== undefined) city.isActive = Boolean(isActive);
    if (Number.isFinite(Number(radiusKm))) city.radiusKm = Number(radiusKm);
    if (Number.isFinite(Number(areaKm2))) city.areaKm2 = Number(areaKm2);
    if (center?.coordinates?.length === 2) {
      city.center = { type: 'Point', coordinates: center.coordinates };
    }
    await city.save();
    await logAdminAction(req, 'city_update', { cityId: city._id });
    return res.status(200).json({ success: true, data: city });
  } catch (error) {
    return next(error);
  }
};

export const listAdminDistricts = async (req, res, next) => {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const search = normalize(req.query.search || req.query.q);
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    const cityId = normalize(req.query.cityId);

    const query = {};
    if (search) query.name = new RegExp(search, 'i');
    if (!includeInactive) query.isActive = { $ne: false };
    if (cityId && mongoose.isValidObjectId(cityId)) query.city = cityId;

    const [items, total] = await Promise.all([
      District.find(query)
        .populate('city', 'name')
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      District.countDocuments(query)
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

export const createAdminDistrict = async (req, res, next) => {
  try {
    const { name, cityId, isActive, center } = req.body || {};
    if (!normalize(name) || !mongoose.isValidObjectId(cityId)) {
      return res.status(400).json({ success: false, message: 'İlçe adı ve şehir zorunlu.' });
    }
    const payload = {
      name: normalize(name),
      city: cityId,
      isActive: typeof isActive === 'boolean' ? isActive : true
    };
    if (center?.coordinates?.length === 2) {
      payload.center = { type: 'Point', coordinates: center.coordinates };
    }
    const district = await District.create(payload);
    await logAdminAction(req, 'district_create', { districtId: district._id });
    return res.status(201).json({ success: true, data: district });
  } catch (error) {
    return next(error);
  }
};

export const updateAdminDistrict = async (req, res, next) => {
  try {
    const { name, cityId, isActive, center } = req.body || {};
    const district = await District.findById(req.params.id);
    if (!district) {
      return res.status(404).json({ success: false, message: 'İlçe bulunamadı.' });
    }
    if (name !== undefined) district.name = normalize(name);
    if (cityId && mongoose.isValidObjectId(cityId)) district.city = cityId;
    if (isActive !== undefined) district.isActive = Boolean(isActive);
    if (center?.coordinates?.length === 2) {
      district.center = { type: 'Point', coordinates: center.coordinates };
    }
    await district.save();
    await logAdminAction(req, 'district_update', { districtId: district._id });
    return res.status(200).json({ success: true, data: district });
  } catch (error) {
    return next(error);
  }
};

export const listLocationIssues = async (req, res, next) => {
  try {
    const limit = parseLimit(req.query.limit);
    const issues = [];

    const missingCity = await RFQ.find({ $or: [{ city: { $exists: false } }, { city: null }] })
      .limit(limit)
      .select('_id title buyer city district location locationData')
      .lean();
    missingCity.forEach((rfq) => issues.push({ type: 'missing_city', rfq }));

    const missingDistrict = await RFQ.find({
      $and: [
        { city: { $ne: null } },
        { $or: [{ district: { $exists: false } }, { district: null }] }
      ]
    })
      .limit(limit)
      .select('_id title buyer city district location locationData')
      .lean();
    missingDistrict.forEach((rfq) => issues.push({ type: 'missing_district', rfq }));

    const missingCoords = await RFQ.find({
      $or: [
        { location: { $exists: false } },
        { 'location.coordinates': { $exists: false } },
        { 'location.coordinates.0': { $exists: false } }
      ]
    })
      .limit(limit)
      .select('_id title buyer city district location locationData')
      .lean();
    missingCoords.forEach((rfq) => issues.push({ type: 'missing_coordinates', rfq }));

    const locationDataMissing = await RFQ.find({
      $or: [
        {
          $and: [
            { $or: [{ 'locationData.city': { $exists: false } }, { 'locationData.city': null }] },
            { $or: [{ city: { $exists: false } }, { city: null }, { city: '' }] }
          ]
        },
        {
          $and: [
            { $or: [{ 'locationData.district': { $exists: false } }, { 'locationData.district': null }] },
            { $or: [{ district: { $exists: false } }, { district: null }, { district: '' }] }
          ]
        }
      ]
    })
      .limit(limit)
      .select('_id title buyer city district location locationData')
      .lean();
    locationDataMissing.forEach((rfq) => issues.push({ type: 'missing_location_data', rfq }));

    return res.status(200).json({ success: true, items: issues.slice(0, limit) });
  } catch (error) {
    return next(error);
  }
};

export const fixLocationIssue = async (req, res, next) => {
  try {
    const rfq = await RFQ.findById(req.params.id);
    if (!rfq) {
      return res.status(404).json({ success: false, message: 'RFQ not found.' });
    }
    const { cityId, districtId, latitude, longitude } = req.body || {};
    const locationData = { ...(rfq.locationData || {}) };
    let touchedCity = false;
    let touchedDistrict = false;

    if (cityId && mongoose.isValidObjectId(cityId)) {
      rfq.city = cityId;
      const cityDoc = await City.findById(cityId).select('name').lean();
      if (cityDoc?.name) {
        locationData.city = cityDoc.name;
        touchedCity = true;
      }
    }
    if (districtId && mongoose.isValidObjectId(districtId)) {
      rfq.district = districtId;
      const districtDoc = await District.findById(districtId).select('name').lean();
      if (districtDoc?.name) {
        locationData.district = districtDoc.name;
        touchedDistrict = true;
      }
    }
    if (latitude !== undefined && longitude !== undefined) {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        rfq.location = { type: 'Point', coordinates: [lng, lat] };
      }
    }

    if (rfq.city && !touchedCity && !locationData.city) {
      if (mongoose.isValidObjectId(rfq.city)) {
        const cityDoc = await City.findById(rfq.city).select('name').lean();
        if (cityDoc?.name) {
          locationData.city = cityDoc.name;
        }
      } else if (typeof rfq.city === 'string' && rfq.city.trim()) {
        locationData.city = rfq.city.trim();
      }
    }
    if (rfq.district && !touchedDistrict && !locationData.district) {
      if (mongoose.isValidObjectId(rfq.district)) {
        const districtDoc = await District.findById(rfq.district).select('name').lean();
        if (districtDoc?.name) {
          locationData.district = districtDoc.name;
        }
      } else if (typeof rfq.district === 'string' && rfq.district.trim()) {
        locationData.district = rfq.district.trim();
      }
    }

    if (locationData.city || locationData.district) {
      rfq.locationData = locationData;
    }
    await rfq.save();
    await logAdminAction(req, 'location_issue_fix', { rfqId: rfq._id });
    return res.status(200).json({ success: true, data: rfq });
  } catch (error) {
    return next(error);
  }
};

export const getRadiusSettings = async (_req, res, next) => {
  try {
    const doc = await ensureRadiusSettings();
    return res.status(200).json({ success: true, data: doc.value || DEFAULT_RADIUS_SETTINGS });
  } catch (error) {
    return next(error);
  }
};

export const updateRadiusSettings = async (req, res, next) => {
  try {
    const doc = await ensureRadiusSettings();
    const nextValue = { ...(doc.value || DEFAULT_RADIUS_SETTINGS), ...(req.body || {}) };
    doc.value = nextValue;
    doc.updatedBy = req.admin?.id || null;
    await doc.save();
    await logAdminAction(req, 'radius_settings_update', { value: nextValue });
    return res.status(200).json({ success: true, data: nextValue });
  } catch (error) {
    return next(error);
  }
};
