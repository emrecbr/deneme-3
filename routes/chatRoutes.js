import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { apiRateLimit } from '../middleware/apiRateLimit.js';
import Chat from '../models/Chat.js';
import ChatRestriction from '../models/ChatRestriction.js';
import ChatReport from '../models/ChatReport.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import Offer from '../models/Offer.js';
import RFQ from '../models/RFQ.js';
import User from '../models/User.js';
import UserBlock from '../models/UserBlock.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import { emitToRoom } from '../config/socket.js';
import { sendPushToUser } from '../src/services/pushNotificationService.js';
import { uploadChatImage } from '../src/services/mediaStorageService.js';
import { analyzeChatMessage } from '../src/services/chatModerationService.js';

const chatRoutes = Router();

const getUserId = (req) => req.user?.id;
const isDev = process.env.NODE_ENV !== 'production';
const MAX_MESSAGE_LENGTH = 2000;
const CHAT_REPORT_REASONS = new Set(['spam', 'harassment', 'inappropriate', 'scam', 'other']);
const CHAT_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const chatMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (CHAT_IMAGE_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Sadece JPG, PNG veya WebP görsel kullanabilirsiniz.'));
  }
});

const logChatReportAction = async (action, meta = {}) => {
  try {
    await AdminAuditLog.create({
      action,
      meta
    });
  } catch (_error) {
    // audit failure must not block user reporting
  }
};

const logChatModerationAction = async (action, meta = {}) => {
  try {
    await AdminAuditLog.create({
      action,
      meta
    });
  } catch (_error) {
    // audit failure must not block chat delivery
  }
};

const serializeMessage = (message) => ({
  ...(typeof message.toObject === 'function' ? message.toObject() : message),
  status: 'sent'
});

const toIdString = (value) => value?._id?.toString?.() || value?.toString?.() || '';

const getOtherParticipantId = (chat, userId) => {
  const actorId = String(userId || '');
  return (chat?.participants || []).map(toIdString).find((participantId) => participantId && participantId !== actorId) || '';
};

const getChatBlockState = async (chat, userId) => {
  const actorId = String(userId || '');
  const otherUserId = getOtherParticipantId(chat, actorId);
  if (!actorId || !otherUserId) {
    return {
      otherUserId,
      isBlocked: false,
      blockedByMe: false,
      blockedMe: false
    };
  }

  const blocks = await UserBlock.find({
    $or: [
      { blockerId: actorId, blockedUserId: otherUserId },
      { blockerId: otherUserId, blockedUserId: actorId }
    ]
  }).lean();
  const blockedByMe = blocks.some(
    (block) => String(block.blockerId) === actorId && String(block.blockedUserId) === otherUserId
  );
  const blockedMe = blocks.some(
    (block) => String(block.blockerId) === otherUserId && String(block.blockedUserId) === actorId
  );

  return {
    otherUserId,
    isBlocked: blockedByMe || blockedMe,
    blockedByMe,
    blockedMe
  };
};

const hasActiveChatRestriction = async (userId) => {
  const now = new Date();
  return ChatRestriction.exists({
    userId,
    liftedAt: { $exists: false },
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }]
  });
};

const getGlobalUnreadCount = async (userId) => {
  const chats = await Chat.find({ participants: userId }).select('_id');
  const chatIds = chats.map((chat) => chat._id);
  if (!chatIds.length) {
    return 0;
  }

  return Message.countDocuments({
    chat: { $in: chatIds },
    sender: { $ne: userId },
    read: { $ne: true }
  });
};

const emitGlobalUnreadCount = async (userId) => {
  const globalUnreadCount = await getGlobalUnreadCount(userId);
  emitToRoom(`user:${userId}`, 'chat:unread-count', {
    globalUnreadCount
  });
  return globalUnreadCount;
};

const markChatMessagesRead = async (chat, userId) => {
  const unreadMessages = await Message.find({
    chat: chat._id,
    sender: { $ne: userId },
    read: { $ne: true }
  }).select('_id');

  if (!unreadMessages.length) {
    return [];
  }

  const readAt = new Date();
  await Message.updateMany(
    {
      _id: { $in: unreadMessages.map((message) => message._id) }
    },
    {
      $set: { read: true, readAt },
      $addToSet: { readBy: userId }
    }
  );

  const messageIds = unreadMessages.map((message) => message._id.toString());
  emitToRoom(`chat:${chat._id.toString()}`, 'message:read', {
    chatId: chat._id.toString(),
    readerId: userId,
    messageIds,
    readAt: readAt.toISOString()
  });
  chat.participants.forEach((participantId) => {
    emitToRoom(`user:${participantId.toString()}`, 'conversation:updated', {
      chatId: chat._id.toString(),
      incrementUnread: false,
      readerId: userId,
      readMessageIds: messageIds
    });
  });
  await emitGlobalUnreadCount(userId);

  return messageIds;
};

