import { Router } from 'express';
import mongoose from 'mongoose';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';
import Category from '../models/Category.js';
import City from '../models/City.js';
import District from '../models/District.js';
import Location from '../models/Location.js';
import Offer from '../models/Offer.js';
import RFQ from '../models/RFQ.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import { getRecommendedRfqsForDetail } from '../src/services/rfqRecommendationService.js';
import { emitToRoom } from '../config/socket.js';
import { applyExpiryFilter, backfillMissingExpiresAt, computeExpiresAt, getListingExpiryDays, markExpiredRfqs } from '../src/utils/rfqExpiry.js';
import { consumeListingQuota, getListingQuotaSettings, getListingQuotaSnapshot, revertListingQuota } from '../src/utils/listingQuota.js';
import { checkModeration } from '../src/utils/moderation.js';
import { triggerMatchingAlertsForRfq } from '../src/services/alertSubscriptionService.js';

const rfqRoutes = Router();
const ALLOWED_SEGMENTS = new Set(['goods', 'service', 'auto', 'jobseeker']);
const normalizeCity = (cityValue) => String(cityValue || '').trim().toLowerCase();
const toBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1';
const cleanText = (value) => {
  const text = String(value || '').trim();
  return text || '';
};
const normalizeSegment = (value) => String(value || '').trim().toLowerCase();
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isValidLngLat = (lng, lat) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180;
const normalizeGeoPoint = ({ location, longitude, latitude }) => {
  let coordsProvided = false;

  if (location != null && location !== '') {
    coordsProvided = true;
    let parsedLocation = location;
    if (typeof location === 'string') {
      try {
        parsedLocation = JSON.parse(location);
      } catch (_error) {
        parsedLocation = null;
      }
    }

    const rawCoords = Array.isArray(parsedLocation?.coordinates) ? parsedLocation.coordinates : null;
    if (parsedLocation?.type === 'Point' && Array.isArray(rawCoords) && rawCoords.length === 2) {
      const lng = Number(rawCoords[0]);
      const lat = Number(rawCoords[1]);
      if (isValidLngLat(lng, lat)) {
        return {
          point: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          coordsProvided
        };
      }
    }
  }

  const hasCoordinatesInput =
    longitude != null &&
    latitude != null &&
    longitude !== '' &&
    latitude !== '';

  if (hasCoordinatesInput) {
    coordsProvided = true;
    const lng = Number(longitude);
    const lat = Number(latitude);
    if (isValidLngLat(lng, lat)) {
      return {
        point: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        coordsProvided
      };
    }
  }

  return { point: null, coordsProvided };
};

const ensureSegmentValue = (value) => {
  const segment = normalizeSegment(value);
  return ALLOWED_SEGMENTS.has(segment) ? segment : '';
};

const resolveCategoryAndSegment = async ({ categoryId, segment }) => {
  const normalizedSegment = normalizeSegment(segment);
  if (normalizedSegment && !ALLOWED_SEGMENTS.has(normalizedSegment)) {
    return { error: 'invalid_segment' };
  }

  const normalizedCategoryId = cleanText(categoryId);
  if (!normalizedCategoryId) {
    return { error: 'category_required' };
  }

  if (mongoose.isValidObjectId(normalizedCategoryId)) {
    const category = await Category.findById(normalizedCategoryId).select('_id segment');
    if (!category) {
      return { error: 'category_not_found' };
    }

    const categorySegment = ensureSegmentValue(category.segment);
    if (normalizedSegment && categorySegment && normalizedSegment !== categorySegment) {
      return { error: 'segment_category_mismatch' };
    }

    return {
      categoryValue: category._id,
      segmentValue: normalizedSegment || categorySegment || undefined
    };
  }

  return {
    categoryValue: normalizedCategoryId,
    segmentValue: normalizedSegment || undefined,
    legacyCategory: true
  };
};

const applySegmentToRfqPayload = (rfq) => {
  if (!rfq || rfq.segment) {
    return rfq;
  }
  const categorySegment = ensureSegmentValue(rfq?.category?.segment);
  if (categorySegment) {
    rfq.segment = categorySegment;
  }
  return rfq;
};

