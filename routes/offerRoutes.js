import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import Offer from '../models/Offer.js';
import { checkModeration } from '../src/utils/moderation.js';
import RFQ from '../models/RFQ.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import Chat from '../models/Chat.js';
import { emitToRoom } from '../config/socket.js';
import { sendPushToUser } from '../src/services/pushNotificationService.js';

const offerRoutes = Router();
const UPDATABLE_STATUSES = ['sent', 'viewed', 'countered'];
const FINAL_STATUSES = ['accepted', 'rejected', 'withdrawn', 'completed'];

const acceptOffer = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized.'
      });
    }

    const offer = await Offer.findById(req.params.offerId);
    const rfq = offer ? await RFQ.findById(offer.rfq) : null;

    if (!rfq || !offer) {
      throw new Error('RFQ veya Offer bulunamadi');
    }

    if (rfq.buyer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: only RFQ owner can accept an offer.'
      });
    }

    if (rfq.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: 'RFQ is not open for award.'
      });
    }

    if (offer.status === 'withdrawn' || offer.status === 'rejected') {
      return res.status(409).json({
        success: false,
        message: 'Withdrawn/rejected offer cannot be accepted.'
      });
    }

    offer.status = 'accepted';
    offer.timeline = Array.isArray(offer.timeline) ? offer.timeline : [];
    offer.timeline.push({ status: 'accepted', date: new Date() });
    await offer.save();

    await Offer.updateMany(
      { rfq: rfq._id, _id: { $ne: offer._id } },
      { $set: { status: 'rejected' } }
    );

    rfq.status = 'awarded';
    await rfq.save();

    const existingChat = await Chat.findOne({
      rfq: rfq._id,
      buyer: rfq.buyer,
      supplier: offer.supplier
    });

    let chat = existingChat;
    if (!existingChat) {
      const newChat = await Chat.create({
        participants: [rfq.buyer, offer.supplier],
        rfq: rfq._id,
        buyer: rfq.buyer,
        supplier: offer.supplier,
        lastMessageAt: new Date(),
        offer: offer._id
      });

      chat = newChat;
    } else {
      chat.offer = offer._id;
      chat.lastMessageAt = new Date();
      await chat.save();
    }

    await Promise.all(
      [rfq.buyer, offer.supplier].map(async (userId) => {
        const user = await User.findById(userId);
        if (!user) {
          return;
        }
        user.totalCompletedDeals = Number(user.totalCompletedDeals || 0) + 1;
        user.recomputeTrustScore();
        await user.save();
      })
    );

    const chatPayload = await Chat.findById(chat._id)
      .populate('participants', 'name email')
      .populate('rfq', 'title status');

    emitToRoom(`user:${rfq.buyer.toString()}`, 'chat_created', chatPayload);
    emitToRoom(`user:${offer.supplier.toString()}`, 'chat_created', chatPayload);
    emitToRoom(rfq.buyer.toString(), 'chat_created', chatPayload);
    emitToRoom(offer.supplier.toString(), 'chat_created', chatPayload);

    await Notification.create([
      {
        user: offer.supplier,
        message: `${rfq.title} talebindeki teklifiniz kabul edildi.`,
        type: 'offer_accepted',
        relatedId: offer._id,
        data: {
          rfqId: rfq._id,
          chatId: chat?._id || null,
          offerId: offer._id
        }
      },
      {
        user: rfq.buyer,
        message: `${rfq.title} talebindeki teklif kabul edildi.`,
        type: 'offer_accepted',
        relatedId: offer._id,
        data: {
          rfqId: rfq._id,
          chatId: chat?._id || null,
          offerId: offer._id
        }
      }
    ]);

    await sendPushToUser({
      userId: offer.supplier,
      type: 'offer_accepted',
      payload: {
        rfqId: rfq._id.toString(),
        offerId: offer._id.toString(),
        chatId: chat?._id?.toString?.() || null
      },
      title: 'Teklif kabul edildi',
      body: `${rfq.title} talebindeki teklifiniz kabul edildi.`
    });
    await sendPushToUser({
      userId: rfq.buyer,
      type: 'offer_accepted',
      payload: {
        rfqId: rfq._id.toString(),
        offerId: offer._id.toString(),
        chatId: chat?._id?.toString?.() || null
      },
      title: 'Teklif kabul edildi',
      body: `${rfq.title} talebindeki teklif kabul edildi.`
    });

    const offerAcceptedPayload = {
      offerId: offer._id.toString(),
      rfqId: rfq._id.toString(),
      chatId: chat?._id?.toString?.() || null,
      status: 'accepted'
    };

    emitToRoom(`user:${rfq.buyer.toString()}`, 'offer_accepted', offerAcceptedPayload);
    emitToRoom(`user:${offer.supplier.toString()}`, 'offer_accepted', offerAcceptedPayload);
    emitToRoom(`chat:${chat._id.toString()}`, 'offer:update', offerAcceptedPayload);
    emitToRoom(`user:${rfq.buyer.toString()}`, 'notification:new', {
      type: 'offer_accepted',
      rfqId: rfq._id.toString(),
      offerId: offer._id.toString()
    });
    emitToRoom(`user:${offer.supplier.toString()}`, 'notification:new', {
      type: 'offer_accepted',
      rfqId: rfq._id.toString(),
      offerId: offer._id.toString()
    });

    return res.status(200).json({
      success: true,
      data: offer,
      chatId: chat._id
    });
  } catch (error) {
    console.error('Offer accept error:', error);
    return next(error);
  }
};