chatRoutes.get('/unread-count', authMiddleware, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const globalUnreadCount = await getGlobalUnreadCount(userId);
    return res.status(200).json({
      success: true,
      data: {
        globalUnreadCount
      }
    });
  } catch (error) {
    return next(error);
  }
});

chatRoutes.get('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const chats = await Chat.find({
      participants: userId
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate('participants', 'name email')
      .populate({
        path: 'rfq',
        select: 'title status city district',
        populate: [
          { path: 'city', select: 'name' },
          { path: 'district', select: 'name' }
        ]
      })
      .populate('buyer', 'name email')
      .populate('supplier', 'name email')
      .populate('offer');

    const chatIds = chats.map((chat) => chat._id);
    const unreadRows = chatIds.length
      ? await Message.aggregate([
          {
            $match: {
              chat: { $in: chatIds },
              sender: { $ne: new mongoose.Types.ObjectId(userId) },
              read: { $ne: true }
            }
          },
          { $group: { _id: '$chat', count: { $sum: 1 } } }
        ])
      : [];
    const unreadByChat = new Map(unreadRows.map((row) => [String(row._id), row.count]));
    const data = chats.map((chat) => ({
      ...chat.toObject(),
      unreadCount: unreadByChat.get(String(chat._id)) || 0
    }));

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    return next(error);
  }
});

chatRoutes.get('/:chatId/messages', authMiddleware, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found.'
      });
    }

    const isParticipant = chat.participants.some((item) => item.toString() === userId);
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Bu chat odasina erisim yetkiniz yok.'
      });
    }

    await markChatMessagesRead(chat, userId);

    const messages = await Message.find({ chat: chat._id }).sort({ createdAt: 1 }).populate('sender', 'name email');

    return res.status(200).json({
      success: true,
      data: messages.map((message) => serializeMessage(message))
    });
  } catch (error) {
    return next(error);
  }
});

chatRoutes.patch('/:chatId/read', authMiddleware, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found.'
      });
    }

    const isParticipant = chat.participants.some((item) => item.toString() === userId);
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Bu chat odasina erisim yetkiniz yok.'
      });
    }

    const messageIds = await markChatMessagesRead(chat, userId);
    return res.status(200).json({
      success: true,
      data: {
        chatId: chat._id.toString(),
        messageIds
      }
    });
  } catch (error) {
    return next(error);
  }
});

const createChatReport = async ({ req, res, next, messageId = null }) => {
  try {
    const userId = getUserId(req);
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found.' });
    }

    const participantIds = chat.participants.map((item) => item.toString());
    if (!participantIds.includes(userId)) {
      return res.status(403).json({ success: false, message: 'Bu chat odasina erisim yetkiniz yok.' });
    }

    const reason = String(req.body?.reason || '').trim();
    if (!CHAT_REPORT_REASONS.has(reason)) {
      return res.status(400).json({ success: false, message: 'Şikayet nedeni geçersiz.' });
    }

    let reportedUserId = participantIds.find((id) => id !== userId);
    let message = null;
    if (messageId) {
      message = await Message.findOne({ _id: messageId, chat: chat._id }).select('sender');
      if (!message) {
        return res.status(404).json({ success: false, message: 'Mesaj bulunamadı.' });
      }
      reportedUserId = message.sender.toString() === userId ? reportedUserId : message.sender.toString();
    }

    if (!reportedUserId) {
      return res.status(400).json({ success: false, message: 'Şikayet edilen kullanıcı bulunamadı.' });
    }

    const recentWindow = new Date(Date.now() - 10 * 60 * 1000);
    const duplicate = await ChatReport.exists({
      reporterId: userId,
      chatId: chat._id,
      messageId: message?._id || { $exists: false },
      createdAt: { $gte: recentWindow }
    });
    if (duplicate) {
      return res.status(409).json({ success: false, message: 'Bu şikayet kısa süre önce alındı.' });
    }

    const report = await ChatReport.create({
      reporterId: userId,
      reportedUserId,
      chatId: chat._id,
      messageId: message?._id,
      rfqId: chat.rfq || undefined,
      reason,
      note: String(req.body?.note || '').trim()
    });

    await logChatReportAction('chat_report_create', {
      reportId: report._id,
      chatId: chat._id,
      messageId: message?._id || null,
      reporterId: userId,
      reportedUserId,
      reason
    });
    emitToRoom('admin:chat-reports', 'chat:reported', {
      reportId: report._id.toString(),
      chatId: chat._id.toString(),
      messageId: message?._id?.toString?.() || null
    });

    return res.status(201).json({
      success: true,
      message: 'Şikayetiniz alındı.',
      data: report
    });
  } catch (error) {
    return next(error);
  }
};

