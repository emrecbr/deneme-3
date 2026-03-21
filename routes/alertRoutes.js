import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { createMyAlert, deleteMyAlert, listMyAlerts, updateMyAlert, markMatchSeen } from '../controllers/alertController.js';

const alertRoutes = Router();

alertRoutes.get('/me/alerts', authMiddleware, listMyAlerts);
alertRoutes.post('/me/alerts', authMiddleware, createMyAlert);
alertRoutes.patch('/me/alerts/:id', authMiddleware, updateMyAlert);
alertRoutes.delete('/me/alerts/:id', authMiddleware, deleteMyAlert);
alertRoutes.patch('/me/alert-matches/:id/seen', authMiddleware, markMatchSeen);

export default alertRoutes;
