import mongoose from 'mongoose';
import AdminAuditLog from '../models/AdminAuditLog.js';
import AppSetting from '../models/AppSetting.js';

const FEATURE_FLAGS_DEFAULT = {
  mapViewEnabled: true,
  searchPanelEnabled: true,
  liveLocationEnabled: true,
  cityFallbackEnabled: true,
  maintenanceMode: false
};

const getSetting = async (key, fallback) => {
  const doc = await AppSetting.findOne({ key }).lean();
  return doc?.value ?? fallback;
};

const saveSetting = async (key, value, adminId) => {
  const doc = await AppSetting.findOneAndUpdate(
    { key },
    { key, value, updatedBy: adminId },
    { upsert: true, new: true }
  );
  return doc?.value ?? value;
};

const logAdminAction = async (req, action, meta = {}) => {
  try {
    await AdminAuditLog.create({
      adminId: req.admin?.id || null,
      role: req.admin?.role || null,
      action,
      ip: req.headers['x-forwarded-for'] || req.ip,
      userAgent: req.headers['user-agent'] || '',
      meta
    });
  } catch (_error) {
    // ignore audit errors
  }
};

export const getSystemHealth = async (_req, res, next) => {
  try {
    const dbState = mongoose.connection.readyState;
    const dbHealthy = dbState === 1;
    const smsProvider = process.env.SMS_PROVIDER || 'unknown';
    const otpTtl = Number(process.env.OTP_TTL_SECONDS || process.env.OTP_TTL_MINUTES || 0);
    const auditCount = await AdminAuditLog.countDocuments();

    return res.status(200).json({
      success: true,
      status: dbHealthy ? 'healthy' : 'error',
      checks: [
        { key: 'database', label: 'MongoDB', status: dbHealthy ? 'healthy' : 'error', detail: `readyState=${dbState}` },
        { key: 'sms', label: 'SMS Provider', status: smsProvider !== 'unknown' ? 'healthy' : 'warning', detail: smsProvider },
        { key: 'otp', label: 'OTP Config', status: otpTtl ? 'healthy' : 'warning', detail: `ttl=${otpTtl || 'unset'}` },
        { key: 'audit', label: 'Audit Log', status: 'healthy', detail: `records=${auditCount}` }
      ]
    });
  } catch (error) {
    return next(error);
  }
};

export const getFeatureFlags = async (_req, res, next) => {
  try {
    const flags = await getSetting('feature_flags', FEATURE_FLAGS_DEFAULT);
    return res.status(200).json({ success: true, data: { ...FEATURE_FLAGS_DEFAULT, ...(flags || {}) } });
  } catch (error) {
    return next(error);
  }
};

export const updateFeatureFlags = async (req, res, next) => {
  try {
    const current = await getSetting('feature_flags', FEATURE_FLAGS_DEFAULT);
    const nextFlags = { ...current, ...(req.body || {}) };
    const saved = await saveSetting('feature_flags', nextFlags, req.admin?.id || null);
    await logAdminAction(req, 'settings_feature_flags_update', { value: saved });
    return res.status(200).json({ success: true, data: saved });
  } catch (error) {
    return next(error);
  }
};

export const getMaintenanceMode = async (_req, res, next) => {
  try {
    const mode = await getSetting('maintenance_mode', { enabled: false, message: 'Sistem bakımda.' });
    return res.status(200).json({ success: true, data: mode });
  } catch (error) {
    return next(error);
  }
};

export const updateMaintenanceMode = async (req, res, next) => {
  try {
    const current = await getSetting('maintenance_mode', { enabled: false, message: 'Sistem bakımda.' });
    const nextMode = { ...current, ...(req.body || {}) };
    const saved = await saveSetting('maintenance_mode', nextMode, req.admin?.id || null);
    await logAdminAction(req, 'settings_maintenance_update', { value: saved });
    return res.status(200).json({ success: true, data: saved });
  } catch (error) {
    return next(error);
  }
};