const rejectOffer = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized.'
      });
    }

    const offer = await Offer.findById(req.params.offerId);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found.'
      });
    }

    const rfq = await RFQ.findById(offer.rfq);
    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found.'
      });
    }

    if (rfq.buyer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: only RFQ owner can reject an offer.'
      });
    }

    if (offer.status === 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Kabul edilmis teklif reddedilemez.'
      });
    }

    offer.status = 'rejected';
    offer.timeline = Array.isArray(offer.timeline) ? offer.timeline : [];
    offer.timeline.push({ status: 'rejected', date: new Date() });
    await offer.save();

    await Notification.create([
      {
        user: offer.supplier,
        message: `${rfq.title} talebindeki teklifiniz reddedildi.`,
        type: 'offer_rejected',
        relatedId: offer._id,
        data: {
          rfqId: rfq._id,
          offerId: offer._id
        }
      },
      {
        user: rfq.buyer,
        message: `${rfq.title} talebindeki teklif reddedildi.`,
        type: 'offer_rejected',
        relatedId: offer._id,
        data: {
          rfqId: rfq._id,
          offerId: offer._id
        }
      }
    ]);

    const chat = await Chat.findOne({
      rfq: rfq._id,
      buyer: rfq.buyer,
      supplier: offer.supplier
    });
    if (chat) {
      emitToRoom(`chat:${chat._id.toString()}`, 'offer:update', {
        offerId: offer._id.toString(),
        rfqId: rfq._id.toString(),
        chatId: chat._id.toString(),
        status: offer.status
      });
    }

    emitToRoom(`user:${rfq.buyer.toString()}`, 'notification:new', {
      type: 'offer_rejected',
      rfqId: rfq._id.toString(),
      offerId: offer._id.toString()
    });
    emitToRoom(`user:${offer.supplier.toString()}`, 'notification:new', {
      type: 'offer_rejected',
      rfqId: rfq._id.toString(),
      offerId: offer._id.toString()
    });

    return res.status(200).json({
      success: true,
      data: offer
    });
  } catch (error) {
    return next(error);
  }
};

