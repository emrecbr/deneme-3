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
import { getRecommendedRfqsForDetail } from '../src/services/rfqRecommendationService.js';
import { emitToRoom } from '../config/socket.js';
import { applyExpiryFilter, backfillMissingExpiresAt, computeExpiresAt, getListingExpiryDays, isRfqExpired, markExpiredRfqs } from '../src/utils/rfqExpiry.js';
import { checkModeration } from '../src/utils/moderation.js';
import { triggerMatchingAlertsForRfq } from '../src/services/alertSubscriptionService.js';
import { consumeFeaturedEntitlement } from '../src/services/entitlementService.js';
import {
  PUBLISHING_RIGHTS,
  consumePublishingRight,
  logPublishingRightUsage,
  revertPublishingRightConsumption
} from '../src/services/publishingRightsService.js';

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

const normalizeCategoryDisplayPayload = async (categoryValue) => {
  if (!categoryValue) {
    return null;
  }

  let categoryDoc = null;
  if (typeof categoryValue === 'object') {
    const categoryObject = categoryValue.toObject?.() || categoryValue;
    const categoryId = categoryObject._id || categoryObject.id;
    if (categoryId && mongoose.isValidObjectId(categoryId)) {
      categoryDoc = await Category.findById(categoryId)
        .select('_id name slug parent icon order segment')
        .lean();
    } else if (categoryObject.name || categoryObject.slug || categoryObject.label || categoryObject.title) {
      categoryDoc = {
        _id: categoryId || null,
        name: categoryObject.name || categoryObject.label || categoryObject.title || '',
        slug: categoryObject.slug || '',
        parent: categoryObject.parent || null,
        icon: categoryObject.icon || '',
        order: categoryObject.order,
        segment: categoryObject.segment
      };
    }
  } else {
    const categoryText = cleanText(categoryValue);
    if (mongoose.isValidObjectId(categoryText)) {
      categoryDoc = await Category.findById(categoryText)
        .select('_id name slug parent icon order segment')
        .lean();
    } else if (categoryText) {
      categoryDoc = await Category.findOne({
        $or: [
          { slug: categoryText.toLowerCase() },
          { name: new RegExp(`^${escapeRegex(categoryText)}$`, 'i') }
        ]
      })
        .select('_id name slug parent icon order segment')
        .lean();
      if (!categoryDoc) {
        categoryDoc = { name: categoryText, slug: categoryText };
      }
    }
  }

  if (!categoryDoc) {
    return null;
  }

  let parentName = '';
  let parentSlug = '';
  const parentId = categoryDoc.parent?._id || categoryDoc.parent;
  if (parentId && mongoose.isValidObjectId(parentId)) {
    const parentDoc = await Category.findById(parentId).select('_id name slug').lean();
    parentName = parentDoc?.name || '';
    parentSlug = parentDoc?.slug || '';
  } else if (categoryDoc.parent && typeof categoryDoc.parent === 'object') {
    parentName = categoryDoc.parent.name || categoryDoc.parent.label || categoryDoc.parent.title || '';
    parentSlug = categoryDoc.parent.slug || '';
  }

  return {
    _id: categoryDoc._id || null,
    name: categoryDoc.name || categoryDoc.label || categoryDoc.title || '',
    slug: categoryDoc.slug || '',
    parent: parentId || null,
    parentName,
    parentSlug,
    icon: categoryDoc.icon || '',
    order: categoryDoc.order,
    segment: categoryDoc.segment
  };
};

const attachCategoryDisplayPayload = async (rfqPayload) => {
  if (!rfqPayload) {
    return rfqPayload;
  }

  const categoryData = await normalizeCategoryDisplayPayload(rfqPayload.category);
  if (categoryData) {
    rfqPayload.categoryData = categoryData;
    if (categoryData.parentName && !rfqPayload.subcategoryData) {
      rfqPayload.subcategoryData = {
        _id: categoryData._id,
        name: categoryData.name,
        slug: categoryData.slug
      };
    }
  }

  return rfqPayload;
};

