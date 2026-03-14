import express from 'express';
import { adminRoleMiddleware } from '../middleware/adminRoleMiddleware.js';
import { adminLogin, adminLogout, adminMe, changeAdminPassword } from '../controllers/adminAuthController.js';

const router = express.Router();

router.post('/login', adminLogin);
router.post('/logout', adminRoleMiddleware, adminLogout);
router.get('/me', adminRoleMiddleware, adminMe);
router.patch('/change-password', adminRoleMiddleware, changeAdminPassword);

export default router;
