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
import { emitToRoom } from '../config/socket.js';

const rfqRoutes = Router();
const normalizeCity = (cityValue) => String(cityValue || '').trim().toLowerCase();
const toBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1';
const cleanText = (value) => {
  const text = String(value || '').trim();
  return text || '';
};
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

rfqRoutes.post('/', authMiddleware, upload.array('images', 5), async (req, res, next) => {
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
      quantity,
      targetPrice,
      deadline,
      isAuction,
      expiresAt,
      longitude,
      latitude,
      location,
      city,
      district,
      neighborhood,
      street
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

    if (!categoryId || !mongoose.isValidObjectId(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Gecerli kategori secimi zorunludur.'
      });
    }

    const category = await Category.findById(categoryId).select('_id');
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Kategori bulunamadi.'
      });
    }

    const hasCoordinatesInput = longitude != null && latitude != null && longitude !== '' && latitude !== '';
    const parsedLongitude = Number(longitude);
    const parsedLatitude = Number(latitude);
    const isValidLatLng = (lat, lng) =>
      Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    const hasValidCoordinates = hasCoordinatesInput && isValidLatLng(parsedLatitude, parsedLongitude);

    let resolvedLocation = null;
    let resolvedLng = Number.isFinite(parsedLongitude) ? parsedLongitude : null;
    let resolvedLat = Number.isFinite(parsedLatitude) ? parsedLatitude : null;
    if (location) {
      let parsedLocation = location;
      if (typeof location === 'string') {
        try {
          parsedLocation = JSON.parse(location);
        } catch (_error) {
          parsedLocation = null;
        }
      }
      if (parsedLocation?.coordinates?.length === 2) {
        const [lng, lat] = parsedLocation.coordinates;
        const parsedLng = Number(lng);
        const parsedLat = Number(lat);
        if (isValidLatLng(parsedLat, parsedLng)) {
          resolvedLocation = {
            type: 'Point',
            coordinates: [parsedLng, parsedLat]
          };
          resolvedLng = parsedLng;
          resolvedLat = parsedLat;
        }
      }
    }

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

    if (hasCoordinatesInput && !hasValidCoordinates) {
      return res.status(400).json({
        success: false,
        message: 'Konum bilgisi gecersiz.'
      });
    }
    if (location && !resolvedLocation) {
      return res.status(400).json({
        success: false,
        message: 'Konum formatı hatalı (lat/lng gerekli).'
      });
    }
    if (!resolvedLocation && !hasValidCoordinates) {
      return res.status(400).json({
        success: false,
        message: 'Konum seçilmedi (lat/lng zorunlu)'
      });
    }

    if (resolvedLocation || hasValidCoordinates) {
      const nearestAddress = await Location.findOne({
        coordinates: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [resolvedLng ?? parsedLongitude, resolvedLat ?? parsedLatitude]
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

    const rfq = await RFQ.create({
      title: cleanText(title),
      description: cleanText(description),
      category: category._id,
      quantity: parsedQuantity,
      targetPrice: targetPrice ? Number(targetPrice) : undefined,
      deadline: parsedDeadline,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      isAuction: toBoolean(isAuction),
      currentBestOffer: toBoolean(isAuction) && targetPrice ? Number(targetPrice) : undefined,
      location: resolvedLocation
        ? resolvedLocation
        : hasValidCoordinates
          ? {
              type: 'Point',
              coordinates: [parsedLongitude, parsedLatitude]
            }
          : undefined,
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
      buyer: req.user.id,
      images: imagePaths
    });

    const populatedRFQ = await RFQ.findById(rfq._id)
      .populate('buyer', 'name email')
      .populate('category', 'name slug')
      .populate('city', 'name slug')
      .populate('district', 'name city')
      .lean();

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
  } catch (error) {
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
    const { lat, lng, radius, category, city } = req.query;
    const latNum = Number.parseFloat(lat);
    const lngNum = Number.parseFloat(lng);

    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      });
    }

    const nearQuery = { status: 'open' };
    if (category && mongoose.isValidObjectId(category)) {
      nearQuery.category = new mongoose.Types.ObjectId(category);
    }
    if (city) {
      nearQuery['locationData.city'] = { $regex: `^${String(city).trim()}$`, $options: 'i' };
    }

    const rfqs = await RFQ.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [lngNum, latNum]
          },
          distanceField: 'distance',
          maxDistance: Number(radius) || 30000,
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
    await RFQ.populate(rfqs, { path: 'category', select: 'name slug parent icon order' });
    await RFQ.populate(rfqs, { path: 'city', select: 'name slug' });
    await RFQ.populate(rfqs, { path: 'district', select: 'name city' });

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

    if (req.query.buyer === 'currentUser') {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized.'
        });
      }
      query.buyer = req.user.id;
    } else {
      query.status = 'open';
      if (cityId && mongoose.isValidObjectId(cityId)) {
        query.city = cityId;
      }
      if (districtId && mongoose.isValidObjectId(districtId)) {
        query.district = districtId;
      }
    }

    const rfqs = await RFQ.find(query)
      .populate('buyer', 'name email')
      .populate('category', 'name slug parent icon order')
      .populate('city', 'name slug')
      .populate('district', 'name city')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    const now = new Date();
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

    if (!cityId || !mongoose.isValidObjectId(cityId)) {
      return res.status(400).json({
        success: false,
        message: 'cityId query param zorunludur.'
      });
    }

    const rfqs = await RFQ.find({
      status: 'open',
      city: cityId
    })
      .populate('buyer', 'name email')
      .populate('category', 'name slug parent icon order')
      .populate('city', 'name slug')
      .populate('district', 'name city')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const total = await RFQ.countDocuments({
      status: 'open',
      city: cityId
    });
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
      .populate('category', 'name slug parent icon order')
      .populate('city', 'name slug')
      .populate('district', 'name city');

    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found.'
      });
    }

    const rfqData = rfq.toObject();
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
      cityId,
      districtId,
      neighborhood,
      street,
      quantity,
      targetPrice,
      deadline,
      isAuction
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

    if (categoryId) {
      if (!mongoose.isValidObjectId(categoryId)) {
        return res.status(400).json({
          success: false,
          message: 'Gecerli kategori secimi zorunludur.'
        });
      }
      const category = await Category.findById(categoryId).select('_id');
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Kategori bulunamadi.'
        });
      }
      rfq.category = category._id;
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