const resolveCategoryQueryFilter = async (value) => {
  const normalizedValue = cleanText(value);
  if (!normalizedValue) {
    return null;
  }

  if (mongoose.isValidObjectId(normalizedValue)) {
    return new mongoose.Types.ObjectId(normalizedValue);
  }

  const category = await Category.findOne({ slug: normalizedValue.toLowerCase() }).select('_id').lean();
  if (category?._id) {
    return category._id;
  }

  return normalizedValue;
};

rfqRoutes.post('/', authMiddleware, upload.array('images', 5), async (req, res, next) => {
  let quotaConsumption = null;
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized.'
      });
    }

    const {
      title,
      description,
      categoryId,
      segment,
      quantity,
      targetPrice,
      deadline,
      isAuction,
      longitude,
      latitude,
      location,
      city,
      district,
      neighborhood,
      street,
      productDetails,
      segmentMetadata
    } = req.body;

    if (!cleanText(title) || !cleanText(description)) {
      return res.status(400).json({
        success: false,
        message: 'Baslik ve aciklama zorunludur.'
      });
    }

    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Gecerli adet bilgisi zorunludur.'
      });
    }

    if (!deadline) {
      return res.status(400).json({
        success: false,
        message: 'Teslim suresi zorunludur.'
      });
    }
    const parsedDeadline = new Date(deadline);
    if (!Number.isFinite(parsedDeadline.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Gecerli teslim suresi zorunludur.'
      });
    }

    if (targetPrice != null && targetPrice !== '' && !Number.isFinite(Number(targetPrice))) {
      return res.status(400).json({
        success: false,
        message: 'Gecerli butce bilgisi gonderilmelidir.'
      });
    }

    const categoryResolution = await resolveCategoryAndSegment({ categoryId, segment });
    if (categoryResolution.error === 'invalid_segment') {
      return res.status(400).json({
        success: false,
        message: 'Gecerli segment secimi zorunludur.'
      });
    }
    if (categoryResolution.error === 'segment_category_mismatch') {
      return res.status(400).json({
        success: false,
        message: 'Kategori ile segment uyusmuyor.'
      });
    }
    if (categoryResolution.error === 'category_not_found') {
      return res.status(404).json({
        success: false,
        message: 'Kategori bulunamadi.'
      });
    }
    if (categoryResolution.error === 'category_required') {
      return res.status(400).json({
        success: false,
        message: 'Gecerli kategori secimi zorunludur.'
      });
    }

    const { point: resolvedLocation, coordsProvided } = normalizeGeoPoint({
      location,
      longitude,
      latitude
    });
    const resolvedLng = Number(resolvedLocation?.coordinates?.[0]);
    const resolvedLat = Number(resolvedLocation?.coordinates?.[1]);

    const owner = await User.findById(req.user.id).select('locationSelection city');
    if (!owner) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized.'
      });
    }

    const fallbackLocation = {
      city: cleanText(city) || cleanText(owner.locationSelection?.city) || cleanText(owner.city),
      district: cleanText(district) || cleanText(owner.locationSelection?.district),
      neighborhood: cleanText(neighborhood) || cleanText(owner.locationSelection?.neighborhood),
      street: cleanText(street) || cleanText(owner.locationSelection?.street)
    };

    let resolvedLocationData = { ...fallbackLocation };

    if (coordsProvided && !resolvedLocation) {
      return res.status(400).json({
        success: false,
        message: 'Konum bilgisi gecersiz.'
      });
    }
    if (!resolvedLocation) {
      return res.status(400).json({
        success: false,
        message: 'Konum seçilmedi (lat/lng zorunlu)'
      });
    }

    if (resolvedLocation) {
      const nearestAddress = await Location.findOne({
        coordinates: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [resolvedLng, resolvedLat]
            },
            $maxDistance: 3000
          }
        }
      })
        .select('city district neighborhood street')
        .lean();

      if (nearestAddress) {
        resolvedLocationData = {
          city: cleanText(nearestAddress.city),
          district: cleanText(nearestAddress.district),
          neighborhood: cleanText(nearestAddress.neighborhood),
          street: cleanText(nearestAddress.street)
        };
      }
    }

    if (!resolvedLocationData.city) {
      return res.status(400).json({
        success: false,
        message: 'Sehir secimi zorunludur.'
      });
    }

    const selectedCity = await City.findOne({
      name: new RegExp(`^${escapeRegex(resolvedLocationData.city)}$`, 'i')
    })
      .select('_id name')
      .lean();

    if (!selectedCity?._id) {
      return res.status(400).json({
        success: false,
        message: 'Secilen sehir sistemde bulunamadi.'
      });
    }

    const moderationResult = await checkModeration({
      userId: req.user.id,
      contentType: 'rfq',
      title,
      description,
      sourceRoute: 'rfq_create'
    });
    if (moderationResult.decision === 'review') {
      return res.status(422).json({
        success: false,
        code: 'MODERATION_REVIEW',
        message: 'İçeriğiniz incelemeye alındı. Kurallarımıza uygunluğundan emin olun.'
      });
    }
    if (moderationResult.blocked) {
      return res.status(422).json({
        success: false,
        code: 'MODERATION_BLOCKED',
        message: 'İçeriğiniz topluluk kurallarına uygun olmadığı için yayınlanamadı.'
      });
    }

    const quotaSettings = await getListingQuotaSettings();
    const quotaResult = await consumeListingQuota({ userId: req.user.id, settings: quotaSettings });
    if (!quotaResult.ok) {
      const currentUser = await User.findById(req.user.id).select(
        'listingQuotaWindowStart listingQuotaWindowEnd listingQuotaUsedFree paidListingCredits'
      );
      const snapshot = getListingQuotaSnapshot(currentUser, quotaSettings);
      return res.status(402).json({
        success: false,
        code: 'LISTING_QUOTA_REACHED',
        message: 'Bu dönem için ücretsiz ilan hakkınız doldu. Ek ilan için ödeme yapmanız gerekiyor.',
        data: snapshot
      });
    }
    quotaConsumption = quotaResult;

    const imagePaths = req.files?.map((file) => `/uploads/${file.filename}`) || [];
    let selectedDistrictId;
    if (resolvedLocationData.district) {
      const districtDoc = await District.findOne({
        city: selectedCity._id,
        name: new RegExp(`^${escapeRegex(resolvedLocationData.district)}$`, 'i')
      })
        .select('_id')
        .lean();
      selectedDistrictId = districtDoc?._id;
    }

    let carPayload = null;
    if (req.body?.car) {
      try {
        carPayload = typeof req.body.car === 'string' ? JSON.parse(req.body.car) : req.body.car;
      } catch (_error) {
        carPayload = null;
      }
    }

    let productDetailsPayload = {};
    if (productDetails) {
      try {
        productDetailsPayload = typeof productDetails === 'string' ? JSON.parse(productDetails) : productDetails;
      } catch (_error) {
        productDetailsPayload = {};
      }
    }

    let segmentMetadataPayload = {};
    if (segmentMetadata) {
      try {
        segmentMetadataPayload = typeof segmentMetadata === 'string' ? JSON.parse(segmentMetadata) : segmentMetadata;
      } catch (_error) {
        segmentMetadataPayload = {};
      }
    }


    const listingExpiryDays = await getListingExpiryDays();
    const computedExpiresAt = computeExpiresAt(new Date(), listingExpiryDays);

    const rfq = await RFQ.create({
      title: cleanText(title),
      description: cleanText(description),
      category: categoryResolution.categoryValue,
      segment: categoryResolution.segmentValue,
      quantity: parsedQuantity,
      targetPrice: targetPrice ? Number(targetPrice) : undefined,
      deadline: parsedDeadline,
      expiresAt: computedExpiresAt,
      isAuction: toBoolean(isAuction),
      currentBestOffer: toBoolean(isAuction) && targetPrice ? Number(targetPrice) : undefined,
      location: resolvedLocation,
      city: selectedCity._id,
      district: selectedDistrictId || undefined,
      neighborhood: resolvedLocationData.neighborhood || undefined,
      street: resolvedLocationData.street || undefined,
      locationData: {
        city: resolvedLocationData.city || undefined,
        district: resolvedLocationData.district || undefined,
        neighborhood: resolvedLocationData.neighborhood || undefined,
        street: resolvedLocationData.street || undefined
      },
      car: carPayload
        ? {
            brandId: carPayload.brandId || undefined,
            modelId: carPayload.modelId || undefined,
            variantId: carPayload.variantId || undefined,
            year: carPayload.year || undefined,
            brandName: carPayload.brandName || undefined,
            modelName: carPayload.modelName || undefined,
            variantName: carPayload.variantName || undefined
          }
        : undefined,
      productDetails: productDetailsPayload || {},
      segmentMetadata: segmentMetadataPayload || {},
      buyer: req.user.id,
      images: imagePaths
    });

    const populatedRFQ = await RFQ.findById(rfq._id)
      .populate('buyer', 'name email')
      .populate('category', 'name slug parent icon order segment')
      .populate('city', 'name slug')
      .populate('district', 'name city')
      .lean();
    applySegmentToRfqPayload(populatedRFQ);

    if (global.io) {
      const cityRoom = normalizeCity((populatedRFQ || rfq)?.locationData?.city || resolvedLocationData.city);
      if (cityRoom) {
        global.io.to(`city_${cityRoom}`).emit('new_rfq', populatedRFQ || rfq);
      } else {
        global.io.emit('new_rfq', populatedRFQ || rfq);
      }
    }

    res.status(201).json({
      success: true,
      data: populatedRFQ || rfq
    });

    setTimeout(() => {
      triggerMatchingAlertsForRfq(populatedRFQ || rfq).catch((notifyError) => {
        console.error('ALERT MATCH ERROR:', notifyError?.message || notifyError);
      });
    }, 0);

    if (quotaConsumption?.mode === 'paid') {
      try {
        await AdminAuditLog.create({
          adminId: null,
          role: 'system',
          action: 'listing_paid_create_success',
          meta: { userId: req.user.id, rfqId: rfq._id }
        });
      } catch (_error) {
        // ignore audit
      }
    }
  } catch (error) {
    if (quotaConsumption?.mode) {
      await revertListingQuota({
        userId: req.user?.id,
        mode: quotaConsumption.mode,
        windowStarted: quotaConsumption.windowStarted
      });
      if (quotaConsumption.mode === 'paid') {
        try {
          await AdminAuditLog.create({
            adminId: null,
            role: 'system',
            action: 'listing_paid_create_failed',
            meta: { userId: req.user?.id }
          });
        } catch (_error) {
          // ignore audit
        }
      }
    }
    console.error('RFQ CREATE ERROR:', error?.message || error);
    console.error(error?.stack);
    if (error?.name) {
      console.error('RFQ CREATE ERROR NAME:', error.name);
    }
    if (error?.errors) {
      console.error('RFQ CREATE VALIDATION:', error.errors);
    }

    if (error?.name === 'ValidationError' || error?.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: error?.message || 'Gecersiz veri gonderildi.'
      });
    }
    if (String(error?.message || '').toLowerCase().includes('geo')) {
      return res.status(400).json({
        success: false,
        message: 'Konum formatı hatalı (lat/lng gerekli).'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'RFQ oluşturulamadı',
      ...(process.env.NODE_ENV !== 'production'
        ? { detail: error?.message || 'Unknown error' }
        : {})
    });
  }
});

