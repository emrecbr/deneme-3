import { Router } from 'express';
import AppSetting from '../models/AppSetting.js';

const mainRouter = Router();

mainRouter.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

mainRouter.get('/system/feature-flags', async (_req, res) => {
  const defaults = {
    mapViewEnabled: true,
    searchPanelEnabled: true,
    liveLocationEnabled: true,
    cityFallbackEnabled: true,
    maintenanceMode: false
  };
  const doc = await AppSetting.findOne({ key: 'feature_flags' }).lean();
  res.status(200).json({ success: true, data: { ...defaults, ...(doc?.value || {}) } });
});

mainRouter.get('/system/maintenance', async (_req, res) => {
  const doc = await AppSetting.findOne({ key: 'maintenance_mode' }).lean();
  res.status(200).json({
    success: true,
    data: doc?.value || { enabled: false, message: 'Sistem bakımda.' }
  });
});

export default mainRouter;