chatRoutes.post('/:chatId/report', authMiddleware, (req, res, next) =>
  createChatReport({ req, res, next })
);

chatRoutes.post('/:chatId/messages/:messageId/report', authMiddleware, (req, res, next) =>
  createChatReport({ req, res, next, messageId: req.params.messageId })
);

chatRoutes.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const chat = await Chat.findById(req.params.id)
      .populate('participants', 'name email')
      .populate({
        path: 'rfq',
        select: 'title status city district',
        populate: [
          { path: 'city', select: 'name' },
          { path: 'district', select: 'name' }
        ]
      })
      .populate('buyer', 'name email')
      .populate('supplier', 'name email')
      .populate('offer');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found.'
      });
    }

    const isParticipant = chat.participants.some((item) => item._id.toString() === userId);
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Bu chat odasina erisim yetkiniz yok.'
      });
    }

    const blockState = await getChatBlockState(chat, userId);

    return res.status(200).json({
      success: true,
      data: {
        ...chat.toObject(),
        blockState
      }
    });
  } catch (error) {
    return next(error);
  }
});

chatRoutes.post('/rfq/:rfqId/with/:supplierId', authMiddleware, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const rfq = await RFQ.findById(req.params.rfqId);
    if (!rfq) {
      if (isDev) {
        console.log('[CHAT_START][CHAT404_RFQ_NOT_FOUND]', { actorId: userId, rfqId: req.params.rfqId });
      }
      return res.status(404).json({
        success: false,
        tag: 'CHAT404_RFQ_NOT_FOUND',
        message: 'RFQ not found.'
      });
    }

    const buyerId = rfq.buyer?.toString();
    if (!buyerId) {
      if (isDev) {
        console.log('[CHAT_START][CHAT400_NO_BUYER]', { actorId: userId, rfqId: rfq._id?.toString?.() || null });
      }
      return res.status(400).json({
        success: false,
        tag: 'CHAT400_NO_BUYER',
        message: 'RFQ sahibi bulunamadi.'
      });
    }

    const withUserId = String(req.params.supplierId || '').trim();
    const userRole = req.user?.role || '';
    const isBuyer = userId === buyerId;
    const isSeller = !isBuyer;
    const logForbidden = (reason, extra = {}) => {
      if (isDev) {
        console.warn('[chat-start][forbidden]', {
          reason,
          actorId: userId,
          actorRole: userRole,
          rfqId: rfq._id?.toString?.() || null,
          withUserId,
          buyerId,
          rfqStatus: rfq.status,
          ...extra
        });
      }
    };

    if (isDev) {
      console.log('[CHAT_START][REQUEST]', {
        actorId: userId,
        actorRole: userRole,
        rfqId: rfq._id?.toString?.() || null,
        withUserId,
        buyerId,
        actorIsBuyer: isBuyer
      });
    }

    if (userRole && !['buyer', 'seller', 'supplier'].includes(userRole)) {
      logForbidden('unsupported-role');
      return res.status(403).json({
        success: false,
        tag: 'CHAT403_UNSUPPORTED_ROLE',
        code: 'FORBIDDEN_UNSUPPORTED_ROLE',
        message: 'Forbidden.'
      });
    }

    let supplierId = '';
    if (isBuyer) {
      if (!withUserId) {
        return res.status(400).json({
          success: false,
          tag: 'CHAT400_BUYER_NO_SELLER',
          message: 'Gecerli bir tedarikci secilmelidir.'
        });
      }
      if (withUserId === buyerId) {
        return res.status(400).json({
          success: false,
          tag: 'CHAT400_BUYER_WITH_IS_BUYER',
          message: 'Gecerli bir tedarikci secilmelidir.'
        });
      }
      supplierId = withUserId;
      const offerExists = await Offer.exists({
        rfq: rfq._id,
        supplier: supplierId,
        status: { $ne: 'withdrawn' }
      });
      if (!offerExists) {
        logForbidden('buyer-invalid-supplier', {
          offerExists: false,
          withIsOfferSeller: false
        });
        return res.status(403).json({
          success: false,
          tag: 'CHAT403_BUYER_INVALID_SELLER',
          code: 'FORBIDDEN_BUYER_INVALID_SELLER',
          message: 'Bu kullaniciyla sohbet yetkin yok.'
        });
      }
    } else {
      supplierId = userId;
      const offerExists = await Offer.exists({ rfq: rfq._id, supplier: supplierId });
      if (!offerExists) {
        logForbidden('seller-without-offer', {
          offerExists: false,
          withIsBuyer: withUserId === buyerId
        });
        return res.status(403).json({
          success: false,
          tag: 'CHAT403_NOT_OFFERED',
          code: 'FORBIDDEN_SELLER_NO_OFFER',
          message: 'Sohbet icin once teklif vermelisin.'
        });
      }
    }

    const supplier = await User.findById(supplierId);
    if (!supplier) {
      if (isDev) {
        console.log('[CHAT_START][CHAT404_SUPPLIER]', { actorId: userId, supplierId });
      }
      return res.status(404).json({
        success: false,
        tag: 'CHAT404_SUPPLIER',
        message: 'Tedarikci bulunamadi.'
      });
    }

    let chat = await Chat.findOne({
      rfq: rfq._id,
      buyer: buyerId,
      supplier: supplierId
    });

    if (!chat) {
      if (isSeller) {
        if (isDev) {
          console.log('[CHAT_START][CHATWAIT_SELLER_WAIT_BUYER]', {
            actorId: userId,
            rfqId: rfq._id?.toString?.() || null,
            chatStatus: 'missing'
          });
        }
        return res.status(200).json({
          success: false,
          code: 'WAIT_BUYER',
          tag: 'CHATWAIT_SELLER_WAIT_BUYER',
          message: 'Alıcıdan haber bekle...'
        });
      }

      chat = await Chat.create({
        participants: [buyerId, supplierId],
        rfq: rfq._id,
        buyer: buyerId,
        supplier: supplierId,
        lastMessageAt: new Date(),
        status: 'pending',
        initiatedBy: 'buyer'
      });
    }

    if (isSeller && chat.status === 'pending') {
      if (isDev) {
        console.log('[CHAT_START][CHATWAIT_SELLER_WAIT_BUYER]', {
          actorId: userId,
          rfqId: rfq._id?.toString?.() || null,
          chatStatus: 'pending'
        });
      }
      return res.status(200).json({
        success: false,
        code: 'WAIT_BUYER',
        tag: 'CHATWAIT_SELLER_WAIT_BUYER',
        message: 'Alıcıdan haber bekle...'
      });
    }

    const populated = await Chat.findById(chat._id)
      .populate('participants', 'name email')
      .populate({
        path: 'rfq',
        select: 'title status city district',
        populate: [
          { path: 'city', select: 'name' },
          { path: 'district', select: 'name' }
        ]
      })
      .populate('buyer', 'name email')
      .populate('supplier', 'name email')
      .populate('offer');

    return res.status(200).json({
      success: true,
      data: {
        chat: populated
      }
    });
  } catch (error) {
    return next(error);
  }
});

