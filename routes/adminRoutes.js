import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { importTsbRows, parseCsv, parseXlsx } from '../src/services/tsbImportService.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.post('/import/tsb-cars', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin yetkisi gerekli' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'Dosya gerekli' });
    }

    const filename = file.originalname || '';
    const isXlsx = filename.toLowerCase().endsWith('.xlsx');
    const isCsv = filename.toLowerCase().endsWith('.csv');
    if (!isXlsx && !isCsv) {
      return res.status(400).json({ success: false, message: 'Sadece CSV veya XLSX desteklenir' });
    }

    const rows = isXlsx ? parseXlsx(file.buffer) : parseCsv(file.buffer);
    const stats = await importTsbRows(rows);
    return res.status(200).json({ success: true, stats });
  } catch (error) {
    console.error('TSB IMPORT ERROR:', error);
    return res.status(500).json({ success: false, message: 'Import basarisiz' });
  }
});

export default router;
