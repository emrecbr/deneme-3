import { Router } from 'express';
import mongoose from 'mongoose';
import City from '../models/City.js';
import District from '../models/District.js';
import Neighborhood from '../models/Neighborhood.js';
import Street from '../models/Street.js';
import Location from '../models/Location.js';

const locationRoutes = Router();

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalize = (value) => String(value || '').trim();
const parsePage = (value) => Math.max(Number.parseInt(value, 10) || 1, 1);
const parseLimit = (value, max = 100) => Math.min(Math.max(Number.parseInt(value, 10) || 25, 1), max);
const toSearchRegex = (value) => {
  const input = String(value || '').trim();
  if (!input) {
    return null;
  }
  return new RegExp(escapeRegex(input), 'i');
};

const buildSearchRegex = (query) => {
  const q = normalize(query);
  if (!q) {
    return null;
  }
  return new RegExp(escapeRegex(q), 'i');
};

locationRoutes.get('/search', async (req, res, next) => {
  try {
    const q = normalize(req.query.q);
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit || 15, 200);
    if (!q) {
      return res.status(200).json({
        items: [],
        lastPage: 1,
        hasMore: false
      });
    }

    const match = { name: { $regex: escapeRegex(q), $options: 'i' } };
    const [cities, total] = await Promise.all([
      City.find(match, { _id: 1, name: 1 })
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      City.countDocuments(match)
    ]);

    const items = cities.map((item) => ({
      _id: item._id,
      name: item.name
    }));
    const lastPage = Math.max(Math.ceil(total / limit), 1);
    const hasMore = page < lastPage;

    return res.status(200).json({
      items,
      lastPage,
      hasMore
    });
  } catch (error) {
    console.error('REVERSE_ERROR', error?.message || error);
    return res.status(500).json({
      success: false,
      message: 'reverse fail'
    });
  }
});

const reverseCache = new Map();
const reverseRateLimits = new Map();
const REVERSE_CACHE_TTL_MS = 10 * 60 * 1000;
const REVERSE_RATE_WINDOW_MS = 5 * 60 * 1000;
const REVERSE_RATE_MAX = 30;
const DEFAULT_CITY_AREA_KM2 = 5000;
const KOCAELI_AREA_KM2 = 3581;
const DEFAULT_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

const getReverseUrl = () => process.env.REVERSE_GEOCODE_URL || DEFAULT_REVERSE_URL;
const pickFirst = (...values) => values.find((value) => Boolean(value));

const resolveCityFromAddress = (address = {}) => pickFirst(
  address.city,
  address.town,
  address.province,
  address.state,
  address.county,
  address.district,
  address.municipality,
  address.village,
  address.hamlet,
  address.city_district,
  address.administrative,
  address.state_district,
  address.region,
  address.administrative_area_level_1
);

const resolveDistrictFromAddress = (address = {}) => pickFirst(
  address.city_district,
  address.district,
  address.county,
  address.municipality,
  address.suburb,
  address.neighbourhood,
  address.neighborhood
);

const reverseGeocodeExternal = async (lat, lng) => {
  if (typeof globalThis.fetch !== 'function') {
    return null;
  }
  const url = new URL(getReverseUrl());
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('zoom', '10');
  url.searchParams.set('addressdetails', '1');

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': process.env.REVERSE_GEOCODE_UA || 'talepet/1.0 (reverse geocode)'
    }
  });
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  const address = data?.address || {};
  const cityName = resolveCityFromAddress(address);
  const districtName = resolveDistrictFromAddress(address);
  if (!cityName) {
    return null;
  }
  return {
    cityName,
    districtName,
    center: {
      type: 'Point',
      coordinates: [Number(data?.lon) || lng, Number(data?.lat) || lat]
    }
  };
};

const getCacheKey = (lat, lng) => `${lat.toFixed(4)}:${lng.toFixed(4)}`;
const cleanupRateLimit = (entry, now) => {
  if (!entry) return null;
  if (now - entry.startedAt > REVERSE_RATE_WINDOW_MS) {
    return null;
  }
  return entry;
};

