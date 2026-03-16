import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '../middleware/authMiddleware.js';
import User from '../models/User.js';
import RFQ from '../models/RFQ.js';
import { getListingQuotaSettings, getListingQuotaSnapshot } from '../src/utils/listingQuota.js';
import PaymentMethod from '../models/PaymentMethod.js';
import AdminAuditLog from '../models/AdminAuditLog.js';

const router = express.Router();

const normalizePhone = (value) => {
  const digitsRaw = String(value || '').replace(/\D/g, '');
  if (!digitsRaw) {
    return { ok: true, value: '' };
  }
  let digits = digitsRaw;
  if (digits.startsWith('90') && digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }
  if (digits.length !== 10 || !digits.startsWith('5')) {
    return { ok: false, value: '' };
  }
  return { ok: true, value: `+90${digits}` };
};

const isValidPassword = (value) => {
  const text = String(value || '');
  return text.length >= 3 && /[A-Z]/.test(text) && /[0-9]/.test(text) && /[^A-Za-z0-9]/.test(text);
};

const uploadDir = path.resolve('uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    cb(null, `avatar-${Date.now()}-${file.originalname}`);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Geçersiz dosya tipi. Sadece JPG/PNG/WEBP.'));
  }
});

const normalizeName = (value) => String(value || '').trim();

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      'firstName lastName phone email name avatarUrl listingQuotaWindowStart listingQuotaWindowEnd listingQuotaUsedFree paidListingCredits paymentProvider paymentMethod'
    );
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanici bulunamadi' });
    }
    const settings = await getListingQuotaSettings();
    const quota = getListingQuotaSnapshot(user, settings);
    return res.status(200).json({
      success: true,
      data: {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        email: user.email || '',
        name: user.name || '',
        avatarUrl: user.avatarUrl || '',
        listingQuota: quota,
        paymentMethod: user.paymentMethod || null,
        paymentProvider: user.paymentProvider || null
      }
    });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Sunucu hatasi' });
  }
});

router.get('/me/listing-quota', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      'listingQuotaWindowStart listingQuotaWindowEnd listingQuotaUsedFree paidListingCredits'
    );
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanici bulunamadi' });
    }
    const settings = await getListingQuotaSettings();
    const quota = getListingQuotaSnapshot(user, settings);
    return res.status(200).json({ success: true, data: quota });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Sunucu hatasi' });
  }
});

router.get('/me/payment-methods', authMiddleware, async (req, res) => {
  try {
    const methods = await PaymentMethod.find({ user: req.user.id, isDeleted: { $ne: true } })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();
    return res.status(200).json({ success: true, items: methods });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Ödeme yöntemleri alınamadı.' });
  }
});

router.patch('/me/payment-methods/:id/default', authMiddleware, async (req, res) => {
  try {
    const method = await PaymentMethod.findOne({ _id: req.params.id, user: req.user.id, isDeleted: { $ne: true } });
    if (!method) {
      return res.status(404).json({ success: false, message: 'Ödeme yöntemi bulunamadı.' });
    }
    await PaymentMethod.updateMany({ user: req.user.id }, { $set: { isDefault: false } });
    method.isDefault = true;
    await method.save();

    await User.findByIdAndUpdate(req.user.id, {
      paymentProvider: method.provider,
      paymentMethod: {
        brand: method.brand || '',
        last4: method.last4 || '',
        expMonth: method.expMonth || '',
        expYear: method.expYear || '',
        holderName: method.holderName || ''
      }
    });

    try {
      await AdminAuditLog.create({
        adminId: req.user?.id || null,
        role: 'user',
        action: 'payment_method_set_default',
        meta: { methodId: method._id }
      });
    } catch (_error) {
      // ignore audit
    }

    return res.status(200).json({ success: true, data: method });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Ödeme yöntemi güncellenemedi.' });
  }
});