offerRoutes.post('/:rfqId', authMiddleware, async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized.'
      });
    }

    const rfq = await RFQ.findById(req.params.rfqId);
    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found.'
      });
    }

    if (!rfq.buyer) {
      return res.status(400).json({
        success: false,
        message: 'RFQ sahibi bulunamadı.'
      });
    }

    if (rfq.buyer.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Kendi talebinize teklif veremezsiniz.'
      });
    }

    if (rfq.status === 'expired' || (rfq.expiresAt && new Date(rfq.expiresAt) <= new Date())) {
      rfq.status = 'expired';
      rfq.expiredAt = rfq.expiredAt || new Date();
      await rfq.save();
      return res.status(410).json({
        success: false,
        message: 'İlan süresi doldu.'
      });
    }

    if (rfq.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: 'Offers can only be submitted for open RFQs.'
      });
    }

    const { price, message, deliveryTime, quantity } = req.body;
    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Gecerli teklif fiyati zorunludur.'
      });
    }

    if (rfq.isAuction) {
      const bestOffer = Number.isFinite(Number(rfq.currentBestOffer)) ? Number(rfq.currentBestOffer) : Number.POSITIVE_INFINITY;
      if (!(numericPrice < bestOffer)) {
        return res.status(400).json({
          success: false,
          message: 'Acik arttirma modunda teklif mevcut en iyi tekliften dusuk olmali.'
        });
      }
    }

    const moderationResult = await checkModeration({
      userId: req.user.id,
      contentType: 'offer',
      title: rfq.title,
      description: message,
      sourceRoute: 'offer_create',
      sourceId: rfq._id
    });
    if (moderationResult.decision === 'review') {
      return res.status(422).json({
        success: false,
        code: 'MODERATION_REVIEW',
        message: 'İçeriğiniz incelemeye alındı. Kurallara uygunluğunu kontrol edin.'
      });
    }
    if (moderationResult.blocked) {
      return res.status(422).json({
        success: false,
        code: 'MODERATION_BLOCKED',
        message: 'İçeriğiniz topluluk kurallarına uygun olmadığı için gönderilemedi.'
      });
    }

    const existingActiveOffer = await Offer.findOne({
      rfq: rfq._id,
      supplier: req.user.id,
      status: { $nin: ['withdrawn', 'rejected', 'completed'] }
    });
    if (existingActiveOffer) {
      return res.status(409).json({
        success: false,
        code: 'OFFER_EXISTS',
        message: 'Bu talep icin aktif bir teklifiniz var.',
        offerId: existingActiveOffer._id
      });
    }

    const offer = await Offer.create({
      rfq: rfq._id,
      supplier: req.user.id,
      price: numericPrice,
      message,
      deliveryTime,
      quantity,
      status: 'sent',
      timeline: [{ status: 'sent', date: new Date() }]
    });

    rfq.offers.push(offer._id);
    if (rfq.isAuction) {
      rfq.currentBestOffer = numericPrice;
    }
    await rfq.save();

    const populatedOffer = await Offer.findById(offer._id).populate('supplier', 'name email');

    await Notification.create({
      user: rfq.buyer,
      message: `${rfq.title} talebine yeni bir teklif verildi.`,
      type: 'offer_created',
      relatedId: offer._id,
      data: {
        rfqId: rfq._id,
        offerId: offer._id,
        supplierId: offer.supplier
      }
    });

    await sendPushToUser({
      userId: rfq.buyer,
      type: 'offer_received',
      payload: {
        rfqId: rfq._id.toString(),
        offerId: offer._id.toString(),
        supplierId: offer.supplier.toString()
      },
      title: 'Yeni teklif',
      body: `${rfq.title} talebine yeni bir teklif verildi.`
    });

    emitToRoom(`user:${rfq.buyer.toString()}`, 'newOffer', {
      rfqId: rfq._id.toString(),
      offerId: offer._id.toString(),
      price: offer.price,
      deliveryTime: offer.deliveryTime
    });
    emitToRoom(`user:${rfq.buyer.toString()}`, 'notification:new', {
      type: 'offer_created',
      rfqId: rfq._id.toString(),
      offerId: offer._id.toString()
    });

    if (rfq.isAuction) {
      const bidPayload = {
        rfqId: rfq._id.toString(),
        offerId: offer._id.toString(),
        price: offer.price,
        supplier: populatedOffer?.supplier || null,
        currentBestOffer: rfq.currentBestOffer
      };
      emitToRoom(`rfq_${rfq._id.toString()}`, 'new_bid', bidPayload);
    }

    let chat = await Chat.findOne({
      rfq: rfq._id,
      buyer: rfq.buyer,
      supplier: offer.supplier
    });
    if (!chat) {
      chat = await Chat.create({
        participants: [rfq.buyer, offer.supplier],
        rfq: rfq._id,
        buyer: rfq.buyer,
        supplier: offer.supplier,
        lastMessageAt: new Date(),
        offer: offer._id,
        status: 'pending',
        initiatedBy: 'seller'
      });
    } else {
      chat.offer = offer._id;
      chat.lastMessageAt = new Date();
      await chat.save();
    }

    emitToRoom(`chat:${chat._id.toString()}`, 'offer:update', {
      offerId: offer._id.toString(),
      rfqId: rfq._id.toString(),
      chatId: chat._id.toString(),
      status: offer.status || 'sent',
      price: offer.price,
      deliveryTime: offer.deliveryTime
    });

    return res.status(201).json({
      success: true,
      data: offer
    });
  } catch (error) {
    return next(error);
  }
});

