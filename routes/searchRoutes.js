import express from 'express';
import { listPublicSuggestions, logSearchEvent } from '../controllers/searchController.js';
import { optionalAuthMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/suggestions', listPublicSuggestions);
router.post('/log', optionalAuthMiddleware, logSearchEvent);

export default router;
