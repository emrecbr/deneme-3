import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import AdminAuditLog from '../models/AdminAuditLog.js';

const ADMIN_TOKEN_COOKIE = 'admin_token';
const TOKEN_EXPIRES_IN = '7d';
const TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const ALLOWED_ROLES = new Set(['admin', 'moderator']);

const normalizeEmail = (value) =>
  String(value || '').trim().toLowerCase().replace(/\s+/g, '');

const signToken = (payload) => {
  if (!process.env.JWT_SECRET) {
    const error = new Error('JWT_SECRET is not defined in environment variables.');
    error.statusCode = 500;
    throw error;
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
};

const logAdminAction = async (req, admin, action, meta = {}) => {
  try {
    await AdminAuditLog.create({
      adminId: admin?._id || admin?.id || null,
      role: admin?.role,
      action,
      ip: req.headers['x-forwarded-for'] || req.ip,
      userAgent: req.headers['user-agent'] || '',
      meta
    });
  } catch (_error) {
    // Avoid blocking auth flow on audit log errors.
  }
};

export const adminLogin = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email ve şifre zorunludur.' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.password) {
      return res.status(401).json({ success: false, message: 'Geçersiz email veya şifre.' });
    }

    if (!ALLOWED_ROLES.has(user.role)) {
      return res.status(403).json({ success: false, message: 'Admin yetkisi gerekli.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Geçersiz email veya şifre.' });
    }

    const token = signToken({ id: user._id, role: user.role });
    res.cookie(ADMIN_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: TOKEN_MAX_AGE
    });

    await logAdminAction(req, user, 'admin_login');

    return res.status(200).json({
      token,
      admin: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const adminMe = async (req, res, next) => {
  try {
    if (!req.admin?.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }
    const user = await User.findById(req.admin.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Admin bulunamadı.' });
    }
    if (!ALLOWED_ROLES.has(user.role)) {
      return res.status(403).json({ success: false, message: 'Admin yetkisi gerekli.' });
    }

    return res.status(200).json({
      admin: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const adminLogout = async (req, res, next) => {
  try {
    if (req.admin?.id) {
      await logAdminAction(req, req.admin, 'admin_logout');
    }
    res.clearCookie(ADMIN_TOKEN_COOKIE);
    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
};
