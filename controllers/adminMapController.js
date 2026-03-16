import AppSetting from '../models/AppSetting.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import RFQ from '../models/RFQ.js';
import City from '../models/City.js';
import { haversineDistanceKm } from '../src/utils/geoDistance.js';
import { applyExpiryFilter, backfillMissingExpiresAt, getListingExpiryDays, markExpiredRfqs } from '../src/utils/rfqExpiry.js';

const DEFAULT_MAP_SETTINGS = {
  mapViewEnabled: true,
  defaultCenter: { lat: 41.0082, lng: 28.9784 },
  defaultZoom: 11,
  minZoom: 6,
  maxZoom: 18,
  clusterEnabled: true,
  radiusCircleEnabled: true,
  controlsEnabled: true
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

const getMapSettingsDoc = async () => {
  const doc = await AppSetting.findOne({ key: 'map_settings' }).lean();
  if (!doc) {
    const created = await AppSetting.create({ key: 'map_settings', value: DEFAULT_MAP_SETTINGS });
    return created;
  }
  return doc;
};

export const getMapSettings = async (_req, res, next) => {
  try {
    const doc = await getMapSettingsDoc();
    return res.status(200).json({ success: true, data: { ...DEFAULT_MAP_SETTINGS, ...(doc.value || {}) } });
  } catch (error) {
    return next(error);
  }
};

export const updateMapSettings = async (req, res, next) => {
  try {
    const doc = await getMapSettingsDoc();
    const nextValue = { ...DEFAULT_MAP_SETTINGS, ...(doc.value || {}), ...(req.body || {}) };
    const saved = await AppSetting.findOneAndUpdate(
      { key: 'map_settings' },
      { key: 'map_settings', value: nextValue, updatedBy: req.admin?.id || null },
      { upsert: true, new: true }
    );
    await logAdminAction(req, 'settings_map_update', { value: nextValue });
    return res.status(200).json({ success: true, data: saved?.value || nextValue });
  } catch (error) {
    return next(error);
  }
};

const parseNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const runMapTest = async (req, res, next) => {
  try {
    const lat = parseNumber(req.query.lat);
    const lng = parseNumber(req.query.lng);
    const radius = parseNumber(req.query.radius);
    const categoryId = String(req.query.categoryId || '').trim();
    const cityId = String(req.query.cityId || '').trim();
    const districtId = String(req.query.districtId || '').trim();

    const now = new Date();
    const listingExpiryDays = await getListingExpiryDays();
    await backfillMissingExpiresAt(listingExpiryDays);
    await markExpiredRfqs(now);

    const query = { isDeleted: { $ne: true } };
    if (categoryId) query.category = categoryId;
    if (cityId) query.city = cityId;
    if (districtId) query.district = districtId;
    applyExpiryFilter(query, now);

    let rfqs = await RFQ.find(query)
      .populate('city', 'name')
      .populate('district', 'name')
      .lean();

    const radiusDoc = await AppSetting.findOne({ key: 'radius_settings' }).lean();
    const radiusConfig = radiusDoc?.value || { max: 80, cityFallbackEnabled: true };
    const maxRadius = Number(radiusConfig?.max || 80);
    const cityFallbackEnabled = radiusConfig?.cityFallbackEnabled !== false;

    let center = null;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      center = { lat, lng };
    } else if (cityId) {
      const city = await City.findById(cityId).lean();
      if (city?.center?.coordinates?.length === 2) {
        center = { lat: city.center.coordinates[1], lng: city.center.coordinates[0] };
      }
    }

    let filtered = rfqs;
    let cityFallbackApplied = false;
    if (center && Number.isFinite(radius) && radius > 0) {
      if (cityFallbackEnabled && radius >= maxRadius && cityId) {
        cityFallbackApplied = true;
      } else {
        filtered = rfqs.filter((item) => {
          const coords = item?.location?.coordinates;
          if (!coords || coords.length !== 2) return false;
          const distance = haversineDistanceKm(center.lat, center.lng, coords[1], coords[0]);
          return distance <= radius;
        });
      }
    }

    const results = filtered.map((item) => {
      const coords = item?.location?.coordinates;
      const distance = center && coords?.length === 2
        ? haversineDistanceKm(center.lat, center.lng, coords[1], coords[0])
        : null;
      return {
        _id: item._id,
        title: item.title,
        city: item.city?.name || item.locationData?.city || '',
        district: item.district?.name || item.locationData?.district || '',
        coordinates: coords || null,
        distanceKm: distance
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        center,
        radius: Number.isFinite(radius) ? radius : null,
        count: results.length,
        cityFallbackApplied,
        items: results.slice(0, 200)
      }
    });
  } catch (error) {
    return next(error);
  }
};
