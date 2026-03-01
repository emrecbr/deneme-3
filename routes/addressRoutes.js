import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import Address from '../models/Address.js';

const router = express.Router();

const requireFields = (payload) => {
  const city = String(payload?.city || '').trim();
  const district = String(payload?.district || '').trim();
  const neighborhood = String(payload?.neighborhood || '').trim();
  const street = String(payload?.street || '').trim();
  const addressDetail = String(payload?.addressDetail || '').trim();
  if (!city) {
    return 'Sehir zorunlu';
  }
  if (!district) {
    return 'Ilce zorunlu';
  }
  if (!neighborhood) {
    return 'Mahalle zorunlu';
  }
  if (!street) {
    return 'Cadde/Sokak zorunlu';
  }
  if (!addressDetail || addressDetail.length < 10) {
    return 'Detay adres en az 10 karakter olmali';
  }
  return '';
};

router.get('/', authMiddleware, async (req, res) => {
  try {
    const addresses = await Address.find({ user: req.user.id }).sort({ updatedAt: -1 });
    return res.status(200).json({ success: true, data: addresses });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Adresler alinmadi' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const validationError = requireFields(req.body);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const payload = {
      user: req.user.id,
      title: String(req.body?.title || '').trim(),
      city: String(req.body?.city || '').trim(),
      district: String(req.body?.district || '').trim(),
      neighborhood: String(req.body?.neighborhood || '').trim(),
      street: String(req.body?.street || '').trim(),
      addressDetail: String(req.body?.addressDetail || '').trim()
    };

    const address = await Address.create(payload);

    return res.status(201).json({ success: true, data: address });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Adres kaydedilemedi' });
  }
});

router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const address = await Address.findOne({ _id: req.params.id, user: req.user.id });
    if (!address) {
      return res.status(404).json({ success: false, message: 'Adres bulunamadi' });
    }

    const validationError = requireFields({
      title: req.body?.title ?? address.title,
      city: req.body?.city ?? address.city,
      district: req.body?.district ?? address.district,
      neighborhood: req.body?.neighborhood ?? address.neighborhood,
      street: req.body?.street ?? address.street,
      addressDetail: req.body?.addressDetail ?? address.addressDetail
    });
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    address.title = String(req.body?.title ?? address.title).trim();
    address.city = String(req.body?.city ?? address.city).trim();
    address.district = String(req.body?.district ?? address.district).trim();
    address.neighborhood = String(req.body?.neighborhood ?? address.neighborhood).trim();
    address.street = String(req.body?.street ?? address.street).trim();
    address.addressDetail = String(req.body?.addressDetail ?? address.addressDetail).trim();

    await address.save();

    return res.status(200).json({ success: true, data: address });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Adres guncellenemedi' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const address = await Address.findOne({ _id: req.params.id, user: req.user.id });
    if (!address) {
      return res.status(404).json({ success: false, message: 'Adres bulunamadi' });
    }
    await address.deleteOne();

    return res.status(200).json({ success: true });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Adres silinemedi' });
  }
});

export default router;
