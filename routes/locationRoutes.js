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
    return next(error);
  }
});

locationRoutes.get('/cities', async (req, res, next) => {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit, 200);
    const searchRegex = toSearchRegex(req.query.search || req.query.q);
    const modernMatch = searchRegex ? { name: searchRegex } : {};

    const [modernData, modernTotal] = await Promise.all([
      City.find(modernMatch)
        .select('_id name slug')
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
        slug: item.slug
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