rfqRoutes.patch('/backfill-location', authMiddleware, async (req, res, next) => {
  try {
    const { longitude, latitude } = req.body;

    if (!longitude || !latitude) {
      return res.status(400).json({
        success: false,
        message: 'Konum zorunludur'
      });
    }

    const parsedLongitude = Number.parseFloat(longitude);
    const parsedLatitude = Number.parseFloat(latitude);

    if (!Number.isFinite(parsedLongitude) || !Number.isFinite(parsedLatitude)) {
      return res.status(400).json({
        success: false,
        message: 'Konum gecersiz'
      });
    }

    const result = await RFQ.updateMany(
      { location: { $exists: false } },
      {
        $set: {
          location: {
            type: 'Point',
            coordinates: [parsedLongitude, parsedLatitude]
          }
        }
      }
    );

    return res.status(200).json({
      success: true,
      data: {
        matchedCount: result.matchedCount || 0,
        modifiedCount: result.modifiedCount || 0
      }
    });
  } catch (error) {
    return next(error);
  }
});

rfqRoutes.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius, radiusKm, category, city, segment } = req.query;
    const latNum = Number.parseFloat(lat);
    const lngNum = Number.parseFloat(lng);

    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      });
    }

    const now = new Date();
    const listingExpiryDays = await getListingExpiryDays();
    await backfillMissingExpiresAt(listingExpiryDays);
    await markExpiredRfqs(now);

    const nearQuery = { status: 'open', isDeleted: { $ne: true } };
    const normalizedSegment = normalizeSegment(segment);
    if (normalizedSegment) {
      if (!ALLOWED_SEGMENTS.has(normalizedSegment)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid segment'
        });
      }
      nearQuery.segment = normalizedSegment;
    }
    const categoryFilter = await resolveCategoryQueryFilter(category);
    if (categoryFilter) {
      nearQuery.category = categoryFilter;
    }
    if (city) {
      nearQuery['locationData.city'] = { $regex: `^${String(city).trim()}$`, $options: 'i' };
    }
    applyExpiryFilter(nearQuery, now);

    const parsedRadiusKm = Number.parseFloat(radiusKm);
    const maxDistance = Number.isFinite(parsedRadiusKm)
      ? parsedRadiusKm * 1000
      : Number(radius) || 30000;

    const rfqs = await RFQ.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [lngNum, latNum]
          },
          distanceField: 'distance',
          maxDistance,
          spherical: true,
          query: nearQuery
        }
      },
      {
        $addFields: {
          distanceKm: { $divide: ['$distance', 1000] }
        }
      },
      {
        $sort: { distance: 1 }
      },
      {
        $limit: 50
      }
    ]);

    await RFQ.populate(rfqs, { path: 'buyer', select: 'name email' });
    await RFQ.populate(rfqs, { path: 'category', select: 'name slug parent icon order segment' });
    await RFQ.populate(rfqs, { path: 'city', select: 'name slug' });
    await RFQ.populate(rfqs, { path: 'district', select: 'name city' });
    rfqs.forEach((item) => applySegmentToRfqPayload(item));

    return res.status(200).json({
      items: rfqs,
      lastPage: 1,
      hasMore: false
    });
  } catch (error) {
    console.error('NEARBY ERROR FULL:', error);
    return res.status(200).json({
      items: [],
      lastPage: 1,
      hasMore: false
    });
  }
});

