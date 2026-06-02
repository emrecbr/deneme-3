import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import Notification from '../models/Notification.js';
import { emitToRoom } from '../config/socket.js';
import NotificationPreference from '../models/NotificationPreference.js';
import { saveNotificationPreferences, upsertNotificationDevice } from '../src/services/pushNotificationService.js';

const notificationRoutes = Router();

const getNotificationTitle = (item) => {
  if (item?.title) return item.title;
  const type = String(item?.type || '');
  if (type === 'offer_created') return 'Yeni teklif';
  if (type === 'offer_updated') return 'Teklif güncellendi';
  if (type === 'offer_accepted') return 'Teklif kabul edildi';
  if (type === 'offer_rejected') return 'Teklif reddedildi';
  if (type === 'message') return 'Yeni mesaj';
  if (type === 'rfq_updated') return 'Talep güncellendi';
  if (type === 'new_matching_rfq') return 'Yeni eşleşen ilan';
  if (type === 'listing_expiring') return 'İlan süresi bitiyor';
  if (type === 'listing_expired') return 'İlan süresi doldu';
  if (type === 'moderation_result') return 'Moderasyon sonucu';
  if (type === 'payment_success') return 'Ödeme başarılı';
  if (type === 'premium_activated') return 'Premium aktif';
  if (type === 'featured_activated') return 'Öne çıkarma aktif';
  if (type === 'report_resolved') return 'Sorun bildirimi güncellendi';
  return 'Bildirim';
};

const serializeNotification = (item) => ({
  ...item,
  title: getNotificationTitle(item),
  body: item.body || item.message || item.data?.preview || item.data?.note || ''
});

notificationRoutes.get('/', authMiddleware, async (req, res, next) => {
  try {
    const notifications = await Notification.find({
      user: req.user.id,
      isRead: false,
      $or: [{ readAt: { $exists: false } }, { readAt: null }]
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const unreadCount = await Notification.countDocuments({
      user: req.user.id,
      isRead: false,
      $or: [{ readAt: { $exists: false } }, { readAt: null }]
    });

    return res.status(200).json({
      success: true,
      unreadCount,
      data: notifications.map(serializeNotification)
    });
  } catch (error) {
    return next(error);
  }
});

notificationRoutes.patch('/:id/read', authMiddleware, async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found.'
      });
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();
    }

    const unreadCount = await Notification.countDocuments({
      user: req.user.id,
      isRead: false,
      $or: [{ readAt: { $exists: false } }, { readAt: null }]
    });

    emitToRoom(`user:${req.user.id}`, 'notification:read', {
      notificationId: notification._id.toString(),
      unreadCount
    });

    return res.status(200).json({
      success: true,
      unreadCount,
      data: serializeNotification(notification.toObject?.() || notification)
    });
  } catch (error) {
    return next(error);
  }
});

notificationRoutes.patch('/read-all', authMiddleware, async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    emitToRoom(`user:${req.user.id}`, 'notification:read', {
      notificationId: 'all',
      unreadCount: 0
    });

    return res.status(200).json({
      success: true,
      unreadCount: 0
    });
  } catch (error) {
    return next(error);
  }
});

notificationRoutes.get('/unread-count', authMiddleware, async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user.id,
      isRead: false,
      $or: [{ readAt: { $exists: false } }, { readAt: null }]
    });

    return res.status(200).json({
      success: true,
      data: {
        count
      }
    });
  } catch (error) {
    return next(error);
  }
});

notificationRoutes.get('/preferences', authMiddleware, async (req, res, next) => {
  try {
    const prefs = await NotificationPreference.findOne({ user: req.user.id }).lean();
    return res.status(200).json({
      success: true,
      data: prefs || {
        pushEnabled: true,
        offerNotifications: true,
        messageNotifications: true,
        systemNotifications: true,
        marketingNotifications: false,
        paymentNotifications: true,
        listingNotifications: true
      }
    });
  } catch (error) {
    return next(error);
  }
});

notificationRoutes.patch('/preferences', authMiddleware, async (req, res, next) => {
  try {
    const prefs = await saveNotificationPreferences(req.user.id, req.body || {});
    return res.status(200).json({ success: true, data: prefs });
  } catch (error) {
    return next(error);
  }
});

notificationRoutes.post('/device', authMiddleware, async (req, res, next) => {
  try {
    const { externalId, subscriptionId, platform, appVersion } = req.body || {};
    if (!externalId) {
      return res.status(400).json({ success: false, message: 'externalId zorunludur.' });
    }
    await upsertNotificationDevice({
      userId: req.user.id,
      externalId: String(externalId),
      subscriptionId: subscriptionId ? String(subscriptionId) : undefined,
      platform,
      appVersion
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

export default notificationRoutes;