const resolveCategoryQueryFilter = async (value) => {
  const normalizedValue = cleanText(value);
  if (!normalizedValue) {
    return null;
  }

  const buildSyntheticCategoryId = (category, slug = 'diger') => {
    const segment = cleanText(category?.segment);
    const parentSlug = cleanText(
      category?.slug || String(category?._id || category?.name || '').replace(/\s+/g, '-').toLowerCase()
    );
    if (!segment || !parentSlug) {
      return null;
    }
    return `synthetic-category:${segment}:${parentSlug}:${slug}`;
  };

  const getSyntheticCategoryIds = (category, hasChildren) => {
    const syntheticIds = [];
    if (hasChildren) {
      const otherId = buildSyntheticCategoryId(category, 'diger');
      if (otherId) {
        syntheticIds.push(otherId);
      }
    }

    if (category?.segment === 'jobseeker' && !category?.parent) {
      ['cafe', 'sanayi', 'lokanta', 'diger'].forEach((slug) => {
        const id = buildSyntheticCategoryId(category, slug);
        if (id) {
          syntheticIds.push(id);
        }
      });
    }

    return syntheticIds;
  };

  const buildCategoryFamilyFilter = async (categoryId, legacyValue = '') => {
    const rootId = new mongoose.Types.ObjectId(categoryId);
    const categories = await Category.find().select('_id parent slug segment name').lean();
    const categoriesById = new Map(categories.map((category) => [String(category._id), category]));
    const childrenByParent = new Map();

    categories.forEach((category) => {
      const parentId = category.parent ? String(category.parent?._id || category.parent) : '';
      if (!parentId) {
        return;
      }
      const current = childrenByParent.get(parentId) || [];
      current.push(category._id);
      childrenByParent.set(parentId, current);
    });

    const ids = [rootId];
    const queue = [String(rootId)];
    while (queue.length) {
      const parentId = queue.shift();
      const children = childrenByParent.get(parentId) || [];
      children.forEach((childId) => {
        ids.push(childId);
        queue.push(String(childId));
      });
    }

    const syntheticIds = [];
    ids.forEach((id) => {
      const category = categoriesById.get(String(id));
      const hasChildren = Boolean(childrenByParent.get(String(id))?.length);
      syntheticIds.push(...getSyntheticCategoryIds(category, hasChildren));
    });

    const mixedValues = [...ids, ...ids.map((id) => String(id)), ...syntheticIds];
    if (legacyValue) {
      mixedValues.push(legacyValue);
    }
    return { $in: mixedValues };
  };

  if (mongoose.isValidObjectId(normalizedValue)) {
    return buildCategoryFamilyFilter(normalizedValue, normalizedValue);
  }

  const category = await Category.findOne({ slug: normalizedValue.toLowerCase() }).select('_id').lean();
  if (category?._id) {
    return buildCategoryFamilyFilter(category._id, normalizedValue);
  }

  return normalizedValue;
};