rfqRoutes.get('/', optionalAuthMiddleware, async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const skip = (page - 1) * limit;
    const query = {};
    const cityId = String(req.query.cityId || '').trim();
    const districtId = String(req.query.districtId || '').trim();
    const segment = normalizeSegment(req.query.segment);
    const category = req.query.category;

    if (cityId && !mongoose.isValidObjectId(cityId)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_CITY_ID',
        message: 'cityId gecersiz.'
      });
    }

    if (districtId && !mongoose.isValidObjectId(districtId)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_DISTRICT_ID',
        message: 'districtId gecersiz.'
      });
    }

    if (segment && !ALLOWED_SEGMENTS.has(segment)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_SEGMENT',
        message: 'segment gecersiz.'
      });
    }

    const now = new Date();
    const listingExpiryDays = await getListingExpiryDays();
    await backfillMissingExpiresAt(listingExpiryDays);
    await markExpiredRfqs(now);
    const categoryFilter = await resolveCategoryQueryFilter(category);

    if (req.query.buyer === 'currentUser') {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized.'
        });
      }
      query.buyer = req.user.id;
      applyExpiryFilter(query, now);
    } else {
      query.status = 'open';
      if (segment) {
        query.segment = segment;
      }
      if (categoryFilter) {
        query.category = categoryFilter;
      }
      if (cityId && mongoose.isValidObjectId(cityId)) {
        query.city = cityId;
      }
      if (districtId && mongoose.isValidObjectId(districtId)) {
        query.district = districtId;
      }
      applyExpiryFilter(query, now);
    }

    const rfqs = await RFQ.find(query)
      .populate('buyer', 'name email')
      .populate('category', 'name slug parent icon order segment')
      .populate('city', 'name slug')
      .populate('district', 'name city')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    rfqs.forEach((item) => applySegmentToRfqPayload(item));
    rfqs.forEach((item) => {
      const until = item.featuredUntil ? new Date(item.featuredUntil) : null;
      item.featuredActive = Boolean(item.isFeatured && until && until > now);
    });
    rfqs.sort((a, b) => {
      const aFeatured = a.featuredActive ? 1 : 0;
      const bFeatured = b.featuredActive ? 1 : 0;
      if (aFeatured !== bFeatured) {
        return bFeatured - aFeatured;
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
    if (req.query.buyer === 'currentUser' && req.user?.id) {
      const chats = await Chat.find({ participants: req.user.id })
        .select('rfq lastMessageAt updatedAt')
        .lean();
      const lastChatMap = new Map();
      chats.forEach((chat) => {
        const rfqId = chat.rfq?.toString?.();
        if (!rfqId) return;
        const ts = new Date(chat.lastMessageAt || chat.updatedAt || 0).getTime();
        const prev = lastChatMap.get(rfqId) || 0;
        if (ts > prev) {
          lastChatMap.set(rfqId, ts);
        }
      });
      rfqs.forEach((item) => {
        const key = item._id?.toString?.();
        if (!key) return;
        const ts = lastChatMap.get(key);
        if (ts) {
          item.lastChatAt = new Date(ts);
        } else {
          item.lastChatAt = null;
        }
      });
    }
    const total = await RFQ.countDocuments(query);
    const lastPage = Math.max(Math.ceil(total / limit), 1);
    const hasMore = page < lastPage;

    res.status(200).json({
      items: rfqs,
      lastPage,
      hasMore
    });
  } catch (error) {
    console.error('RFQ_LIST_FAIL', error);
    return res.status(500).json({
      success: false,
      message: 'RFQ listesi alinamadi.'
    });
  }
});