offerRoutes.patch('/:offerId', authMiddleware, async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized.'
      });
    }

    const offer = await Offer.findById(req.params.offerId);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found.'
      });
    }

    if (offer.supplier.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: only offer owner can update.'
      });
    }

    if (!UPDATABLE_STATUSES.includes(offer.status)) {
      return res.status(409).json({
        success: false,
        message: 'Offer cannot be updated.'
      });
    }

    const rfq = await RFQ.findById(offer.rfq);
    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found.'
      });
    }

    if (rfq.status !== 'open') {
      return res.status(409).json({
        success: false,
        message: 'RFQ is not open for updates.'
      });
    }

    const { price, deliveryTime, note, message, quantity } = req.body;
    const numericPrice = Number(price);
    if (Number.isFinite(numericPrice) && numericPrice > 0) {
      offer.price = numericPrice;
    }

    const numericDelivery = Number(deliveryTime);
    if (Number.isFinite(numericDelivery) && numericDelivery > 0) {
      offer.deliveryTime = numericDelivery;
    }

    const nextNote = typeof note === 'string' ? note : typeof message === 'string' ? message : null;
    if (nextNote !== null) {
      const moderationResult = await checkModeration({
        userId: req.user.id,
        contentType: 'offer',
        title: rfq.title,
        description: nextNote,
        sourceRoute: 'offer_update',
        sourceId: rfq._id
      });
      if (moderationResult.decision === 'review') {
        return res.status(422).json({
          success: false,
          code: 'MODERATION_REVIEW',
          message: 'İçeriğiniz incelemeye alındı. Kurallara uygunluğunu kontrol edin.'
        });
      }
      if (moderationResult.blocked) {
        return res.status(422).json({
          success: false,
          code: 'MODERATION_BLOCKED',
          message: 'İçeriğiniz topluluk kurallarına uygun olmadığı için güncellenemedi.'
        });
      }
      offer.message = nextNote;
    }
    if (Number.isFinite(Number(quantity)) && Number(quantity) > 0) {
      offer.quantity = Number(quantity);
    }

    offer.status = 'sent';
    offer.timeline = Array.isArray(offer.timeline) ? offer.timeline : [];
    offer.timeline.push({ status: 'sent', date: new Date() });

    await offer.save();

    let chat = await Chat.findOne({
      rfq: rfq._id,
      buyer: rfq.buyer,
      supplier: offer.supplier
    });
    if (!chat) {
      chat = await Chat.create({
        participants: [rfq.buyer, offer.supplier],
        rfq: rfq._id,
        buyer: rfq.buyer,
        supplier: offer.supplier,
        lastMessageAt: new Date(),
        offer: offer._id
      });
    } else if (!chat.offer) {
      chat.offer = offer._id;
      chat.lastMessageAt = new Date();
      await chat.save();
    }

    await Notification.create({
      user: rfq.buyer,
      message: `${rfq.title} talebindeki teklif guncellendi.`,
      type: 'offer_updated',
      relatedId: offer._id,
      data: {
        chatId: chat?._id || null,
        rfqId: rfq._id,
        offerId: offer._id
      }
    });

    emitToRoom(`chat:${chat._id.toString()}`, 'offer:update', {
      offer,
      chatId: chat._id.toString(),
      rfqId: rfq._id.toString()
    });
    emitToRoom(`user:${rfq.buyer.toString()}`, 'notification:new', {
      type: 'offer_updated',
      rfqId: rfq._id.toString(),
      offerId: offer._id.toString(),
      chatId: chat._id.toString()
    });

    return res.status(200).json({
      success: true,
      data: offer
    });
  } catch (error) {
    return next(error);
  }
});