router.delete('/me/payment-methods/:id', authMiddleware, async (req, res) => {
  try {
    const method = await PaymentMethod.findOne({ _id: req.params.id, user: req.user.id, isDeleted: { $ne: true } });
    if (!method) {
      return res.status(404).json({ success: false, message: 'Ödeme yöntemi bulunamadı.' });
    }
    method.isDeleted = true;
    method.isDefault = false;
    await method.save();

    const nextDefault = await PaymentMethod.findOne({ user: req.user.id, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .lean();
    await PaymentMethod.updateMany({ user: req.user.id }, { $set: { isDefault: false } });
    if (nextDefault) {
      await PaymentMethod.findByIdAndUpdate(nextDefault._id, { isDefault: true });
      await User.findByIdAndUpdate(req.user.id, {
        paymentProvider: nextDefault.provider,
        paymentMethod: {
          brand: nextDefault.brand || '',
          last4: nextDefault.last4 || '',
          expMonth: nextDefault.expMonth || '',
          expYear: nextDefault.expYear || '',
          holderName: nextDefault.holderName || ''
        }
      });
    } else {
      await User.findByIdAndUpdate(req.user.id, { paymentMethod: null, paymentProvider: '' });
    }

    try {
      await AdminAuditLog.create({
        adminId: req.user?.id || null,
        role: 'user',
        action: 'payment_method_remove',
        meta: { methodId: method._id }
      });
    } catch (_error) {
      // ignore audit
    }

    return res.status(200).json({ success: true });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Ödeme yöntemi silinemedi.' });
  }
});

router.patch('/me', authMiddleware, async (req, res) => {
  try {
    const firstName = String(req.body?.firstName || '').trim();
    const lastName = String(req.body?.lastName || '').trim();
    const name = normalizeName(req.body?.name);
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phoneInput = req.body?.phone || '';
    const phoneNormalized = normalizePhone(phoneInput);

    if (!phoneNormalized.ok) {
      return res.status(400).json({
        success: false,
        message: 'Telefon 10 hane olmalı (5xx...)'
      });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanici bulunamadi' });
    }

    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email, _id: { $ne: user._id } }).select('_id');
      if (emailExists) {
        return res.status(409).json({ success: false, message: 'Bu e-posta zaten kullaniliyor' });
      }
      user.email = email;
    }

    if (name) {
      if (name.length < 2 || name.length > 60) {
        return res.status(400).json({ success: false, message: 'İsim 2-60 karakter olmalı.' });
      }
      user.name = name;
    }
    if (firstName) {
      user.firstName = firstName;
    }
    if (lastName) {
      user.lastName = lastName;
    }
    if (phoneNormalized.value || phoneInput === '') {
      user.phone = phoneNormalized.value || '';
    }

    if (!name && (firstName || lastName)) {
      const combined = `${firstName} ${lastName}`.trim();
      if (combined) {
        user.name = combined;
      }
    }

    await user.save();

    return res.status(200).json({
      success: true,
      data: {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        email: user.email || '',
        name: user.name || '',
        avatarUrl: user.avatarUrl || ''
      }
    });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Guncelleme basarisiz' });
  }
});

router.post('/me/avatar', authMiddleware, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Dosya bulunamadı.' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanici bulunamadi' });
    }
    const avatarUrl = `/uploads/${req.file.filename}`;
    user.avatarUrl = avatarUrl;
    await user.save();
    return res.status(200).json({ success: true, data: { avatarUrl } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message || 'Avatar güncellenemedi.' });
  }
});

router.delete('/me/avatar', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanici bulunamadi' });
    }
    user.avatarUrl = '';
    await user.save();
    return res.status(200).json({ success: true, data: { avatarUrl: '' } });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Avatar kaldırılamadı.' });
  }
});

router.post('/me/change-password', authMiddleware, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Eksik bilgi' });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        code: 'WEAK_PASSWORD',
        message: 'Sifre kurallarini saglamiyor'
      });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanici bulunamadi' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, code: 'BAD_PASSWORD', message: 'Mevcut sifre yanlis' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        code: 'SAME_PASSWORD',
        message: 'Yeni sifre eski sifre ile ayni olamaz'
      });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({ success: true });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Sifre guncellenemedi' });
  }
});