rfqRoutes.get('/by-city', async (req, res, next) => {
  try {
    const cityId = String(req.query.cityId || '').trim();
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const segment = normalizeSegment(req.query.segment);
    const category = req.query.category;

    if (!cityId || !mongoose.isValidObjectId(cityId)) {
      return res.status(400).json({
        success: false,
        message: 'cityId query param zorunludur.'
      });
    }

    if (segment && !ALLOWED_SEGMENTS.has(segment)) {
      return res.status(400).json({
        success: false,
        message: 'segment gecersiz.'
      });
    }

    const now = new Date();
    const listingExpiryDays = await getListingExpiryDays();
    await backfillMissingExpiresAt(listingExpiryDays);
    await markExpiredRfqs(now);
    const categoryFilter = await resolveCategoryQueryFilter(category);

    const query = {
      status: 'open',
      city: cityId
    };
    if (segment) {
      query.segment = segment;
    }
    if (categoryFilter) {
      query.category = categoryFilter;
    }
    applyExpiryFilter(query, now);

    const rfqs = await RFQ.find(query)
      .populate('buyer', 'name email')
      .populate('category', 'name slug parent icon order segment')
      .populate('city', 'name slug')
      .populate('district', 'name city')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    rfqs.forEach((item) => applySegmentToRfqPayload(item));
    const total = await RFQ.countDocuments(query);
    const lastPage = Math.max(Math.ceil(total / limit), 1);
    const hasMore = page < lastPage;

    return res.status(200).json({
      items: rfqs,
      lastPage,
      hasMore
    });
  } catch (error) {
    return next(error);
  }
});

