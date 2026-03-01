import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import Notification from '../models/Notification.js';
import { emitToRoom } from '../config/socket.js';

const notificationRoutes = Router();

notificationRoutes.get('/', authMiddleware, async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = await Notification.countDocuments({
      user: req.user.id,
      isRead: false
    });

    return res.status(200).json({
      success: true,
      unreadCount,
      data: notifications
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
      isRead: false
    });

    emitToRoom(`user:${req.user.id}`, 'notification:read', {
      notificationId: notification._id.toString(),
      unreadCount
    });

    return res.status(200).json({
      success: true,
      unreadCount,
      data: notification
    });
  } catch (error) {
    return next(error);
  }
});

notificationRoutes.get('/unread-count', authMiddleware, async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user.id,
      isRead: false
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
      success: true
    });
  } catch (error) {
    return next(error);
  }
});

export default notificationRoutes;
