import mongoose from 'mongoose';
import Chat from '../models/Chat.js';
import ChatRestriction from '../models/ChatRestriction.js';
import ChatReport from '../models/ChatReport.js';
import Message from '../models/Message.js';
import RFQ from '../models/RFQ.js';
import User from '../models/User.js';
import UserBlock from '../models/UserBlock.js';
import AdminAuditLog from '../models/AdminAuditLog.js';

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 25;

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toObjectId = (value) => {
  const normalized = String(value || '').trim();
  return mongoose.isValidObjectId(normalized) ? new mongoose.Types.ObjectId(normalized) : null;
};

const compactUser = (user) => {
  if (!user) return null;
  return {
    id: user._id?.toString?.() || '',
    name: user.name || '',
    email: user.email || ''
  };
};

const compactRfq = (rfq) => {
  if (!rfq) return null;
  return {
    id: rfq._id?.toString?.() || '',
    title: rfq.title || '',
    status: rfq.status || ''
  };
};

const compactOffer = (offer) => {
  if (!offer) return null;
  return {
    id: offer._id?.toString?.() || '',
    status: offer.status || '',
    price: offer.price || 0
  };
};

const mergeCandidateIds = (current, nextIds) => {
  const next = new Set((nextIds || []).map((item) => item.toString()));
  return current ? new Set([...current].filter((item) => next.has(item))) : next;
};