rfqRoutes.get('/:id', optionalAuthMiddleware, async (req, res, next) => {
  try {
    const rfq = await RFQ.findById(req.params.id)
      .populate('buyer', 'name email')
      .populate('category', 'name slug parent icon order segment')
      .populate('city', 'name slug')
      .populate('district', 'name city');

    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found.'
      });
    }

    const now = new Date();
    if (rfq.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found.'
      });
    }
    if (rfq.status === 'expired' || (rfq.expiresAt && new Date(rfq.expiresAt) <= now)) {
      return res.status(410).json({
        success: false,
        message: 'İlan süresi doldu.'
      });
    }

    const rfqData = rfq.toObject();
    applySegmentToRfqPayload(rfqData);
    const featuredUntil = rfqData.featuredUntil ? new Date(rfqData.featuredUntil) : null;
    rfqData.featuredActive = Boolean(rfqData.isFeatured && featuredUntil && featuredUntil > new Date());
    const requesterId = req.user?.id || null;
    const ownerId = rfq.buyer?._id?.toString?.() || rfq.buyer?.toString?.();
    const isOwner = Boolean(requesterId && ownerId === requesterId);

    if (isOwner) {
      const offers = await Offer.find({ rfq: rfq._id })
        .sort({ createdAt: -1 })
        .populate('supplier', 'name email');
      rfqData.offers = offers;
      rfqData.canChat = rfq.status === 'awarded' && offers.some((item) => item.status === 'accepted');
    } else {
      rfqData.offers = [];
      if (requesterId) {
        const myOffer = await Offer.findOne({
          rfq: rfq._id,
          supplier: requesterId,
          status: { $nin: ['withdrawn', 'rejected', 'completed'] }
        })
          .sort({ createdAt: -1 })
          .populate('supplier', 'name email');
        rfqData.offers = myOffer ? [myOffer] : [];
        const acceptedOffer = await Offer.findOne({
          rfq: rfq._id,
          supplier: requesterId,
          status: 'accepted'
        }).select('_id');
        rfqData.canChat = Boolean(acceptedOffer && rfq.status === 'awarded');
      } else {
        rfqData.canChat = false;
      }
    }

    return res.status(200).json({
      success: true,
      data: rfqData
    });
  } catch (error) {
    return next(error);
  }
});

