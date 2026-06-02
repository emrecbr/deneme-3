import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import Notification from '../models/Notification.js';
import { emitToRoom } from '../config/socket.js';
import NotificationPreference from '../models/NotificationPreference.js';
import { saveNotificationPreferences, upsertNotificationDevice } from '../src/services/pushNotificationService.js';

const notificationRoutes = Router();

const notificationDisplayMap = {
  offer_created: {
    title: 'Yeni teklif aldınız',
    body: 'Talebinize yeni bir teklif geldi.'
  },
  offer_updated: {
    title: 'Teklif durumunuz güncellendi',
    body: 'Talebinizdeki teklif bilgisi güncellendi.'
  },
  offer_accepted: {
    title: 'Teklif durumunuz güncellendi',
    body: 'Teklifinizin durumu güncellendi.'
  },
  offer_rejected: {
    title: 'Teklif durumunuz güncellendi',
    body: 'Teklifinizin durumu güncellendi.'
  },
  message: {
    title: 'Yeni mesajınız var',
    body: 'Bir kullanıcı size yeni mesaj gönderdi.'
  },
  rfq_updated: {
    title: 'Talep durumunuz güncellendi',
    body: 'Talebinizle ilgili bir güncelleme var.'
  },
  new_matching_rfq: {
    title: 'Yeni eşleşen ilan bulundu',
    body: 'İlan takip kuralınıza uygun yeni bir talep bulundu.'
  },
  listing_expiring: {
    title: 'Talebinizin süresi dolmak üzere',
    body: 'Talebinizin yayından kalkmasına kısa süre kaldı.'
  },
  listing_expired: {
    title: 'Talebinizin süresi doldu',
    body: 'Talebinizin yayın süresi doldu.'
  },
  moderation_result: {
    title: 'Talep durumunuz güncellendi',
    body: 'Talebinizin moderasyon durumu güncellendi.'
  },
  payment_success: {
    title: 'Paket işleminiz güncellendi',
    body: 'Paket veya ödeme işleminizle ilgili bir güncelleme var.'
  },
  premium_activated: {
    title: 'Paket işleminiz güncellendi',
    body: 'Paket veya ödeme işleminizle ilgili bir güncelleme var.'
  },
  featured_activated: {
    title: 'Paket işleminiz güncellendi',
    body: 'Paket veya ödeme işleminizle ilgili bir güncelleme var.'
  },
  report_resolved: {
    title: 'Talep durumunuz güncellendi',
    body: 'Talebinizle ilgili bir güncelleme var.'
  }
};

const getNotificationDisplay = (item) => {
  const type = String(item?.type || '');
  const display = notificationDisplayMap[type];
  if (display) return display;
  return {
    title: item?.title || 'Bildirim',
    body: item?.body || item?.message || item?.data?.preview || item?.data?.note || 'Yeni bir bildiriminiz var.'
  };
};

const serializeNotification = (item) => {
  const display = getNotificationDisplay(item);
  return {
    ...item,
    title: display.title,
    body: display.body
  };
};

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
