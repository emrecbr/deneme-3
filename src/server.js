import http from 'http';
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { connectDB } from '../config/db.js';
import { setIO } from '../config/socket.js';
import mainRouter from '../routes/index.js';
import authRoutes from '../routes/authRoutes.js';
import adminAuthRoutes from '../routes/adminAuthRoutes.js';
import rfqRoutes from '../routes/rfqRoutes.js';
import offerRoutes from '../routes/offerRoutes.js';
import notificationRoutes from '../routes/notificationRoutes.js';
import chatRoutes from '../routes/chatRoutes.js';
import usersRoutes from '../routes/usersRoutes.js';
import addressRoutes from '../routes/addressRoutes.js';
import carsRoutes from '../routes/carsRoutes.js';
import adminRoutes from '../routes/adminRoutes.js';
import categoryRoutes from '../routes/categoryRoutes.js';
import locationRoutes from '../routes/locationRoutes.js';
import billingRoutes from '../routes/billingRoutes.js';
import otpRoutes from '../routes/otpRoutes.js';
import verifyRoutes from '../routes/verifyRoutes.js';
import searchRoutes from '../routes/searchRoutes.js';
import contentRoutes from '../routes/contentRoutes.js';
import rfqFlowRoutes from '../routes/rfqFlowRoutes.js';
import mapRoutes from '../routes/mapRoutes.js';
import reportRoutes from '../routes/reportRoutes.js';
import monetizationRoutes from '../routes/monetizationRoutes.js';
import alertRoutes from '../routes/alertRoutes.js';
import City from '../models/City.js';
import RFQ from '../models/RFQ.js';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import AppSetting from '../models/AppSetting.js';
import iyzico from './providers/iyzico/index.js';
import { ensureAdminSeed } from './utils/adminSeed.js';
import { getAllowedSurfaceOrigins } from './config/surfaceConfig.js';

dotenv.config();

const app = express();
const maskEnv = (value) => {
  if (!value) return 'missing';
  const str = String(value);
  if (str.length <= 4) return `set (${str.length} chars)`;
  return `set (****${str.slice(-4)})`;
};
const logEnvPresence = () => {
  const keys = [
    'SMS_PROVIDER',
    'ILETIMERKEZI_API_KEY',
    'ILETIMERKEZI_SENDER',
    'ILETIMERKEZI_BASE_URL',
    'BREVO_SMTP_HOST',
    'BREVO_SMTP_PORT',
    'BREVO_SMTP_USER',
    'BREVO_SMTP_PASS',
    'SENDGRID_API_KEY',
    'MAIL_FROM',
    'EMAIL_FROM',
    'APP_BASE_URL',
    'APP_SURFACE_URL',
    'WEB_BASE_URL',
    'ADMIN_BASE_URL',
    'API_BASE_URL'
  ];
  console.log('ENV CHECK (masked):');
  keys.forEach((key) => {
    console.log(`- ${key}: ${maskEnv(process.env[key])}`);
  });
};
logEnvPresence();
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const ALLOWED_ORIGINS = getAllowedSurfaceOrigins();
const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return true;
  return false;
};
const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'Cache-Control'],
  optionsSuccessStatus: 204
};
const ROUTE_MOUNTS = [
  ['/api', mainRouter],
  ['/api/auth', authRoutes],
  ['/api/admin/auth', adminAuthRoutes],
  ['/api/rfq', rfqRoutes],
  ['/api/offers', offerRoutes],
  ['/api/notifications', notificationRoutes],
  ['/api/chats', chatRoutes],
  ['/api/users', usersRoutes],
  ['/api/addresses', addressRoutes],
  ['/api/cars', carsRoutes],
  ['/api/admin', adminRoutes],
  ['/api/categories', categoryRoutes],
  ['/api/location', locationRoutes],
  ['/api/billing', billingRoutes],
  ['/api/auth/otp', otpRoutes],
  ['/api/auth/verify', verifyRoutes],
  ['/api/search', searchRoutes],
  ['/api/content', contentRoutes],
  ['/api/rfq-flow', rfqFlowRoutes],
  ['/api/map', mapRoutes],
  ['/api/reports', reportRoutes],
  ['/api', monetizationRoutes],
  ['/api', alertRoutes]
];
const onlineUsers = new Set();
const normalizeCity = (cityValue) => String(cityValue || '').trim().toLowerCase();
let premiumSweepTimer = null;
let subscriptionCancelTimer = null;

const logMountedRoutes = () => {
  console.log('Mounted routes:');
  console.log('GET /health');

  ROUTE_MOUNTS.forEach(([basePath, router]) => {
    if (!router?.stack) {
      return;
    }

    router.stack
      .filter((layer) => layer.route)
      .forEach((layer) => {
        const methods = Object.keys(layer.route.methods)
          .map((method) => method.toUpperCase())
          .join(',');
        const routePath = layer.route.path === '/' ? '' : layer.route.path;

        console.log(`${methods} ${basePath}${routePath}`);
      });
  });
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use('/api/billing/webhook/iyzico', express.raw({ type: '*/*' }));
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/billing/webhook/iyzico')) {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body;
    }
    return next();
  }
  return express.json()(req, res, next);
});
app.use(express.urlencoded({ extended: true }));
app.set('etag', false);
app.use(cookieParser());
const uploadsDir = path.resolve('uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

let maintenanceCache = { enabled: false, message: 'Sistem bakımda.', ts: 0 };
const MAINTENANCE_TTL_MS = 15000;
const getMaintenanceState = async () => {
  const now = Date.now();
  if (now - maintenanceCache.ts < MAINTENANCE_TTL_MS) {
    return maintenanceCache;
  }
  try {
    const doc = await AppSetting.findOne({ key: 'maintenance_mode' }).lean();
    maintenanceCache = {
      enabled: Boolean(doc?.value?.enabled),
      message: doc?.value?.message || 'Sistem bakımda.',
      ts: now
    };
  } catch (_error) {
    maintenanceCache.ts = now;
  }
  return maintenanceCache;
};

app.use(async (req, res, next) => {
  if (!req.originalUrl.startsWith('/api')) {
    return next();
  }
  if (req.originalUrl.startsWith('/api/admin') || req.originalUrl.startsWith('/api/health')) {
    return next();
  }
  if (req.originalUrl.startsWith('/api/system/maintenance')) {
    return next();
  }
  if (req.originalUrl.startsWith('/api/auth')) {
    return next();
  }
  const maintenance = await getMaintenanceState();
  if (maintenance.enabled) {
    return res.status(503).json({
      success: false,
      maintenance: true,
      message: maintenance.message
    });
  }
  return next();
});

app.get('/health', (_req, res) => res.send('OK'));

ROUTE_MOUNTS.forEach(([path, router]) => {
  app.use(path, router);
});

app.use((err, req, res, _next) => {
  console.error('API_ERROR', req.method, req.originalUrl, err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Sunucu hatası'
  });
});