router.post('/favorite/:rfqId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const rfq = await RFQ.findById(req.params.rfqId);

    if (!rfq) {
      return res.status(404).json({ message: 'RFQ bulunamadı' });
    }

    if (!user) {
      return res.status(404).json({ message: 'Kullanici bulunamadi' });
    }

    const index = user.favorites.findIndex((item) => item.toString() === rfq._id.toString());

    const isFavorited = index !== -1;

    if (!isFavorited) {
      user.favorites.push(rfq._id);
    } else {
      user.favorites.splice(index, 1);
    }

    await user.save();
    await RFQ.updateOne({ _id: rfq._id }, { $inc: { favoriteCount: isFavorited ? -1 : 1 } });
    const updatedRFQ = await RFQ.findById(rfq._id).select('favoriteCount');

    return res.json({
      success: true,
      favorites: user.favorites,
      favoriteCount: updatedRFQ?.favoriteCount || 0
    });
  } catch (error) {
    console.error('FAVORITE ERROR:', error);
    return res.status(500).json({ message: error.message });
  }
});

router.get('/favorites', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'favorites',
      populate: [
        {
          path: 'buyer',
          select: 'name email'
        },
        {
          path: 'category',
          select: 'name slug parent icon order'
        }
      ],
      options: { sort: { createdAt: -1 } }
    });

    if (!user) {
      return res.status(404).json({ message: 'Kullanici bulunamadi' });
    }

    return res.json({
      items: user.favorites || []
    });
  } catch (error) {
    console.error('FAVORITES ERROR:', error);
    return res.status(500).json({ message: 'Sunucu hatası' });
  }
});

router.patch('/activate-premium', authMiddleware, async (req, res) => {
  try {
    const premiumDays = Math.max(Number(req.body?.days || 30), 1);
    const premiumUntil = new Date(Date.now() + premiumDays * 24 * 60 * 60 * 1000);

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanici bulunamadi' });
    }

    user.isPremium = true;
    user.premiumUntil = premiumUntil;
    user.recomputeTrustScore();
    await user.save();

    return res.status(200).json({
      success: true,
      data: {
        isPremium: user.isPremium,
        premiumUntil: user.premiumUntil,
        trustScore: user.trustScore
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
});

router.patch('/onboarding-complete', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      '_id isOnboardingCompleted name email role city isPremium premiumUntil trustScore totalCompletedDeals positiveReviews negativeReviews'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanici bulunamadi'
      });
    }

    if (!user.isOnboardingCompleted) {
      user.isOnboardingCompleted = true;
      await user.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Onboarding tamamlandi.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        city: user.city || null,
        isPremium: Boolean(user.isPremium),
        premiumUntil: user.premiumUntil || null,
        trustScore: Number(user.trustScore || 50),
        totalCompletedDeals: Number(user.totalCompletedDeals || 0),
        positiveReviews: Number(user.positiveReviews || 0),
        negativeReviews: Number(user.negativeReviews || 0),
        isOnboardingCompleted: Boolean(user.isOnboardingCompleted)
      }
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: 'Onboarding guncellenemedi.'
    });
  }
});

router.get('/location-selection', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('locationSelection city');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanici bulunamadi'
      });
    }

    return res.status(200).json({
      items: [
        {
          city: user.locationSelection?.city || user.city || '',
          district: user.locationSelection?.district || '',
          neighborhood: user.locationSelection?.neighborhood || '',
          street: user.locationSelection?.street || ''
        }
      ],
      pagination: {
        page: 1,
        limit: 1,
        total: 1,
        hasMore: false
      }
    });
  } catch (error) {
    console.error('LOCATION_SELECTION_FAIL', error);
    return res.status(500).json({
      success: false,
      message: 'Lokasyon bilgisi alinamadi.'
    });
  }
});

router.patch('/location-selection', authMiddleware, async (req, res) => {
  try {
    const city = String(req.body?.city || '').trim();
    const district = String(req.body?.district || '').trim();
    const neighborhood = String(req.body?.neighborhood || '').trim();
    const street = String(req.body?.street || '').trim();

    if (!city) {
      return res.status(400).json({
        success: false,
        message: 'Sehir secimi zorunludur.'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanici bulunamadi'
      });
    }

    user.locationSelection = {
      city,
      district: district || undefined,
      neighborhood: neighborhood || undefined,
      street: street || undefined
    };
    user.city = city;
    await user.save();

    return res.status(200).json({
      items: [
        {
          city,
          district: district || '',
          neighborhood: neighborhood || '',
          street: street || ''
        }
      ],
      pagination: {
        page: 1,
        limit: 1,
        total: 1,
        hasMore: false
      }
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: 'Lokasyon secimi kaydedilemedi.'
    });
  }
});

export default router;
