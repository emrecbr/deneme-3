import express from 'express';
import { logRfqFlowEvent } from '../controllers/rfqFlowController.js';
import { optionalAuthMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/event', optionalAuthMiddleware, logRfqFlowEvent);

export default router;