rfqRoutes.get('/:id/recommendations', optionalAuthMiddleware, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 24);
    const result = await getRecommendedRfqsForDetail({
      rfqId: req.params.id,
      userId: req.user?.id || null,
      limit
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    return next(error);
  }
});

rfqRoutes.patch('/:id/close', authMiddleware, async (req, res, next) => {
  try {
    const rfq = await RFQ.findById(req.params.id);

    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found.'
      });
    }

    if (rfq.buyer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: only RFQ owner can close this request.'
      });
    }

    if (rfq.status === 'expired' || (rfq.expiresAt && new Date(rfq.expiresAt) <= new Date())) {
      rfq.status = 'expired';
      rfq.expiredAt = rfq.expiredAt || new Date();
      await rfq.save();
      return res.status(410).json({
        success: false,
        message: 'İlan süresi doldu.'
      });
    }

    rfq.status = 'closed';
    await rfq.save();

    return res.status(200).json({
      success: true,
      data: rfq
    });
  } catch (error) {
    return next(error);
  }
});

rfqRoutes.patch('/:id', authMiddleware, async (req, res, next) => {
  try {
    const rfq = await RFQ.findById(req.params.id);

    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found.'
      });
    }

    if (rfq.buyer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: only RFQ owner can update.'
      });
    }

    if (rfq.status === 'expired' || (rfq.expiresAt && new Date(rfq.expiresAt) <= new Date())) {
      rfq.status = 'expired';
      rfq.expiredAt = rfq.expiredAt || new Date();
      await rfq.save();
      return res.status(410).json({
        success: false,
        message: 'İlan süresi doldu.'
      });
    }

    if (rfq.status !== 'open') {
      return res.status(409).json({
        success: false,
        message: 'RFQ is not open for update.'
      });
    }

    const {
      title,
      description,
      categoryId,
      segment,
      cityId,
      districtId,
      neighborhood,
      street,
      quantity,
      targetPrice,
      deadline,
      isAuction,
      productDetails,
      segmentMetadata
    } = req.body || {};

    if (title != null) {
      rfq.title = cleanText(title);
    }
    if (description != null) {
      rfq.description = cleanText(description);
    }
    if (quantity != null && Number.isFinite(Number(quantity))) {
      rfq.quantity = Number(quantity);
    }
    if (targetPrice != null && Number.isFinite(Number(targetPrice))) {
      rfq.targetPrice = Number(targetPrice);
    }
    if (deadline) {
      rfq.deadline = new Date(deadline);
    }
    if (typeof isAuction !== 'undefined') {
      rfq.isAuction = toBoolean(isAuction);
    }

    if (typeof categoryId !== 'undefined' || typeof segment !== 'undefined') {
      const categoryResolution = await resolveCategoryAndSegment({
        categoryId: typeof categoryId !== 'undefined' ? categoryId : rfq.category,
        segment: typeof segment !== 'undefined' ? segment : rfq.segment
      });

      if (categoryResolution.error === 'invalid_segment') {
        return res.status(400).json({
          success: false,
          message: 'Gecerli segment secimi zorunludur.'
        });
      }
      if (categoryResolution.error === 'segment_category_mismatch') {
        return res.status(400).json({
          success: false,
          message: 'Kategori ile segment uyusmuyor.'
        });
      }
      if (categoryResolution.error === 'category_not_found') {
        return res.status(404).json({
          success: false,
          message: 'Kategori bulunamadi.'
        });
      }
      if (categoryResolution.error === 'category_required') {
        return res.status(400).json({
          success: false,
          message: 'Gecerli kategori secimi zorunludur.'
        });
      }

      rfq.category = categoryResolution.categoryValue;
      rfq.segment = categoryResolution.segmentValue;
    }

    if (cityId && mongoose.isValidObjectId(cityId)) {
      const city = await City.findById(cityId);
      if (city) {
        rfq.city = city._id;
        rfq.locationData = {
          ...(rfq.locationData || {}),
          city: city.name
        };
      }
    }

    if (districtId && mongoose.isValidObjectId(districtId)) {
      const district = await District.findById(districtId);
      if (district) {
        rfq.district = district._id;
        rfq.locationData = {
          ...(rfq.locationData || {}),
          district: district.name
        };
      }
    }

    if (typeof neighborhood !== 'undefined') {
      rfq.neighborhood = neighborhood;
      rfq.locationData = {
        ...(rfq.locationData || {}),
        neighborhood
      };
    }

    if (typeof street !== 'undefined') {
      rfq.street = street;
      rfq.locationData = {
        ...(rfq.locationData || {}),
        street
      };
    }

    if (typeof productDetails !== 'undefined') {
      let parsedDetails = productDetails;
      if (typeof productDetails === 'string') {
        try {
          parsedDetails = JSON.parse(productDetails);
        } catch (_error) {
          parsedDetails = {};
        }
      }
      rfq.productDetails = parsedDetails || {};
    }

    if (typeof segmentMetadata !== 'undefined') {
      let parsedSegmentMetadata = segmentMetadata;
      if (typeof segmentMetadata === 'string') {
        try {
          parsedSegmentMetadata = JSON.parse(segmentMetadata);
        } catch (_error) {
          parsedSegmentMetadata = {};
        }
      }
      rfq.segmentMetadata = parsedSegmentMetadata || {};
    }

    await rfq.save();

    const offers = await Offer.find({ rfq: rfq._id }).select('supplier');
    const supplierIds = Array.from(new Set(offers.map((offer) => offer.supplier?.toString()).filter(Boolean)));

    await Promise.all(
      supplierIds.map((supplierId) =>
        Notification.create({
          user: supplierId,
          message: `${rfq.title} talebi guncellendi.`,
          type: 'rfq_updated',
          relatedId: rfq._id,
          data: {
            rfqId: rfq._id
          }
        })
      )
    );

    supplierIds.forEach((supplierId) => {
      emitToRoom(`user:${supplierId}`, 'notification:new', {
        type: 'rfq_updated',
        rfqId: rfq._id.toString()
      });
    });

    const chats = await Chat.find({ rfq: rfq._id }).select('_id');
    chats.forEach((chat) => {
      emitToRoom(`chat:${chat._id.toString()}`, 'rfq:update', {
        rfqId: rfq._id.toString(),
        rfq
      });
    });

    return res.status(200).json({
      success: true,
      data: rfq
    });
  } catch (error) {
    return next(error);
  }
});

