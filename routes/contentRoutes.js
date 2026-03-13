import express from 'express';
import { getContent } from '../controllers/contentController.js';

const router = express.Router();

router.get('/:section', getContent);

export default router;
