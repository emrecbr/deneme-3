import jwt from 'jsonwebtoken';

const ADMIN_TOKEN_COOKIE = 'admin_token';
const ALLOWED_ROLES = new Set(['admin', 'moderator']);

const getTokenFromRequest = (req) => {
  const cookieToken = req.cookies?.[ADMIN_TOKEN_COOKIE];
  if (cookieToken) {
    return cookieToken;
  }
  const mainCookie = req.cookies?.token;
  if (mainCookie) {
    return mainCookie;
  }
  const authorization = req.headers?.authorization || '';
  if (authorization.startsWith('Bearer ')) {
    return authorization.split(' ')[1];
  }
  return null;
};

const verifyToken = (token) => {
  if (!process.env.JWT_SECRET) {
    const error = new Error('JWT_SECRET is not defined in environment variables.');
    error.statusCode = 500;
    throw error;
  }
  return jwt.verify(token, process.env.JWT_SECRET);
};

export const adminAuthMiddleware = (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized: admin token not found.' });
    }

    const payload = verifyToken(token);
    if (!payload?.id || !payload?.role) {
      return res.status(401).json({ success: false, message: 'Unauthorized: invalid admin token payload.' });
    }

    if (!ALLOWED_ROLES.has(payload.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: admin role required.' });
    }

    req.admin = {
      id: payload.id,
      role: payload.role
    };
    return next();
  } catch (_error) {
    return res.status(401).json({ success: false, message: 'Unauthorized: invalid admin token.' });
  }
};

export const requireAdminRole = (req, res, next) => {
  if (req.admin?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden: admin role required.' });
  }
  return next();
};