// Local test:
// curl -i "http://localhost:3001/api/location/reverse?lat=40.76273731847972&lng=29.933393168281924"
locationRoutes.get('/reverse', async (req, res, next) => {
  try {
    const latRaw = req.query.lat ?? req.query.latitude;
    const lngRaw = req.query.lng ?? req.query.lon ?? req.query.longitude;
    const lat = Number.parseFloat(latRaw);
    const lng = Number.parseFloat(lngRaw);
    console.log('REV_LOC', {
      lat,
      lng,
      query: {
        lat: req.query.lat,
        lng: req.query.lng,
        latitude: req.query.latitude,
        longitude: req.query.longitude,
        lon: req.query.lon
      }
    });

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        ok: false,
        success: false,
        message: 'lat/lng required',
        query: req.query
      });
    }

    const cacheKey = getCacheKey(lat, lng);
    const cached = reverseCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.ts < REVERSE_CACHE_TTL_MS) {
      return res.status(200).json({
        success: true,
        ...cached.data
      });
    }

    const ip = String(req.headers['x-forwarded-for'] || req.ip || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)[0] || 'unknown';
    const prevLimit = cleanupRateLimit(reverseRateLimits.get(ip), now);
    const nextLimit = prevLimit
      ? { startedAt: prevLimit.startedAt, count: prevLimit.count + 1 }
      : { startedAt: now, count: 1 };
    reverseRateLimits.set(ip, nextLimit);
    if (nextLimit.count > REVERSE_RATE_MAX) {
      return res.status(429).json({
        success: false,
        message: 'Cok fazla deneme. Lutfen biraz sonra tekrar deneyin.'
      });
    }

    let nearestCity = null;
    let resolvedDistrict = null;
    let distanceKm = null;
    let fallbackCenter = null;
    try {
      const cityWithCenter = await City.aggregate([
        { $match: { center: { $exists: true } } },
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [lng, lat] },
            distanceField: 'distance',
            spherical: true
          }
        },
        { $limit: 1 },
        { $project: { _id: 1, name: 1, slug: 1, distance: 1, center: 1 } }
      ]);

      if (Array.isArray(cityWithCenter) && cityWithCenter.length > 0) {
        nearestCity = cityWithCenter[0];
        distanceKm = Number(nearestCity.distance) / 1000;
        fallbackCenter = nearestCity.center || null;
        console.log('REV_CITY_COUNT', cityWithCenter.length);
        console.log('REV_SAMPLE_CITY', {
          name: nearestCity.name,
          center: nearestCity.center,
          distanceKm
        });
      }
    } catch (_error) {
      // fallback to Location collection
    }

    if (!nearestCity) {
      const nearestLocation = await Location.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [lng, lat] },
            distanceField: 'distance',
            spherical: true,
            maxDistance: 200000
          }
        },
        { $limit: 1 },
        { $project: { city: 1, district: 1, coordinates: '$coordinates', distance: 1 } }
      ]);

      const record = nearestLocation?.[0];
      if (record?.city) {
        const cityRegex = new RegExp(`^${escapeRegex(record.city)}$`, 'i');
        const cityDoc = await City.findOne({ name: cityRegex }).select('_id name slug center areaKm2').lean();
        if (cityDoc?._id) {
          nearestCity = { _id: cityDoc._id, name: cityDoc.name, slug: cityDoc.slug };
          fallbackCenter = cityDoc.center || null;
        } else {
          nearestCity = { name: record.city };
        }

        if (record?.district && cityDoc?._id) {
          const districtRegex = new RegExp(`^${escapeRegex(record.district)}$`, 'i');
          const districtDoc = await District.findOne({ city: cityDoc._id, name: districtRegex })
            .select('_id name city')
            .lean();
          if (districtDoc?._id) {
            resolvedDistrict = { _id: districtDoc._id, name: districtDoc.name, cityId: districtDoc.city };
          }
        }

        distanceKm = Number(record.distance) / 1000;
        if (!fallbackCenter && Array.isArray(record.coordinates) && record.coordinates.length === 2) {
          fallbackCenter = { type: 'Point', coordinates: record.coordinates };
        }
      }
    }

    if (!nearestCity?.name) {
      console.log('REV_NO_COORDS');
      try {
        const external = await reverseGeocodeExternal(lat, lng);
        if (external?.cityName) {
          const cityRegex = new RegExp(`^${escapeRegex(external.cityName)}$`, 'i');
          const cityDoc = await City.findOne({ name: cityRegex }).select('_id name slug center areaKm2').lean();
          if (cityDoc?._id) {
            nearestCity = { _id: cityDoc._id, name: cityDoc.name, slug: cityDoc.slug };
            fallbackCenter = cityDoc.center || external.center || null;
          } else {
            nearestCity = { name: external.cityName };
            fallbackCenter = external.center || null;
          }

          if (external.districtName && cityDoc?._id) {
            const districtRegex = new RegExp(`^${escapeRegex(external.districtName)}$`, 'i');
            const districtDoc = await District.findOne({ city: cityDoc._id, name: districtRegex })
              .select('_id name city')
              .lean();
            if (districtDoc?._id) {
              resolvedDistrict = { _id: districtDoc._id, name: districtDoc.name, cityId: districtDoc.city };
            }
          }
        }
      } catch (_error) {
        // ignore external reverse failures
      }
    }

    if (!nearestCity?.name) {
      const payload = { city: null, district: null, message: 'not_found' };
      reverseCache.set(cacheKey, { ts: now, data: payload });
      return res.status(200).json({
        success: false,
        message: 'Sehir bilgisi bulunamadi.',
        data: payload
      });
    }

    console.log('REV_BEST', { city: nearestCity?.name, distanceKm });

    if (Number.isFinite(distanceKm) && distanceKm > 250) {
      return res.status(404).json({
        success: false,
        message: 'Sehir bulunamadi'
      });
    }

    let areaKm2 = DEFAULT_CITY_AREA_KM2;
    let cityDoc = null;
    if (nearestCity?._id) {
      cityDoc = await City.findById(nearestCity._id).select('areaKm2 center').lean();
      if (Number.isFinite(cityDoc?.areaKm2)) {
        areaKm2 = cityDoc.areaKm2;
      } else if (String(nearestCity.name || '').toLowerCase() === 'kocaeli') {
        areaKm2 = KOCAELI_AREA_KM2;
      }
      if (!Number.isFinite(cityDoc?.areaKm2)) {
        await City.updateOne(
          { _id: nearestCity._id },
          { $set: { areaKm2 } }
        );
      }
    } else if (String(nearestCity.name || '').toLowerCase() === 'kocaeli') {
      areaKm2 = KOCAELI_AREA_KM2;
    }

    const radiusKm = Math.sqrt(areaKm2 / Math.PI);
    const diameterKm = radiusKm * 2;

    const payload = {
      city: nearestCity,
      district: resolvedDistrict,
      distanceKm: Number.isFinite(distanceKm) ? distanceKm : null,
      radiusKm,
      diameterKm,
      center: cityDoc?.center || fallbackCenter || null
    };

    reverseCache.set(cacheKey, { ts: now, data: payload });

    return res.status(200).json({
      success: true,
      ...payload
    });
  } catch (error) {
    return next(error);
  }
});


