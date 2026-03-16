import express from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { createIssueReport, listMyReports } from '../controllers/reportController.js';

const router = express.Router();

const reportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Çok hızlı istek gönderildi. Lütfen biraz sonra tekrar deneyin.'
  }
});

router.post('/', authMiddleware, reportLimiter, createIssueReport);
router.get('/me', authMiddleware, listMyReports);

export default router;
