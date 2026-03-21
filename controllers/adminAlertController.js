import NotificationSubscription from '../models/NotificationSubscription.js';

const formatAlert = (item) => ({
  ...item,
  categoryName: item.category?.name || '',
  cityName: item.city?.name || '',
  districtName: item.district?.name || ''
});

export const listAdminAlerts = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const query = {};

    if (req.query.userId) query.user = req.query.userId;
    if (req.query.type) query.type = req.query.type;
    if (req.query.active === 'true') query.isActive = true;
    if (req.query.active === 'false') query.isActive = false;
    if (req.query.keyword) query.keyword = { $regex: req.query.keyword, $options: 'i' };

    const [items, total] = await Promise.all([
      NotificationSubscription.find(query)
        .populate('user', 'name email phone')
        .populate('category', 'name')
        .populate('city', 'name')
        .populate('district', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NotificationSubscription.countDocuments(query)
    ]);

    return res.status(200).json({
      items: items.map(formatAlert),
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + items.length < total
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const getAdminAlertStats = async (_req, res, next) => {
  try {
    const [total, active, byType] = await Promise.all([
      NotificationSubscription.countDocuments({}),
      NotificationSubscription.countDocuments({ isActive: true }),
      NotificationSubscription.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    return res.status(200).json({
      success: true,
      data: {
        total,
        active,
        byType
      }
    });
  } catch (error) {
    return next(error);
  }
};
