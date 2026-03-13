import SearchLog from '../models/SearchLog.js';
import SearchSuggestion from '../models/SearchSuggestion.js';
import Category from '../models/Category.js';

const buildDateRange = (from, to) => {
  const range = {};
  if (from) {
    const start = new Date(from);
    if (!Number.isNaN(start.getTime())) range.$gte = start;
  }
  if (to) {
    const end = new Date(to);
    if (!Number.isNaN(end.getTime())) range.$lte = end;
  }
  return Object.keys(range).length ? range : null;
};

export const getSearchAnalytics = async (req, res, next) => {
  try {
    const from = req.query.from;
    const to = req.query.to;
    const hasResults = req.query.hasResults;
    const categoryId = req.query.categoryId;

    const match = {};
    const range = buildDateRange(from, to);
    if (range) match.createdAt = range;
    if (categoryId) match.categoryId = categoryId;
    if (hasResults === 'true') match.resultsCount = { $gt: 0 };
    if (hasResults === 'false') match.resultsCount = 0;

    const topTerms = await SearchLog.aggregate([
      { $match: match },
      { $group: { _id: '$normalizedTerm', count: { $sum: 1 }, avgResults: { $avg: '$resultsCount' }, term: { $first: '$term' } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const zeroResults = await SearchLog.aggregate([
      { $match: { ...match, resultsCount: 0 } },
      { $group: { _id: '$normalizedTerm', count: { $sum: 1 }, term: { $first: '$term' } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const recent = await SearchLog.find(match)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const topSuggestions = await SearchLog.aggregate([
      { $match: { ...match, suggestionId: { $ne: null } } },
      { $group: { _id: '$suggestionId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const suggestionIds = topSuggestions.map((item) => item._id).filter(Boolean);
    const suggestions = await SearchSuggestion.find({ _id: { $in: suggestionIds } }).lean();
    const suggestionMap = new Map(suggestions.map((item) => [String(item._id), item]));

    const suggestionStats = topSuggestions.map((item) => ({
      suggestionId: item._id,
      term: suggestionMap.get(String(item._id))?.term || '—',
      count: item.count
    }));

    const categories = await Category.find({ isActive: { $ne: false } }).select('name').lean();

    return res.status(200).json({
      success: true,
      data: {
        topTerms,
        zeroResults,
        recent,
        suggestionStats,
        categories
      }
    });
  } catch (error) {
    return next(error);
  }
};
