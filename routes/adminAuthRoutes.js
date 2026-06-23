import express from 'express';
import { adminRoleMiddleware } from '../middleware/adminRoleMiddleware.js';
import { adminLogin, adminLogout, adminMe, changeAdminPassword } from '../controllers/adminAuthController.js';
import { apiRateLimit } from '../middleware/apiRateLimit.js';

const router = express.Router();

router.post('/login', apiRateLimit('login'), adminLogin);
router.post('/logout', adminRoleMiddleware, apiRateLimit('adminApi'), adminLogout);
router.get('/me', adminRoleMiddleware, apiRateLimit('adminApi'), adminMe);
router.patch('/change-password', adminRoleMiddleware, apiRateLimit('adminApi'), changeAdminPassword);

export default router;