chatRoutes.post('/:chatId/media', authMiddleware, apiRateLimit('chatMessage'), chatMediaUpload.single('file'), async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Görsel dosyası bulunamadı.'
      });
    }

    const chat = await Chat.findById(req.params.chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found.'
      });
    }

    const isParticipant = chat.participants.some((item) => item.toString() === userId);
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Bu chat odasina erisim yetkiniz yok.'
      });
    }

    const blockState = await getChatBlockState(chat, userId);
    if (blockState.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Bu kullanıcıyla mesajlaşamazsınız.'
      });
    }

    if (await hasActiveChatRestriction(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Mesajlaşma özelliğiniz geçici olarak kısıtlandı.'
      });
    }

    if (chat.status === 'pending' && chat.buyer?.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Alıcıdan ilk mesaj bekleniyor.'
      });
    }

    const uploaded = await uploadChatImage(req.file.buffer, {
      originalName: req.file.originalname || 'chat-image.webp',
      mimeType: req.file.mimetype,
      size: req.file.size
    });
    const message = await Message.create({
      chat: chat._id,
      sender: userId,
      type: 'image',
      content: '',
      mediaUrl: uploaded.url,
      mediaProvider: uploaded.provider,
      mediaPublicId: uploaded.publicId || '',
      mediaMimeType: uploaded.mimeType,
      mediaSize: uploaded.size,
      readBy: [userId]
    });

    if (chat.status === 'pending' && chat.buyer?.toString() === userId) {
      chat.status = 'active';
      chat.initiatedBy = 'buyer';
      chat.firstMessageAt = new Date();
    }

    chat.lastMessage = 'Fotoğraf gönderdi';
    chat.lastMessageAt = new Date();
    await chat.save();

    const populated = await Message.findById(message._id).populate('sender', 'name email');
    const payloadMessage = serializeMessage(populated);

    emitToRoom(`chat:${chat._id.toString()}`, 'message:new', {
      chatId: chat._id.toString(),
      message: payloadMessage
    });
    emitToRoom(`user:${userId}`, 'message:sent', {
      chatId: chat._id.toString(),
      message: payloadMessage
    });

    await Promise.all(
      chat.participants.map(async (participantId) => {
        const id = participantId.toString();
        if (id !== userId) {
          const senderName = populated.sender?.name || 'Bir kullanıcı';
          Notification.create({
            user: id,
            title: 'Yeni mesajınız var',
            body: 'Bir kullanıcı size fotoğraf gönderdi.',
            message: 'Bir kullanıcı size fotoğraf gönderdi.',
            type: 'chat_message',
            relatedId: chat._id,
            data: {
              chatId: chat._id.toString(),
              messageId: message._id.toString(),
              rfqId: chat.rfq?.toString?.() || null,
              senderId: userId,
              preview: 'Fotoğraf gönderdi'
            },
            targetType: 'chat',
            targetId: chat._id,
            targetUrl: `/messages/${chat._id}`
          }).catch(() => {});
          sendPushToUser({
            userId: id,
            type: 'chat_message',
            payload: {
              type: 'chat_message',
              targetType: 'chat',
              targetId: chat._id.toString(),
              chatId: chat._id.toString(),
              messageId: message._id.toString(),
              rfqId: chat.rfq?.toString?.() || null,
              senderId: userId
            },
            title: `${senderName} yeni mesaj gönderdi`,
            body: 'Fotoğraf gönderdi'
          }).catch((pushError) => {
            if (isDev) {
              console.warn('[chat-push][failed]', {
                chatId: chat._id.toString(),
                recipientId: id,
                reason: pushError?.message || 'unknown'
              });
            }
          });
        }
        emitToRoom(`user:${id}`, 'newMessage', {
          chatId: chat._id.toString(),
          message: payloadMessage
        });
        emitToRoom(`user:${id}`, 'conversation:updated', {
          chatId: chat._id.toString(),
          lastMessage: 'Fotoğraf gönderdi',
          lastMessageAt: chat.lastMessageAt,
          senderId: userId
        });
        emitToRoom(`user:${id}`, 'notification:new', {
          type: 'chat_message',
          chatId: chat._id.toString()
        });
        if (id !== userId) {
          await emitGlobalUnreadCount(id);
        }
      })
    );

    return res.status(201).json({
      success: true,
      data: payloadMessage
    });
  } catch (error) {
    return next(error);
  }
});

