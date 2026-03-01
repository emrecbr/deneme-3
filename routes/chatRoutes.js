import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import Offer from '../models/Offer.js';
import RFQ from '../models/RFQ.js';
import User from '../models/User.js';
import { emitToRoom } from '../config/socket.js';

const chatRoutes = Router();

const getUserId = (req) => req.user?.id;
const isDev = process.env.NODE_ENV !== 'production';

chatRoutes.get('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const chats = await Chat.find({
      participants: userId
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate('participants', 'name email')
      .populate('rfq', 'title status')
      .populate('buyer', 'name email')
      .populate('supplier', 'name email')
      .populate('offer');

    return res.status(200).json({
      success: true,
      data: chats
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

    const messages = await Message.find({ chat: chat._id }).sort({ createdAt: 1 }).populate('sender', 'name email');

    return res.status(200).json({
      success: true,
      data: messages
    });
  } catch (error) {
    return next(error);
  }
});

chatRoutes.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const chat = await Chat.findById(req.params.id)
      .populate('participants', 'name email')
      .populate('rfq', 'title status')
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

    return res.status(200).json({
      success: true,
      data: chat
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
      .populate('rfq', 'title status')
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

chatRoutes.post('/:chatId/message', authMiddleware, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const content = (req.body?.content || req.body?.text || '').trim();

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Mesaj bos olamaz.'
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

    if (chat.status === 'pending' && chat.buyer?.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Alıcıdan ilk mesaj bekleniyor.'
      });
    }

    const message = await Message.create({
      chat: chat._id,
      sender: userId,
      content
    });

    if (chat.status === 'pending' && chat.buyer?.toString() === userId) {
      chat.status = 'active';
      chat.initiatedBy = 'buyer';
      chat.firstMessageAt = new Date();
    }

    chat.lastMessage = content;
    chat.lastMessageAt = new Date();
    await chat.save();

    const populated = await Message.findById(message._id).populate('sender', 'name email');

    emitToRoom(`chat:${chat._id.toString()}`, 'message:new', {
      chatId: chat._id.toString(),
      message: populated
    });
    emitToRoom(`chat:${chat._id.toString()}`, 'newMessage', {
      chatId: chat._id.toString(),
      message: populated
    });
    chat.participants.forEach((participantId) => {
      const id = participantId.toString();
      if (id !== userId) {
        const preview = content.length > 120 ? `${content.slice(0, 120)}...` : content;
        Notification.create({
          user: id,
          message: `Yeni mesaj: ${preview}`,
          type: 'message',
          relatedId: chat._id,
          data: {
            chatId: chat._id.toString(),
            rfqId: chat.rfq?.toString?.() || null,
            preview
          }
        }).catch(() => {});
      }
      emitToRoom(`user:${id}`, 'newMessage', {
        chatId: chat._id.toString(),
        message: populated
      });
      emitToRoom(id, 'newMessage', {
        chatId: chat._id.toString(),
        message: populated
      });
      emitToRoom(`user:${id}`, 'notification:new', {
        type: 'message',
        chatId: chat._id.toString()
      });
    });

    return res.status(201).json({
      success: true,
      data: populated
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