export const listAdminChats = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || DEFAULT_LIMIT), 1), MAX_LIMIT);
    const skip = (page - 1) * limit;
    const q = String(req.query.q || '').trim();
    const hasReports = String(req.query.hasReports || '') === 'true';
    const hasUnread = String(req.query.hasUnread || '') === 'true';
    const hasMedia = String(req.query.hasMedia || '') === 'true';
    const hasBlocked = String(req.query.hasBlocked || '') === 'true';
    const hasRestricted = String(req.query.hasRestricted || '') === 'true';
    const status = String(req.query.status || '').trim();
    const reportStatus = String(req.query.reportStatus || '').trim();
    const riskLevel = String(req.query.riskLevel || '').trim();
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;
    const userId = toObjectId(req.query.userId);
    const rfqId = toObjectId(req.query.rfqId);

    const match = {};
    if (status) {
      match.status = status;
    }
    if (userId) {
      match.participants = userId;
    }
    if (rfqId) {
      match.rfq = rfqId;
    }
    if ((dateFrom && !Number.isNaN(dateFrom.getTime())) || (dateTo && !Number.isNaN(dateTo.getTime()))) {
      match.lastMessageAt = {};
      if (dateFrom && !Number.isNaN(dateFrom.getTime())) match.lastMessageAt.$gte = dateFrom;
      if (dateTo && !Number.isNaN(dateTo.getTime())) match.lastMessageAt.$lte = dateTo;
    }

    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      const [users, rfqs, messages] = await Promise.all([
        User.find({ $or: [{ name: regex }, { email: regex }] }).select('_id').limit(50).lean(),
        RFQ.find({ title: regex }).select('_id').limit(50).lean(),
        Message.find({ content: regex }).select('chat').limit(100).lean()
      ]);
      const userIds = users.map((item) => item._id);
      const rfqIds = rfqs.map((item) => item._id);
      const chatIds = messages.map((item) => item.chat).filter(Boolean);
      match.$or = [
        ...(userIds.length ? [{ participants: { $in: userIds } }] : []),
        ...(rfqIds.length ? [{ rfq: { $in: rfqIds } }] : []),
        ...(chatIds.length ? [{ _id: { $in: chatIds } }] : [])
      ];
      if (!match.$or.length) {
        return res.status(200).json({
          success: true,
          items: [],
          pagination: { page, limit, total: 0, hasMore: false }
        });
      }
    }

    let candidateIds = null;
    if (hasReports || reportStatus) {
      const reportMatch = {};
      if (reportStatus) reportMatch.status = reportStatus;
      const rows = await ChatReport.distinct('chatId', reportMatch);
      candidateIds = mergeCandidateIds(candidateIds, rows);
    }
    if (hasMedia) {
      const rows = await Message.distinct('chat', { type: 'image' });
      candidateIds = mergeCandidateIds(candidateIds, rows);
    }
    if (hasUnread) {
      const rows = await Message.distinct('chat', { read: { $ne: true } });
      candidateIds = mergeCandidateIds(candidateIds, rows);
    }
    if (riskLevel) {
      const rows = await Message.distinct('chat', { riskLevel });
      candidateIds = mergeCandidateIds(candidateIds, rows);
    }
    if (hasBlocked) {
      const blocks = await UserBlock.find({}).select('blockerId blockedUserId').lean();
      const blockedChatIds = blocks.length
        ? await Chat.distinct('_id', {
            $or: blocks.map((block) => ({
              participants: { $all: [block.blockerId, block.blockedUserId] }
            }))
          })
        : [];
      candidateIds = mergeCandidateIds(candidateIds, blockedChatIds);
    }
    if (hasRestricted) {
      const now = new Date();
      const restrictedUserIds = await ChatRestriction.distinct('userId', {
        liftedAt: { $exists: false },
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }]
      });
      const restrictedChatIds = restrictedUserIds.length
        ? await Chat.distinct('_id', { participants: { $in: restrictedUserIds } })
        : [];
      candidateIds = mergeCandidateIds(candidateIds, restrictedChatIds);
    }
    if (candidateIds) {
      const objectIds = [...candidateIds].filter(mongoose.isValidObjectId).map((id) => new mongoose.Types.ObjectId(id));
      if (!objectIds.length) {
        return res.status(200).json({
          success: true,
          items: [],
          pagination: { page, limit, total: 0, hasMore: false }
        });
      }
      match._id = { $in: objectIds };
    }

    const [total, chats] = await Promise.all([
      Chat.countDocuments(match),
      Chat.find(match)
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('participants', 'name email')
        .populate('buyer', 'name email')
        .populate('supplier', 'name email')
        .populate('rfq', 'title status')
        .populate('offer', 'status price')
        .lean()
    ]);

    const chatIds = chats.map((chat) => chat._id);
    const blockPairs = chats.flatMap((chat) => {
      const ids = (chat.participants || []).map((item) => item._id || item);
      if (ids.length < 2) return [];
      return [
        { blockerId: ids[0], blockedUserId: ids[1] },
        { blockerId: ids[1], blockedUserId: ids[0] }
      ];
    });

    const [reportRows, flaggedRows, unreadRows, mediaRows, blocks] = await Promise.all([
      chatIds.length
        ? ChatReport.aggregate([{ $match: { chatId: { $in: chatIds } } }, { $group: { _id: '$chatId', count: { $sum: 1 } } }])
        : [],
      chatIds.length
        ? Message.aggregate([
            { $match: { chat: { $in: chatIds }, moderationStatus: 'flagged' } },
            { $group: { _id: '$chat', count: { $sum: 1 }, maxRiskScore: { $max: '$riskScore' } } }
          ])
        : [],
      chatIds.length
        ? Message.aggregate([
            { $match: { chat: { $in: chatIds }, read: { $ne: true } } },
            { $group: { _id: '$chat', count: { $sum: 1 } } }
          ])
        : [],
      chatIds.length
        ? Message.aggregate([{ $match: { chat: { $in: chatIds }, type: 'image' } }, { $group: { _id: '$chat', count: { $sum: 1 } } }])
        : [],
      blockPairs.length
        ? UserBlock.find({
            $or: blockPairs
          }).lean()
        : []
    ]);

    const reportByChat = new Map(reportRows.map((row) => [String(row._id), row.count]));
    const flaggedByChat = new Map(flaggedRows.map((row) => [String(row._id), row]));
    const unreadByChat = new Map(unreadRows.map((row) => [String(row._id), row.count]));
    const mediaByChat = new Map(mediaRows.map((row) => [String(row._id), row.count]));
    const blockKeys = new Set(
      blocks.flatMap((block) => [
        `${String(block.blockerId)}:${String(block.blockedUserId)}`,
        `${String(block.blockedUserId)}:${String(block.blockerId)}`
      ])
    );

    const items = chats.map((chat) => {
      const participantIds = (chat.participants || []).map((item) => String(item._id || item));
      const hasBlockedParticipant =
        participantIds.length >= 2 && blockKeys.has(`${participantIds[0]}:${participantIds[1]}`);
      const flagged = flaggedByChat.get(String(chat._id));
      return {
        chatId: chat._id.toString(),
        participants: (chat.participants || []).map(compactUser).filter(Boolean),
        buyer: compactUser(chat.buyer),
        supplier: compactUser(chat.supplier),
        rfq: compactRfq(chat.rfq),
        offer: compactOffer(chat.offer),
        lastMessagePreview: String(chat.lastMessage || '').slice(0, 120),
        lastMessageAt: chat.lastMessageAt || chat.updatedAt,
        unreadTotal: unreadByChat.get(String(chat._id)) || 0,
        reportCount: reportByChat.get(String(chat._id)) || 0,
        flaggedMessageCount: flagged?.count || 0,
        maxRiskScore: flagged?.maxRiskScore || 0,
        mediaMessageCount: mediaByChat.get(String(chat._id)) || 0,
        moderationStatus: flagged?.count > 0 ? 'flagged' : 'clean',
        status: chat.status || '',
        hasBlockedParticipant
      };
    });

    return res.status(200).json({
      success: true,
      items,
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

export const getAdminChat = async (req, res, next) => {
  try {
    const chatId = toObjectId(req.params.chatId);
    if (!chatId) {
      return res.status(404).json({ success: false, message: 'Chat bulunamadı.' });
    }

    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100);
    const skip = (page - 1) * limit;

    const chat = await Chat.findById(chatId)
      .populate('participants', 'name email')
      .populate('buyer', 'name email')
      .populate('supplier', 'name email')
      .populate({
        path: 'rfq',
        select: 'title status city district',
        populate: [
          { path: 'city', select: 'name' },
          { path: 'district', select: 'name' }
        ]
      })
      .populate('offer', 'status price deliveryTime')
      .lean();

    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat bulunamadı.' });
    }

    const participantIds = (chat.participants || []).map((item) => item._id || item);
    const [totalMessages, messages, reports, blocks, restrictions, moderationRows] = await Promise.all([
      Message.countDocuments({ chat: chat._id }),
      Message.find({ chat: chat._id })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .populate('sender', 'name email')
        .lean(),
      ChatReport.find({ chatId: chat._id })
        .sort({ createdAt: -1 })
        .populate('reporterId', 'name email')
        .populate('reportedUserId', 'name email')
        .populate('messageId', 'content type mediaUrl createdAt')
        .lean(),
      participantIds.length >= 2
        ? UserBlock.find({
            $or: [
              { blockerId: participantIds[0], blockedUserId: participantIds[1] },
              { blockerId: participantIds[1], blockedUserId: participantIds[0] }
            ]
          }).lean()
        : [],
      participantIds.length ? ChatRestriction.find({ userId: { $in: participantIds }, liftedAt: { $exists: false } }).lean() : [],
      Message.aggregate([
        { $match: { chat: chat._id } },
        {
          $group: {
            _id: '$moderationStatus',
            count: { $sum: 1 },
            maxRiskScore: { $max: '$riskScore' }
          }
        }
      ])
    ]);

    const moderationSummary = moderationRows.reduce(
      (acc, row) => {
        const key = row._id || 'clean';
        acc.byStatus[key] = row.count;
        acc.maxRiskScore = Math.max(acc.maxRiskScore, Number(row.maxRiskScore || 0));
        if (key === 'flagged') {
          acc.flaggedMessageCount = row.count;
        }
        return acc;
      },
      { byStatus: {}, flaggedMessageCount: 0, maxRiskScore: 0 }
    );

    return res.status(200).json({
      success: true,
      data: {
        chat: {
          chatId: chat._id.toString(),
          participants: (chat.participants || []).map(compactUser).filter(Boolean),
          buyer: compactUser(chat.buyer),
          supplier: compactUser(chat.supplier),
          rfq: chat.rfq
            ? {
                ...compactRfq(chat.rfq),
                city: chat.rfq.city?.name || '',
                district: chat.rfq.district?.name || ''
              }
            : null,
          offer: compactOffer(chat.offer),
          status: chat.status || '',
          lastMessagePreview: String(chat.lastMessage || '').slice(0, 120),
          lastMessageAt: chat.lastMessageAt || chat.updatedAt,
          hasBlockedParticipant: blocks.length > 0,
          blockStatus: blocks.map((block) => ({
            blockerId: String(block.blockerId),
            blockedUserId: String(block.blockedUserId),
            createdAt: block.createdAt
          })),
          restrictions: restrictions.map((restriction) => ({
            restrictionId: restriction._id.toString(),
            userId: String(restriction.userId),
            reason: restriction.reason || '',
            scope: restriction.scope || 'chat',
            expiresAt: restriction.expiresAt || null,
            createdAt: restriction.createdAt,
            active: !restriction.liftedAt && (!restriction.expiresAt || new Date(restriction.expiresAt) > new Date())
          })),
          moderationSummary
        },
        messages: messages.map((message) => ({
          messageId: message._id.toString(),
          sender: compactUser(message.sender),
          type: message.type || 'text',
          text: message.content || '',
          mediaUrl: message.mediaUrl || '',
          mediaMimeType: message.mediaMimeType || '',
          createdAt: message.createdAt,
          readAt: message.readAt || null,
          riskScore: Number(message.riskScore || 0),
          riskLevel: message.riskLevel || 'low',
          riskReasons: Array.isArray(message.riskReasons) ? message.riskReasons : [],
          moderationStatus: message.moderationStatus || 'clean'
        })),
        reports,
        pagination: {
          page,
          limit,
          total: totalMessages,
          hasMore: skip + messages.length < totalMessages
        }
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const listAdminUserChatRestrictions = async (req, res, next) => {
  try {
    const userId = toObjectId(req.params.userId);
    if (!userId) {
      return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
    }
    const items = await ChatRestriction.find({ userId }).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, items });
  } catch (error) {
    return next(error);
  }
};

export const listAdminChatRestrictions = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || DEFAULT_LIMIT), 1), MAX_LIMIT);
    const skip = (page - 1) * limit;
    const status = String(req.query.status || 'active').trim();
    const now = new Date();
    const match = {};

    if (status === 'active') {
      match.liftedAt = { $exists: false };
      match.$or = [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }];
    } else if (status === 'lifted') {
      match.liftedAt = { $exists: true };
    }

    const [total, restrictions] = await Promise.all([
      ChatRestriction.countDocuments(match),
      ChatRestriction.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email')
        .populate('createdBy', 'name email')
        .populate('liftedBy', 'name email')
        .lean()
    ]);

    const items = restrictions.map((restriction) => {
      const active =
        !restriction.liftedAt && (!restriction.expiresAt || new Date(restriction.expiresAt).getTime() > now.getTime());
      return {
        restrictionId: restriction._id.toString(),
        user: compactUser(restriction.userId),
        reason: restriction.reason || '',
        scope: restriction.scope || 'chat',
        expiresAt: restriction.expiresAt || null,
        createdAt: restriction.createdAt,
        createdBy: compactUser(restriction.createdBy),
        liftedAt: restriction.liftedAt || null,
        liftedBy: compactUser(restriction.liftedBy),
        active
      };
    });

    return res.status(200).json({
      success: true,
      items,
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

export const createAdminUserChatRestriction = async (req, res, next) => {
  try {
    const userId = toObjectId(req.params.userId);
    if (!userId) {
      return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
    }

    const reason = String(req.body?.reason || '').trim();
    if (!reason) {
      return res.status(400).json({ success: false, message: 'Kısıtlama sebebi zorunludur.' });
    }
    const scope = ['chat', 'platform'].includes(req.body?.scope) ? req.body.scope : 'chat';
    const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
    const restriction = await ChatRestriction.create({
      userId,
      reason,
      scope,
      expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : undefined,
      createdBy: req.user?.id || undefined
    });

    try {
      await AdminAuditLog.create({
        adminId: req.user?.id || null,
        role: req.user?.role === 'moderator' ? 'moderator' : 'admin',
        action: 'chat_user_restrict',
        meta: {
          userId,
          restrictionId: restriction._id,
          scope,
          expiresAt: restriction.expiresAt || null
        }
      });
    } catch (_error) {
      // audit failure must not block restriction action
    }

    return res.status(201).json({ success: true, data: restriction });
  } catch (error) {
    return next(error);
  }
};

export const removeAdminUserChatRestriction = async (req, res, next) => {
  try {
    const userId = toObjectId(req.params.userId);
    const restrictionId = toObjectId(req.params.restrictionId);
    if (!userId || !restrictionId) {
      return res.status(404).json({ success: false, message: 'Kısıtlama bulunamadı.' });
    }
    const restriction = await ChatRestriction.findOne({ _id: restrictionId, userId });
    if (!restriction) {
      return res.status(404).json({ success: false, message: 'Kısıtlama bulunamadı.' });
    }

    restriction.liftedAt = new Date();
    restriction.liftedBy = req.user?.id || undefined;
    await restriction.save();

    try {
      await AdminAuditLog.create({
        adminId: req.user?.id || null,
        role: req.user?.role === 'moderator' ? 'moderator' : 'admin',
        action: 'chat_user_restriction_remove',
        meta: {
          userId,
          restrictionId
        }
      });
    } catch (_error) {
      // audit failure must not block restriction action
    }

    return res.status(200).json({ success: true, data: restriction });
  } catch (error) {
    return next(error);
  }
};

export const updateAdminChatMessageModeration = async (req, res, next) => {
  try {
    const chatId = toObjectId(req.params.chatId);
    const messageId = toObjectId(req.params.messageId);
    if (!chatId || !messageId) {
      return res.status(404).json({ success: false, message: 'Mesaj bulunamadı.' });
    }

    const message = await Message.findOne({ _id: messageId, chat: chatId });
    if (!message) {
      return res.status(404).json({ success: false, message: 'Mesaj bulunamadı.' });
    }

    const moderationStatus = String(req.body?.moderationStatus || '').trim();
    if (!['clean', 'flagged', 'reviewed', 'dismissed'].includes(moderationStatus)) {
      return res.status(400).json({ success: false, message: 'Moderasyon durumu geçersiz.' });
    }

    if (moderationStatus === 'flagged') {
      message.riskScore = Math.max(Number(req.body?.riskScore || 60), 35);
      message.riskLevel = message.riskScore >= 70 ? 'high' : 'medium';
      message.riskReasons = Array.isArray(req.body?.riskReasons) && req.body.riskReasons.length
        ? req.body.riskReasons.map((item) => String(item).trim()).filter(Boolean)
        : ['Admin tarafından riskli işaretlendi'];
    } else if (moderationStatus === 'dismissed' || moderationStatus === 'clean') {
      message.riskScore = 0;
      message.riskLevel = 'low';
      message.riskReasons = [];
    }
    message.moderationStatus = moderationStatus;
    await message.save();

    const auditAction =
      moderationStatus === 'flagged'
        ? 'chat_message_flagged'
        : moderationStatus === 'dismissed' || moderationStatus === 'clean'
          ? 'chat_message_dismissed'
          : 'chat_message_reviewed';
    try {
      await AdminAuditLog.create({
        adminId: req.user?.id || null,
        role: req.user?.role === 'moderator' ? 'moderator' : 'admin',
        action: auditAction,
        meta: {
          chatId,
          messageId,
          moderationStatus,
          riskScore: message.riskScore,
          riskLevel: message.riskLevel
        }
      });
    } catch (_error) {
      // audit failure must not block moderation action
    }

    return res.status(200).json({
      success: true,
      data: {
        messageId: message._id.toString(),
        riskScore: message.riskScore,
        riskLevel: message.riskLevel,
        riskReasons: message.riskReasons,
        moderationStatus: message.moderationStatus
      }
    });
  } catch (error) {
    return next(error);
  }
};
