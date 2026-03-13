import RFQ from '../models/RFQ.js';
import User from '../models/User.js';
import SearchLog from '../models/SearchLog.js';
import City from '../models/City.js';
import Category from '../models/Category.js';

export const getReportOverview = async (_req, res, next) => {
  try {
    const cityCountsRaw = await RFQ.aggregate([
      { $group: { _id: '$city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const categoryCountsRaw = await RFQ.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const usersDaily = await User.aggregate([
      { $group: { _id: { $substrBytes: ['$createdAt', 0, 10] }, count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: 7 }
    ]);

    const zeroSearches = await SearchLog.aggregate([
      { $match: { resultsCount: 0 } },
      { $group: { _id: '$normalizedTerm', count: { $sum: 1 }, term: { $first: '$term' } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const cityIds = cityCountsRaw.map((item) => item._id).filter(Boolean);
    const categoryIds = categoryCountsRaw.map((item) => item._id).filter(Boolean);
    const [cities, categories] = await Promise.all([
      City.find({ _id: { $in: cityIds } }).select('name').lean(),
      Category.find({ _id: { $in: categoryIds } }).select('name').lean()
    ]);
    const cityMap = new Map(cities.map((item) => [String(item._id), item.name]));
    const categoryMap = new Map(categories.map((item) => [String(item._id), item.name]));

    const cityCounts = cityCountsRaw.map((item) => ({
      id: item._id,
      name: item._id ? cityMap.get(String(item._id)) || String(item._id) : 'Bilinmiyor',
      count: item.count
    }));
    const categoryCounts = categoryCountsRaw.map((item) => ({
      id: item._id,
      name: item._id ? categoryMap.get(String(item._id)) || String(item._id) : 'Bilinmiyor',
      count: item.count
    }));

    return res.status(200).json({
      success: true,
      data: {
        cityCounts,
        categoryCounts,
        usersDaily,
        zeroSearches
      }
    });
  } catch (error) {
    return next(error);
  }
};
