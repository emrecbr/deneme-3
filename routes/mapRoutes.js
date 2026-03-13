import express from 'express';
import { getPublicMapSettings } from '../controllers/mapController.js';

const router = express.Router();

router.get('/settings', getPublicMapSettings);

export default router;