locationRoutes.get('/cities', async (req, res, next) => {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit, 200);
    const searchRegex = toSearchRegex(req.query.search || req.query.q);
    const includeCoords = String(req.query.includeCoords || '').toLowerCase() === 'true';
    const modernMatch = searchRegex ? { name: searchRegex } : {};

    const [modernData, modernTotal] = await Promise.all([
      City.find(modernMatch)
        .select(includeCoords ? '_id name slug center' : '_id name slug')
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      City.countDocuments(modernMatch)
    ]);

    if (modernData.length > 0 || modernTotal > 0) {
      const items = modernData.map((item) => ({
        _id: item._id,
        id: item._id,
        name: item.name,
        slug: item.slug,
        ...(includeCoords ? { center: item.center } : {})
      }));
      const lastPage = Math.max(Math.ceil(modernTotal / limit), 1);
      const hasMore = page < lastPage;
      return res.status(200).json({
        items,
        lastPage,
        hasMore
      });
    }

    const qRegex = buildSearchRegex(req.query.q || req.query.search);
    const match = qRegex ? { city: qRegex } : {};

    const [data, totalCountResult] = await Promise.all([
      Location.aggregate([
        { $match: match },
        { $group: { _id: '$city' } },
        { $project: { _id: 0, value: '$_id' } },
        { $sort: { value: 1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit }
      ]),
      Location.aggregate([{ $match: match }, { $group: { _id: '$city' } }, { $count: 'total' }])
    ]);

    const total = Number(totalCountResult?.[0]?.total || 0);
    const items = data.map((item) => item.value);
    const lastPage = Math.max(Math.ceil(total / limit), 1);
    const hasMore = page < lastPage;
    return res.status(200).json({
      items,
      lastPage,
      hasMore
    });
  } catch (error) {
    return next(error);
  }
});