const startServer = async () => {
  logMountedRoutes();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error(`Socket CORS blocked: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST']
    }
  });

  global.io = io;
  app.set('io', io);
  setIO(io);
  console.log('SOCKET SERVER INITIALIZED');

  io.on('connection', (socket) => {
    onlineUsers.add(socket.id);
    io.emit('online_count', onlineUsers.size);
    console.log(`SOCKET CONNECTED: ${socket.id}`);

    const userId = socket.handshake.query?.userId;
    if (userId) {
      socket.join(String(userId));
      socket.join(`user:${String(userId)}`);
    }

    const city = normalizeCity(socket.handshake.query?.city);
    if (city) {
      socket.join(`city_${city}`);
    }

    socket.on('join_city', (cityName) => {
      const normalized = normalizeCity(cityName);
      if (!normalized) {
        return;
      }
      socket.join(`city_${normalized}`);
    });

    socket.on('leave_city', (cityName) => {
      const normalized = normalizeCity(cityName);
      if (!normalized) {
        return;
      }
      socket.leave(`city_${normalized}`);
    });

    socket.on('join_rfq', (rfqId) => {
      const roomId = String(rfqId || '').trim();
      if (!roomId) {
        return;
      }
      socket.join(`rfq_${roomId}`);
    });

    socket.on('leave_rfq', (rfqId) => {
      const roomId = String(rfqId || '').trim();
      if (!roomId) {
        return;
      }
      socket.leave(`rfq_${roomId}`);
    });

    socket.on('join_chat', (chatId) => {
      const roomId = String(chatId || '').trim();
      if (!roomId) {
        return;
      }
      socket.join(`chat:${roomId}`);
    });

    socket.on('leave_chat', (chatId) => {
      const roomId = String(chatId || '').trim();
      if (!roomId) {
        return;
      }
      socket.leave(`chat:${roomId}`);
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(socket.id);
      io.emit('online_count', onlineUsers.size);
      console.log(`SOCKET DISCONNECTED: ${socket.id}`);
    });
  });

  const connectWithRetry = async (attempts = 5, delayMs = 3000) => {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await connectDB();
        console.log('Connected DB:', mongoose.connection.name);
        return;
      } catch (error) {
        console.error(`MongoDB bağlantı denemesi ${attempt}/${attempts} başarısız:`, error?.message || error);
        if (attempt === attempts) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  };

  try {
    await connectWithRetry();
    await ensureAdminSeed();
  } catch (_err) {
    console.error('MongoDB bağlantısı kurulamadı. Sunucu başlatılmadı.');
    process.exit(1);
  }

  server.listen(PORT, HOST, () => {
    console.log(`Server running on ${HOST}:${PORT}`);
    Promise.all([City.countDocuments(), RFQ.countDocuments()])
      .then(([cityCount, rfqCount]) => {
        console.log('Total cities count:', cityCount);
        console.log('Total rfq count:', rfqCount);
      })
      .catch((error) => {
        console.error('Startup count log failed:', error?.message || error);
      });

    if (!premiumSweepTimer) {
      premiumSweepTimer = setInterval(async () => {
        try {
          const now = new Date();
          const expiredUsers = await User.find({
            isPremium: true,
            premiumUntil: { $lte: now }
          });

          if (!expiredUsers.length) {
            return;
          }

          await Promise.all(
            expiredUsers.map(async (user) => {
              user.isPremium = false;
              user.premiumUntil = null;
              user.recomputeTrustScore();
              await user.save();
            })
          );
        } catch (_error) {
          // silent: scheduled task should not crash server
        }
      }, 15 * 60 * 1000);
    }

    if (!subscriptionCancelTimer) {
      subscriptionCancelTimer = setInterval(async () => {
        try {
          const now = new Date();
          const subscriptions = await Subscription.find({
            cancelAtPeriodEnd: true,
            status: 'active',
            currentPeriodEnd: { $lte: now }
          });

          if (!subscriptions.length) {
            return;
          }

          await Promise.all(
            subscriptions.map(async (subscription) => {
              try {
                if (subscription.providerSubId) {
                  await iyzico.cancelSubscription({ providerSubId: subscription.providerSubId });
                }
              } catch (_error) {
                // provider cancel failure should not crash job
              }

              subscription.status = 'ended';
              subscription.canceledAt = new Date();
              await subscription.save();
            })
          );
        } catch (_error) {
          // silent
        }
      }, 60 * 60 * 1000);
    }
  });
};

startServer();