chatRoutes.post('/:chatId/message', authMiddleware, apiRateLimit('chatMessage'), async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const content = (req.body?.content || req.body?.text || '').trim();

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Mesaj bos olamaz.'
      });
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Mesaj en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir.`
      });
    }

    const chat = await Chat.findById(req.params.chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found.'
      });
    }

    const isParticipant = chat.participants.some((item) => item.toString() === userId);
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Bu chat odasina erisim yetkiniz yok.'
      });
    }

    const blockState = await getChatBlockState(chat, userId);
    if (blockState.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Bu kullanıcıyla mesajlaşamazsınız.'
      });
    }

    if (await hasActiveChatRestriction(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Mesajlaşma özelliğiniz geçici olarak kısıtlandı.'
      });
    }

    if (chat.status === 'pending' && chat.buyer?.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Alıcıdan ilk mesaj bekleniyor.'
      });
    }

    const moderation = analyzeChatMessage(content);
    const message = await Message.create({
      chat: chat._id,
      sender: userId,
      content,
      riskScore: moderation.riskScore,
      riskLevel: moderation.riskLevel,
      riskReasons: moderation.riskReasons,
      moderationStatus: moderation.moderationStatus,
      readBy: [userId]
    });
    if (moderation.moderationStatus === 'flagged') {
      await logChatModerationAction('chat_message_flagged', {
        chatId: chat._id,
        messageId: message._id,
        senderId: userId,
        riskScore: moderation.riskScore,
        riskLevel: moderation.riskLevel,
        riskReasons: moderation.riskReasons
      });
    }

    if (chat.status === 'pending' && chat.buyer?.toString() === userId) {
      chat.status = 'active';
      chat.initiatedBy = 'buyer';
      chat.firstMessageAt = new Date();
    }

    chat.lastMessage = content;
    chat.lastMessageAt = new Date();
    await chat.save();

    const populated = await Message.findById(message._id).populate('sender', 'name email');
    const payloadMessage = serializeMessage(populated);

    emitToRoom(`chat:${chat._id.toString()}`, 'message:new', {
      chatId: chat._id.toString(),
      message: payloadMessage
    });
    emitToRoom(`chat:${chat._id.toString()}`, 'newMessage', {
      chatId: chat._id.toString(),
      message: payloadMessage
    });
    emitToRoom(`user:${userId}`, 'message:sent', {
      chatId: chat._id.toString(),
      message: payloadMessage
    });
    await Promise.all(
      chat.participants.map(async (participantId) => {
        const id = participantId.toString();
        if (id !== userId) {
          const preview = content.length > 120 ? `${content.slice(0, 120)}...` : content;
          const pushPreview = content.length > 80 ? `${content.slice(0, 80)}...` : content;
          const senderName = populated.sender?.name || 'Bir kullanıcı';
          Notification.create({
            user: id,
            title: 'Yeni mesajınız var',
            body: 'Bir kullanıcı size yeni mesaj gönderdi.',
            message: 'Bir kullanıcı size yeni mesaj gönderdi.',
            type: 'chat_message',
            relatedId: chat._id,
            data: {
              chatId: chat._id.toString(),
              messageId: message._id.toString(),
              rfqId: chat.rfq?.toString?.() || null,
              senderId: userId,
              preview
            },
            targetType: 'chat',
            targetId: chat._id,
            targetUrl: `/messages/${chat._id}`
          }).catch(() => {});
          sendPushToUser({
            userId: id,
            type: 'chat_message',
            payload: {
              type: 'chat_message',
              targetType: 'chat',
              targetId: chat._id.toString(),
              chatId: chat._id.toString(),
              messageId: message._id.toString(),
              rfqId: chat.rfq?.toString?.() || null,
              senderId: userId
            },
            title: `${senderName} yeni mesaj gönderdi`,
            body: pushPreview
          }).catch((pushError) => {
            if (isDev) {
              console.warn('[chat-push][failed]', {
                chatId: chat._id.toString(),
                recipientId: id,
                reason: pushError?.message || 'unknown'
              });
            }
          });
        }
        emitToRoom(`user:${id}`, 'newMessage', {
          chatId: chat._id.toString(),
          message: payloadMessage
        });
        emitToRoom(id, 'newMessage', {
          chatId: chat._id.toString(),
          message: payloadMessage
        });
        emitToRoom(`user:${id}`, 'conversation:updated', {
          chatId: chat._id.toString(),
          lastMessage: content,
          lastMessageAt: chat.lastMessageAt,
          senderId: userId
        });
        emitToRoom(`user:${id}`, 'notification:new', {
          type: 'chat_message',
          chatId: chat._id.toString()
        });
        if (id !== userId) {
          await emitGlobalUnreadCount(id);
        }
      })
    );

    return res.status(201).json({
      success: true,
      data: payloadMessage
    });
  } catch (error) {
    return next(error);
  }
});

chatRoutes.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const chat = await Chat.findById(req.params.id);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found.'
      });
    }

    const isParticipant = chat.participants.some((item) => item.toString() === userId);
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Bu chat odasina erisim yetkiniz yok.'
      });
    }

    await Message.deleteMany({ chat: chat._id });
    await Chat.deleteOne({ _id: chat._id });

    return res.status(200).json({
      success: true,
      message: 'Chat silindi.'
    });
  } catch (error) {
    return next(error);
  }
});

export default chatRoutes;