rfqRoutes.post('/', authMiddleware, upload.array('images', 5), async (req, res, next) => {
  let publishingConsumption = null;
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
      workStartDate,
      workEndDate,
      isAuction,
      longitude,
      latitude,
      location,
      city,
      district,
      neighborhood,
      street,
      productDetails,
      segmentMetadata,
      publishingRight
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

    const requestedSegment = ensureSegmentValue(segment);
    const parsedWorkStartDate = workStartDate ? new Date(workStartDate) : null;
    const parsedWorkEndDate = workEndDate ? new Date(workEndDate) : null;
    if (requestedSegment === 'jobseeker') {
      if (!parsedWorkStartDate || !Number.isFinite(parsedWorkStartDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Gecerli ise baslama tarihi zorunludur.'
        });
      }
      if (parsedWorkEndDate && !Number.isFinite(parsedWorkEndDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Gecerli is bitis tarihi gonderilmelidir.'
        });
      }
      if (parsedWorkEndDate && parsedWorkEndDate.getTime() < parsedWorkStartDate.getTime()) {
        return res.status(400).json({
          success: false,
          message: 'Is bitis tarihi baslangictan once olamaz.'
        });
      }
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

    if (!resolvedLocationData.district) {
      return res.status(400).json({
        success: false,
        message: 'Ilce secimi zorunludur.'
      });
    }

    const selectedCity = await City.findOne({
      name: new RegExp(`^${escapeRegex(resolvedLocationData.city)}$`, 'i')
    })
      .select('_id name center')
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

    const publishingResult = await consumePublishingRight({
      userId: req.user.id,
      requestedRight: publishingRight
    });
    if (!publishingResult.ok) {
      return res.status(publishingResult.status || 400).json({
        success: false,
        code: publishingResult.code || 'PUBLISHING_RIGHT_UNAVAILABLE',
        message: publishingResult.message || 'Seçilen yayın hakkı kullanılamıyor.',
        data: publishingResult.data || null
      });
    }
    publishingConsumption = publishingResult;

    const imagePaths = req.files?.map((file) => `/uploads/${file.filename}`) || [];
    const districtDoc = await District.findOne({
      city: selectedCity._id,
      name: new RegExp(`^${escapeRegex(resolvedLocationData.district)}$`, 'i')
    })
      .select('_id name center')
      .lean();
    if (!districtDoc?._id) {
      return res.status(400).json({
        success: false,
        message: 'Secilen ilce sistemde bulunamadi.'
      });
    }
    const selectedDistrictId = districtDoc._id;
    const selectedDistrictName = districtDoc.name || resolvedLocationData.district;

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
    const districtCenterCoords = Array.isArray(districtDoc.center?.coordinates) ? districtDoc.center.coordinates : null;
    const districtCenterLocation =
      districtCenterCoords &&
      districtCenterCoords.length === 2 &&
      isValidLngLat(Number(districtCenterCoords[0]), Number(districtCenterCoords[1]))
        ? {
            type: 'Point',
            coordinates: [Number(districtCenterCoords[0]), Number(districtCenterCoords[1])]
          }
        : null;
    const cityCenterCoords = Array.isArray(selectedCity.center?.coordinates) ? selectedCity.center.coordinates : null;
    const cityCenterLocation =
      cityCenterCoords &&
      cityCenterCoords.length === 2 &&
      isValidLngLat(Number(cityCenterCoords[0]), Number(cityCenterCoords[1]))
        ? {
            type: 'Point',
            coordinates: [Number(cityCenterCoords[0]), Number(cityCenterCoords[1])]
          }
        : null;
    const finalLocation = resolvedLocation || districtCenterLocation || cityCenterLocation || undefined;
    const isExpiredOnCreate = parsedDeadline.getTime() <= Date.now();

    const rfq = await RFQ.create({
      title: cleanText(title),
      description: cleanText(description),
      category: categoryResolution.categoryValue,
      segment: categoryResolution.segmentValue,
      quantity: parsedQuantity,
      targetPrice: targetPrice ? Number(targetPrice) : undefined,
      deadline: parsedDeadline,
      workStartDate: requestedSegment === 'jobseeker' ? parsedWorkStartDate : undefined,
      workEndDate: requestedSegment === 'jobseeker' && parsedWorkEndDate ? parsedWorkEndDate : undefined,
      expiresAt: computedExpiresAt,
      expiredAt: isExpiredOnCreate ? new Date() : undefined,
      isAuction: toBoolean(isAuction),
      currentBestOffer: toBoolean(isAuction) && targetPrice ? Number(targetPrice) : undefined,
      ...(finalLocation ? { location: finalLocation } : {}),
      city: selectedCity._id,
      district: selectedDistrictId || undefined,
      neighborhood: resolvedLocationData.neighborhood || undefined,
      street: resolvedLocationData.street || undefined,
      locationData: {
        city: resolvedLocationData.city || undefined,
        district: selectedDistrictName || undefined,
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
      status: isExpiredOnCreate ? 'expired' : 'open',
      images: imagePaths,
      publishingRight: publishingConsumption.right || PUBLISHING_RIGHTS.STANDARD,
      isPremium: publishingConsumption.right === PUBLISHING_RIGHTS.PREMIUM,
      isFeatured: publishingConsumption.right === PUBLISHING_RIGHTS.FEATURED,
      featuredUntil:
        publishingConsumption.right === PUBLISHING_RIGHTS.FEATURED
          ? publishingConsumption.featureUntil
          : undefined,
      featuredBy:
        publishingConsumption.right === PUBLISHING_RIGHTS.FEATURED
          ? req.user.id
          : undefined
    });

    const populatedRFQ = await RFQ.findById(rfq._id)
      .populate('buyer', 'name email')
      .populate('category', 'name slug parent icon order segment')
      .populate('city', 'name slug')
      .populate('district', 'name city')
      .lean();
    applySegmentToRfqPayload(populatedRFQ);

    if (global.io && !isExpiredOnCreate) {
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

    if (!isExpiredOnCreate) {
      setTimeout(() => {
        triggerMatchingAlertsForRfq(populatedRFQ || rfq).catch((notifyError) => {
          console.error('ALERT MATCH ERROR:', notifyError?.message || notifyError);
        });
      }, 0);
    }

    await logPublishingRightUsage({ userId: req.user.id, rfqId: rfq._id, consumption: publishingConsumption });
  } catch (error) {
    if (publishingConsumption) {
      await revertPublishingRightConsumption({
        userId: req.user?.id,
        consumption: publishingConsumption
      });
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
      query.isDeleted = { $ne: true };
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
    const requesterId = req.user?.id || null;
    const ownerId = rfq.buyer?._id?.toString?.() || rfq.buyer?.toString?.();
    const isOwner = Boolean(requesterId && ownerId === requesterId);
    if (isRfqExpired(rfq, now) && !isOwner) {
      return res.status(410).json({
        success: false,
        message: 'İlan süresi doldu.'
      });
    }

    const rfqData = rfq.toObject();
    applySegmentToRfqPayload(rfqData);
    await attachCategoryDisplayPayload(rfqData);
    const featuredUntil = rfqData.featuredUntil ? new Date(rfqData.featuredUntil) : null;
    rfqData.featuredActive = Boolean(rfqData.isFeatured && featuredUntil && featuredUntil > new Date());
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

    if (isRfqExpired(rfq)) {
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

    if (isRfqExpired(rfq)) {
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
      workStartDate,
      workEndDate,
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
    if (typeof workStartDate !== 'undefined') {
      const parsedWorkStartDate = workStartDate ? new Date(workStartDate) : null;
      if (parsedWorkStartDate && Number.isFinite(parsedWorkStartDate.getTime())) {
        rfq.workStartDate = parsedWorkStartDate;
      } else {
        rfq.workStartDate = undefined;
      }
    }
    if (typeof workEndDate !== 'undefined') {
      const parsedWorkEndDate = workEndDate ? new Date(workEndDate) : null;
      if (parsedWorkEndDate && Number.isFinite(parsedWorkEndDate.getTime())) {
        rfq.workEndDate = parsedWorkEndDate;
      } else {
        rfq.workEndDate = undefined;
      }
    }
    if (rfq.workStartDate && rfq.workEndDate && rfq.workEndDate.getTime() < rfq.workStartDate.getTime()) {
      return res.status(400).json({
        success: false,
        message: 'Is bitis tarihi baslangictan once olamaz.'
      });
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
    await consumeFeaturedEntitlement(user._id, 1);

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