locationRoutes.get('/districts', async (req, res, next) => {
  try {
    const cityId = normalize(req.query.cityId);
    const searchRegex = toSearchRegex(req.query.search || req.query.q);
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit, 200);

    if (cityId) {
      if (!mongoose.isValidObjectId(cityId)) {
        return res.status(400).json({
          success: false,
          message: 'cityId gecersiz.'
        });
      }

      const modernMatch = { city: cityId };
      if (searchRegex) {
        modernMatch.name = searchRegex;
      }

      const [modernData, modernTotal] = await Promise.all([
        District.find(modernMatch)
          .select('_id name city')
          .sort({ name: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        District.countDocuments(modernMatch)
      ]);

      return res.status(200).json({
        success: true,
        data: modernData.map((item) => ({
          _id: item._id,
          id: item._id,
          name: item.name,
          cityId: item.city
        })),
        pagination: {
          page,
          limit,
          total: modernTotal,
          hasMore: page * limit < modernTotal
        }
      });
    }

    const city = normalize(req.query.city);
    if (!city) {
      return res.status(400).json({
        success: false,
        message: 'cityId veya city query param zorunludur.'
      });
    }

    const qRegex = buildSearchRegex(req.query.q || req.query.search);
    const match = {
      city: new RegExp(`^${escapeRegex(city)}$`, 'i')
    };
    if (qRegex) {
      match.district = qRegex;
    }

    const [data, totalCountResult] = await Promise.all([
      Location.aggregate([
        { $match: match },
        { $group: { _id: '$district' } },
        { $project: { _id: 0, value: '$_id' } },
        { $sort: { value: 1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit }
      ]),
      Location.aggregate([{ $match: match }, { $group: { _id: '$district' } }, { $count: 'total' }])
    ]);

    const total = Number(totalCountResult?.[0]?.total || 0);
    return res.status(200).json({
      success: true,
      data: data.map((item) => item.value),
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
});

locationRoutes.get('/neighborhoods', async (req, res, next) => {
  try {
    const districtId = normalize(req.query.districtId);
    const searchRegex = toSearchRegex(req.query.search || req.query.q);
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit, 200);

    if (districtId) {
      if (!mongoose.isValidObjectId(districtId)) {
        return res.status(400).json({
          success: false,
          message: 'districtId gecersiz.'
        });
      }

      const district = await District.findById(districtId).select('_id city').lean();
      if (!district?._id) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            hasMore: false
          }
        });
      }

      const modernMatch = { district: districtId };
      if (searchRegex) {
        modernMatch.name = searchRegex;
      }

      const [modernData, modernTotal] = await Promise.all([
        Neighborhood.find(modernMatch)
          .select('_id name district city')
          .sort({ name: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Neighborhood.countDocuments(modernMatch)
      ]);

      return res.status(200).json({
        success: true,
        data: modernData.map((item) => ({
          _id: item._id,
          id: item._id,
          name: item.name,
          districtId: item.district
        })),
        pagination: {
          page,
          limit,
          total: modernTotal,
          hasMore: page * limit < modernTotal
        }
      });
    }

    const city = normalize(req.query.city);
    const district = normalize(req.query.district);

    if (!city || !district) {
      return res.status(400).json({
        success: false,
        message: 'city ve district query param zorunludur.'
      });
    }

    const qRegex = buildSearchRegex(req.query.q || req.query.search);

    const match = {
      city: new RegExp(`^${escapeRegex(city)}$`, 'i'),
      district: new RegExp(`^${escapeRegex(district)}$`, 'i')
    };
    if (qRegex) {
      match.neighborhood = qRegex;
    }

    const [data, totalCountResult] = await Promise.all([
      Location.aggregate([
        { $match: match },
        { $group: { _id: '$neighborhood' } },
        { $project: { _id: 0, value: '$_id' } },
        { $sort: { value: 1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit }
      ]),
      Location.aggregate([{ $match: match }, { $group: { _id: '$neighborhood' } }, { $count: 'total' }])
    ]);

    const total = Number(totalCountResult?.[0]?.total || 0);
    return res.status(200).json({
      success: true,
      data: data.map((item) => item.value),
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
});

locationRoutes.get('/streets', async (req, res, next) => {
  try {
    const neighborhoodId = normalize(req.query.neighborhoodId);
    const searchRegex = toSearchRegex(req.query.search || req.query.q);
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit, 250);

    if (neighborhoodId) {
      if (!mongoose.isValidObjectId(neighborhoodId)) {
        return res.status(400).json({
          success: false,
          message: 'neighborhoodId gecersiz.'
        });
      }

      const modernMatch = { neighborhood: neighborhoodId };
      if (searchRegex) {
        modernMatch.name = searchRegex;
      }

      const [modernData, modernTotal] = await Promise.all([
        Street.find(modernMatch)
          .select('_id name type neighborhood')
          .sort({ name: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Street.countDocuments(modernMatch)
      ]);

      return res.status(200).json({
        success: true,
        data: modernData.map((item) => ({
          _id: item._id,
          id: item._id,
          name: item.name,
          type: item.type,
          neighborhoodId: item.neighborhood
        })),
        pagination: {
          page,
          limit,
          total: modernTotal,
          hasMore: page * limit < modernTotal
        }
      });
    }

    const city = normalize(req.query.city);
    const district = normalize(req.query.district);
    const neighborhood = normalize(req.query.neighborhood);

    if (!city || !district || !neighborhood) {
      return res.status(400).json({
        success: false,
        message: 'city, district ve neighborhood query param zorunludur.'
      });
    }

    const qRegex = buildSearchRegex(req.query.q || req.query.search);

    const match = {
      city: new RegExp(`^${escapeRegex(city)}$`, 'i'),
      district: new RegExp(`^${escapeRegex(district)}$`, 'i'),
      neighborhood: new RegExp(`^${escapeRegex(neighborhood)}$`, 'i')
    };
    if (qRegex) {
      match.street = qRegex;
    }

    const [data, totalCountResult] = await Promise.all([
      Location.aggregate([
        { $match: match },
        { $group: { _id: '$street' } },
        { $project: { _id: 0, value: '$_id' } },
        { $sort: { value: 1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit }
      ]),
      Location.aggregate([{ $match: match }, { $group: { _id: '$street' } }, { $count: 'total' }])
    ]);

    const total = Number(totalCountResult?.[0]?.total || 0);
    return res.status(200).json({
      success: true,
      data: data.map((item) => item.value),
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
});

export default locationRoutes;
