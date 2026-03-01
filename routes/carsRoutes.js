import express from 'express';
import CarBrand from '../models/CarBrand.js';
import CarModel from '../models/CarModel.js';
import CarVariant from '../models/CarVariant.js';

const router = express.Router();

const buildQuery = (searchValue) => {
  const term = String(searchValue || '').trim();
  if (!term) {
    return {};
  }
  return { name: new RegExp(term, 'i') };
};

router.get('/brands', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const page = Math.max(Number(req.query.page || 1), 1);
    const skip = (page - 1) * limit;
    const query = buildQuery(req.query.search);
    const items = await CarBrand.find(query).sort({ name: 1 }).skip(skip).limit(limit);
    return res.status(200).json({ success: true, data: items });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Markalar alinmadi' });
  }
});

router.get('/models', async (req, res) => {
  try {
    const brandId = req.query.brandId;
    if (!brandId) {
      return res.status(400).json({ success: false, message: 'brandId zorunlu' });
    }
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const page = Math.max(Number(req.query.page || 1), 1);
    const skip = (page - 1) * limit;
    const query = { brandId, ...buildQuery(req.query.search) };
    const items = await CarModel.find(query).sort({ name: 1 }).skip(skip).limit(limit);
    return res.status(200).json({ success: true, data: items });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Modeller alinmadi' });
  }
});

router.get('/variants', async (req, res) => {
  try {
    const modelId = req.query.modelId;
    if (!modelId) {
      return res.status(400).json({ success: false, message: 'modelId zorunlu' });
    }
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const page = Math.max(Number(req.query.page || 1), 1);
    const skip = (page - 1) * limit;
    const query = {
      modelId,
      ...(req.query.year ? { year: Number(req.query.year) } : {})
    };
    if (req.query.search) {
      query.variantName = new RegExp(String(req.query.search).trim(), 'i');
    }
    const items = await CarVariant.find(query)
      .sort({ year: -1, variantName: 1 })
      .skip(skip)
      .limit(limit);
    return res.status(200).json({ success: true, data: items });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Varyantlar alinmadi' });
  }
});

export default router;