rfqRoutes.post('/:id/feature', authMiddleware, async (req, res, next) => {
  try {
    const rfq = await RFQ.findById(req.params.id);
    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found.'
      });
    }

    if (rfq.buyer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Bu ilanı sadece sahibi öne çıkarabilir.'
      });
    }

    const now = new Date();
    const featuredActive = Boolean(rfq.isFeatured && rfq.featuredUntil && rfq.featuredUntil > now);
    if (featuredActive) {
      return res.status(409).json({
        success: false,
        code: 'ALREADY_FEATURED',
        message: 'Bu ilan zaten öne çıkarılmış.'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user || Number(user.featuredCredits || 0) <= 0) {
      return res.status(403).json({
        success: false,
        code: 'FEATURED_REQUIRED',
        message: 'Öne çıkarmak için kredin yok.'
      });
    }

    const featureUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    rfq.isFeatured = true;
    rfq.featuredUntil = featureUntil;
    rfq.featuredBy = user._id;
    await rfq.save();

    user.featuredCredits = Math.max(0, Number(user.featuredCredits || 0) - 1);
    await user.save();

    return res.status(200).json({
      success: true,
      data: {
        rfq,
        remainingCredits: user.featuredCredits
      }
    });
  } catch (error) {
    return next(error);
  }
});

export default rfqRoutes;
