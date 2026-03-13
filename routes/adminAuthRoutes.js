import express from 'express';
import { adminRoleMiddleware } from '../middleware/adminRoleMiddleware.js';
import { adminLogin, adminLogout, adminMe } from '../controllers/adminAuthController.js';

const router = express.Router();

router.post('/login', adminLogin);
router.post('/logout', adminRoleMiddleware, adminLogout);
router.get('/me', adminRoleMiddleware, adminMe);

export default router;
