import RFQ from '../models/RFQ.js';
import User from '../models/User.js';

const normalize = (value) => String(value || '').trim().toLowerCase();

export const listAdvancedModerationQueue = async (req, res, next) => {
  try {
    const status = String(req.query.status || 'pending');
    const query = {};
    if (status === 'pending') {
      query.moderationStatus = 'pending';
    } else if (status) {
      query.moderationStatus = status;
    }
    if (req.query.flagged === 'true') {
      query.isFlagged = true;
    }
    const items = await RFQ.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('buyer', 'name email')
      .populate('city', 'name')
      .populate('district', 'name')
      .lean();

    return res.status(200).json({ success: true, items });
  } catch (error) {
    return next(error);
  }
};

export const listRiskSignals = async (_req, res, next) => {
  try {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const duplicateTitles = await RFQ.aggregate([
      { $match: { createdAt: { $gte: weekAgo } } },
      { $project: { title: { $toLower: '$title' }, rfqId: '$_id', buyer: '$buyer' } },
      { $group: { _id: '$title', count: { $sum: 1 }, rfqs: { $push: '$rfqId' } } },
      { $match: { count: { $gte: 3 } } },
      { $limit: 10 }
    ]);

    const highVolumeUsers = await RFQ.aggregate([
      { $match: { createdAt: { $gte: dayAgo } } },
      { $group: { _id: '$buyer', count: { $sum: 1 } } },
      { $match: { count: { $gte: 5 } } },
      { $limit: 10 }
    ]);

    const missingLocation = await RFQ.find({
      $or: [
        { city: { $exists: false } },
        { district: { $exists: false } },
        { location: { $exists: false } }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('_id title buyer city district createdAt')
      .lean();

    const userMap = new Map();
    if (highVolumeUsers.length) {
      const userIds = highVolumeUsers.map((item) => item._id).filter(Boolean);
      const users = await User.find({ _id: { $in: userIds } }).select('name email').lean();
      users.forEach((user) => userMap.set(String(user._id), user));
    }

    return res.status(200).json({
      success: true,
      data: {
        duplicateTitles,
        highVolumeUsers: highVolumeUsers.map((item) => ({
          userId: item._id,
          count: item.count,
          user: userMap.get(String(item._id)) || null
        })),
        missingLocation
      }
    });
  } catch (error) {
    return next(error);
  }
};
