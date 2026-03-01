import express from 'express';
import Category from '../models/Category.js';

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const categories = await Category.find().lean();
    const map = new Map();
    const roots = [];

    categories.forEach((cat) => {
      map.set(String(cat._id), { ...cat, children: [] });
    });

    categories.forEach((cat) => {
      const parentId = cat.parent ? String(typeof cat.parent === 'object' ? cat.parent._id : cat.parent) : null;
      if (parentId && map.has(parentId)) {
        map.get(parentId).children.push(map.get(String(cat._id)));
      } else {
        roots.push(map.get(String(cat._id)));
      }
    });

    roots.forEach((root) => {
      root.childrenCount = root.children?.length || 0;
    });

    res.json({
      success: true,
      data: categories,
      tree: roots
    });
  } catch (error) {
    console.error('CATEGORY ERROR:', error);
    res.status(500).json({ success: false });
  }
});

export default router;
