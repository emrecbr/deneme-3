import SearchSuggestion from '../models/SearchSuggestion.js';
import SearchLog from '../models/SearchLog.js';
import Category from '../models/Category.js';

const normalize = (value) => String(value || '').trim();

export const listPublicSuggestions = async (req, res, next) => {
  try {
    const q = normalize(req.query.q || req.query.search);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const query = { isActive: { $ne: false } };
    if (q) {
      query.term = new RegExp(q, 'i');
    }
    const suggestions = await SearchSuggestion.find(query)
      .sort({ order: 1, term: 1 })
      .limit(limit)
      .populate('category', 'name parent')
      .lean();

    const categoryIds = suggestions
      .map((item) => item.category?.parent)
      .filter(Boolean);
    const parents = await Category.find({ _id: { $in: categoryIds } }).select('name').lean();
    const parentMap = new Map(parents.map((item) => [String(item._id), item.name]));

    const items = suggestions.map((item) => ({
      _id: item._id,
      term: item.term,
      order: item.order,
      categoryId: item.category?._id || null,
      categoryName: item.category?.name || '',
      parentName: item.category?.parent ? parentMap.get(String(item.category.parent)) : '',
      impressions: item.impressions || 0,
      clicks: item.clicks || 0
    }));

    if (items.length) {
      SearchSuggestion.updateMany(
        { _id: { $in: items.map((item) => item._id) } },
        { $inc: { impressions: 1 } }
      ).catch(() => null);
    }

    return res.status(200).json({ success: true, items });
  } catch (error) {
    return next(error);
  }
};

export const logSearchEvent = async (req, res, next) => {
  try {
    const term = normalize(req.body?.term);
    if (!term) {
      return res.status(400).json({ success: false, message: 'Arama terimi gerekli.' });
    }
    const normalized = term.toLocaleLowerCase('tr-TR');
    const resultsCount = Number(req.body?.resultsCount) || 0;
    const categoryId = req.body?.categoryId || null;
    const suggestionId = req.body?.suggestionId || null;
    const source = req.body?.source === 'suggestion' ? 'suggestion' : 'manual';

    const log = await SearchLog.create({
      term,
      normalizedTerm: normalized,
      userId: req.user?.id || null,
      categoryId,
      suggestionId,
      source,
      resultsCount
    });

    if (suggestionId) {
      SearchSuggestion.updateOne({ _id: suggestionId }, { $inc: { clicks: 1 } }).catch(() => null);
    }

    return res.status(201).json({ success: true, data: log });
  } catch (error) {
    return next(error);
  }
};
