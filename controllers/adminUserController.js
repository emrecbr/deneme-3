import mongoose from 'mongoose';
import User from '../models/User.js';
import RFQ from '../models/RFQ.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import AdminNote from '../models/AdminNote.js';

const normalize = (value) => String(value || '').trim();
const parsePage = (value) => Math.max(Number.parseInt(value, 10) || 1, 1);
const parseLimit = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 20;
  return Math.min(Math.max(parsed, 1), 100);
};

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
    // ignore audit errors
  }
};

export const listAdminUsers = async (req, res, next) => {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const q = normalize(req.query.q || req.query.search);
    const role = normalize(req.query.role);
    const status = normalize(req.query.status);

    const query = {};
    if (q) {
      query.$or = [
        { name: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
        { phone: new RegExp(q, 'i') }
      ];
    }
    if (role) {
      query.role = role;
    }
    if (status === 'active') {
      query.isActive = true;
      query.isDeleted = { $ne: true };
    } else if (status === 'passive') {
      query.isActive = false;
    } else if (status === 'blocked') {
      query.isDeleted = true;
    }

    const [items, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('name email phone role isActive isDeleted createdAt lastLoginAt')
        .lean(),
      User.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      items,
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const getAdminUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
    }

    const rfqs = await RFQ.find({ buyer: user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('_id title status createdAt city district')
      .lean();

    const notes = await AdminNote.find({ targetType: 'user', targetId: user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return res.status(200).json({ success: true, data: user, rfqs, notes });
  } catch (error) {
    return next(error);
  }
};

export const updateAdminUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body || {};
    const nextStatus = normalize(status);
    if (!nextStatus) {
      return res.status(400).json({ success: false, message: 'status zorunlu.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
    }

    if (nextStatus === 'active') {
      user.isActive = true;
      user.isDeleted = false;
    } else if (nextStatus === 'passive') {
      user.isActive = false;
    } else if (nextStatus === 'blocked') {
      user.isDeleted = true;
      user.isActive = false;
    }

    await user.save();

    await logAdminAction(req, 'user_status_update', {
      userId: user._id,
      status: nextStatus
    });

    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    return next(error);
  }
};

export const updateAdminUserRole = async (req, res, next) => {
  try {
    const { role } = req.body || {};
    const nextRole = normalize(role);
    if (!nextRole) {
      return res.status(400).json({ success: false, message: 'role zorunlu.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
    }

    user.role = nextRole;
    await user.save();

    await logAdminAction(req, 'user_role_update', {
      userId: user._id,
      role: nextRole
    });

    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    return next(error);
  }
};

export const addAdminUserNote = async (req, res, next) => {
  try {
    const { note } = req.body || {};
    if (!normalize(note)) {
      return res.status(400).json({ success: false, message: 'note zorunlu.' });
    }

    const userId = req.params.id;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'userId gecersiz.' });
    }

    const created = await AdminNote.create({
      targetType: 'user',
      targetId: userId,
      note: normalize(note),
      createdBy: req.admin?.id || null
    });

    await logAdminAction(req, 'user_note_create', { userId, noteId: created._id });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    return next(error);
  }
};

export const deleteAdminUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
    }

    user.isDeleted = true;
    user.isActive = false;
    await user.save();

    await logAdminAction(req, 'user_delete', { userId: user._id });

    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    return next(error);
  }
};
