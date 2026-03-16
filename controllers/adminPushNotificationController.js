import NotificationLog from '../models/NotificationLog.js';
import NotificationPreference from '../models/NotificationPreference.js';
import User from '../models/User.js';
import { sendPushToUser, sendPushToExternalId } from '../src/services/pushNotificationService.js';
import AdminAuditLog from '../models/AdminAuditLog.js';

const logAdminAction = async (req, action, meta = {}) => {
  try {
    await AdminAuditLog.create({
      adminId: req.admin?.id || null,
      role: req.admin?.role || null,
      action,
      ip: req.headers['x-forwarded-for'] || req.ip,
      userAgent: req.headers['user-agent'] || '',
      meta
    });
  } catch (_error) {
    // ignore
  }
};

export const listPushLogs = async (req, res, next) => {
  try {
    const { status, type, userId, q } = req.query || {};
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (userId) query.user = userId;
    if (q) {
      query.$or = [
        { title: new RegExp(q, 'i') },
        { body: new RegExp(q, 'i') }
      ];
    }
    const items = await NotificationLog.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('user', 'name email phone')
      .lean();
    return res.status(200).json({ success: true, items });
  } catch (error) {
    return next(error);
  }
};

export const listPushPreferences = async (req, res, next) => {
  try {
    const { userId } = req.query || {};
    const query = userId ? { user: userId } : {};
    const items = await NotificationPreference.find(query)
      .populate('user', 'name email phone')
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();
    return res.status(200).json({ success: true, items });
  } catch (error) {
    return next(error);
  }
};

export const sendAdminTestPush = async (req, res, next) => {
  try {
    const { userId, externalId, title, body, deepLink } = req.body || {};
    if (!userId && !externalId) {
      return res.status(400).json({ success: false, message: 'Hedef kullanıcı seçilmelidir.' });
    }
    const payload = {
      deepLink: deepLink || undefined,
      source: 'admin_test'
    };

    let result;
    if (userId) {
      const user = await User.findById(userId).select('_id');
      if (!user) {
        return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
      }
      result = await sendPushToUser({
        userId,
        type: 'admin_test_push',
        title,
        body,
        payload
      });
    } else {
      result = await sendPushToExternalId({
        externalId,
        type: 'admin_test_push',
        title,
        body,
        payload
      });
    }

    await logAdminAction(req, 'admin_test_push', {
      userId: userId || null,
      externalId: externalId || null,
      success: result?.ok === true
    });

    if (!result?.ok) {
      return res.status(400).json({ success: false, message: 'Bildirim gönderilemedi.', details: result });
    }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    return next(error);
  }
};
