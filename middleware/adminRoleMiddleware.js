import { authMiddleware } from './authMiddleware.js';
import AdminAuditLog from '../models/AdminAuditLog.js';

const ALLOWED_ROLES = new Set(['admin', 'moderator']);

export const adminRoleMiddleware = (req, res, next) => {
  authMiddleware(req, res, () => {
    const role = req.user?.role;
    if (!ALLOWED_ROLES.has(role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: admin role required.' });
    }
    req.admin = {
      id: req.user.id,
      role
    };
    return next();
  });
};

export const requireAdminOnly = (req, res, next) => {
  if (req.admin?.role !== 'admin') {
    AdminAuditLog.create({
      adminId: req.admin?.id || null,
      role: req.admin?.role || null,
      action: 'permission_denied',
      ip: req.headers['x-forwarded-for'] || req.ip,
      userAgent: req.headers['user-agent'] || '',
      meta: { path: req.originalUrl, method: req.method }
    }).catch(() => null);
    return res.status(403).json({ success: false, message: 'Forbidden: admin role required.' });
  }
  return next();
};
