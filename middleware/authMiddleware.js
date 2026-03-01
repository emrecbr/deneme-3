import jwt from 'jsonwebtoken';

const extractToken = (req) => {
  const cookieToken = req.cookies?.token;
  if (cookieToken) {
    return cookieToken;
  }

  const authorization = req.headers?.authorization || '';
  if (authorization.startsWith('Bearer ')) {
    return authorization.split(' ')[1];
  }

  return null;
};

const verifyAndAttachUser = (req, token) => {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  req.user = {
    id: payload?.id,
    role: payload?.role
  };
};

export const authMiddleware = (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: token not found.'
    });
  }

  try {
    verifyAndAttachUser(req, token);
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: invalid token payload.'
      });
    }
    return next();
  } catch (_error) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: invalid token.'
    });
  }
};

export const optionalAuthMiddleware = (req, _res, next) => {
  const token = extractToken(req);
  if (!token) {
    return next();
  }

  try {
    verifyAndAttachUser(req, token);
    if (!req.user?.id) {
      req.user = undefined;
    }
  } catch (_error) {
    // ignore invalid optional token and continue as guest
  }

  return next();
};