offerRoutes.post('/:offerId/withdraw', authMiddleware, async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized.'
      });
    }

    const offer = await Offer.findById(req.params.offerId);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found.'
      });
    }

    if (offer.supplier.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: only offer owner can withdraw.'
      });
    }

    if (offer.status === 'accepted') {
      return res.status(409).json({
        success: false,
        message: 'Accepted offer cannot be withdrawn.'
      });
    }

    offer.status = 'withdrawn';
    offer.timeline = Array.isArray(offer.timeline) ? offer.timeline : [];
    offer.timeline.push({ status: 'withdrawn', date: new Date() });
    await offer.save();

    return res.status(200).json({
      success: true,
      data: offer
    });
  } catch (error) {
    return next(error);
  }
});

offerRoutes.post('/:offerId/viewed', authMiddleware, async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized.'
      });
    }

    const offer = await Offer.findById(req.params.offerId);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found.'
      });
    }

    const rfq = await RFQ.findById(offer.rfq);
    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found.'
      });
    }

    if (rfq.buyer?.toString?.() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden.'
      });
    }

    if (offer.status !== 'sent') {
      return res.status(200).json({
        success: true,
        data: offer
      });
    }

    offer.status = 'viewed';
    offer.viewedAt = new Date();
    offer.timeline = Array.isArray(offer.timeline) ? offer.timeline : [];
    offer.timeline.push({ status: 'viewed', date: new Date() });
    await offer.save();

    return res.status(200).json({
      success: true,
      data: offer
    });
  } catch (error) {
    return next(error);
  }
});

offerRoutes.post('/:offerId/counter', authMiddleware, async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized.'
      });
    }

    const offer = await Offer.findById(req.params.offerId);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found.'
      });
    }

    if (FINAL_STATUSES.includes(offer.status)) {
      return res.status(409).json({
        success: false,
        message: 'Offer cannot be countered.'
      });
    }

    const rfq = await RFQ.findById(offer.rfq);
    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found.'
      });
    }

    if (rfq.buyer?.toString?.() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden.'
      });
    }

    const { price, note } = req.body || {};
    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Gecerli karsi teklif fiyati zorunludur.'
      });
    }

    offer.counterOffer = {
      price: numericPrice,
      note: typeof note === 'string' ? note : ''
    };
    offer.status = 'countered';
    offer.timeline = Array.isArray(offer.timeline) ? offer.timeline : [];
    offer.timeline.push({ status: 'countered', date: new Date() });
    await offer.save();

    return res.status(200).json({
      success: true,
      data: offer
    });
  } catch (error) {
    return next(error);
  }
});

offerRoutes.get('/', authMiddleware, async (req, res, next) => {
  try {
    const query = {};
    if (req.query.user === 'currentUser') {
      query.supplier = req.user.id;
    }

    const offers = await Offer.find(query)
      .sort({ createdAt: -1 })
      .populate('rfq', 'title status city district')
      .populate('supplier', 'name email');

    return res.status(200).json({
      success: true,
      data: offers
    });
  } catch (error) {
    return next(error);
  }
});

offerRoutes.get('/rfq/:rfqId/me', authMiddleware, async (req, res, next) => {
  try {
    const offer = await Offer.findOne({
      rfq: req.params.rfqId,
      supplier: req.user.id
    })
      .sort({ createdAt: -1 })
      .populate('supplier', 'name email');

    return res.status(200).json({
      success: true,
      data: offer
    });
  } catch (error) {
    return next(error);
  }
});

offerRoutes.patch('/:offerId/accept', authMiddleware, acceptOffer);
offerRoutes.post('/:offerId/accept', authMiddleware, acceptOffer);

offerRoutes.patch('/:offerId/reject', authMiddleware, rejectOffer);
offerRoutes.post('/:offerId/reject', authMiddleware, rejectOffer);

export default offerRoutes;
