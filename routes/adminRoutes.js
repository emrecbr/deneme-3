import express from 'express';
import multer from 'multer';
import { adminRoleMiddleware, requireAdminOnly } from '../middleware/adminRoleMiddleware.js';
import { getDashboardSummary } from '../controllers/adminDashboardController.js';
import {
  listAdminRfqs,
  getAdminRfq,
  updateAdminRfq,
  updateAdminRfqStatus,
  bulkUpdateRfqStatus,
  updateAdminRfqModeration,
  listExpiredRfqs,
  restoreExpiredRfq,
  deleteExpiredRfq
} from '../controllers/adminRfqController.js';
import {
  listAdminUsers,
  getAdminUser,
  updateAdminUserStatus,
  updateAdminUserRole,
  addAdminUserNote,
  deleteAdminUser
} from '../controllers/adminUserController.js';
import { listAdminAuditLogs } from '../controllers/adminAuditController.js';
import {
  listAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  listCategoryIssues,
  listSearchSuggestions,
  createSearchSuggestion,
  updateSearchSuggestion
} from '../controllers/adminCategoryController.js';
import {
  listAdminCities,
  createAdminCity,
  updateAdminCity,
  listAdminDistricts,
  createAdminDistrict,
  updateAdminDistrict,
  listLocationIssues,
  fixLocationIssue,
  getRadiusSettings,
  updateRadiusSettings
} from '../controllers/adminLocationController.js';
import { listOtpLogs, listSmsLogs } from '../controllers/adminNotificationController.js';
import {
  listPushLogs,
  listPushPreferences,
  sendAdminTestPush
} from '../controllers/adminPushNotificationController.js';
import {
  getSystemHealth,
  getFeatureFlags,
  updateFeatureFlags,
  getMaintenanceMode,
  updateMaintenanceMode,
  getListingExpirySettings,
  updateListingExpirySettings,
  getListingQuotaSettings,
  updateListingQuotaSettings,
  getModerationSettings,
  updateModerationSettings
} from '../controllers/adminSystemController.js';
import { getMapSettings, updateMapSettings, runMapTest } from '../controllers/adminMapController.js';
import { getSearchAnalytics } from '../controllers/adminSearchController.js';
import { getAdminContent, updateAdminContent } from '../controllers/adminContentController.js';
import { getRfqFlowSteps, getRfqValidationAnalytics } from '../controllers/adminRfqFlowController.js';
import { listAdvancedModerationQueue, listRiskSignals } from '../controllers/adminModerationController.js';
import {
  listModerationRules,
  createModerationRule,
  updateModerationRule,
  deleteModerationRule
} from '../controllers/adminModerationRulesController.js';
import {
  listModerationAttempts,
  getModerationAttempt,
  updateModerationAttempt,
  listModerationRiskUsers
} from '../controllers/adminModerationAttemptsController.js';
import { exportData } from '../controllers/adminExportController.js';
import { getReportOverview } from '../controllers/adminReportController.js';
import {
  listAdminIssueReports,
  getAdminIssueReport,
  updateAdminIssueReportStatus,
  addAdminIssueReportNote
} from '../controllers/adminIssueReportController.js';
import { importTsbRows, parseCsv, parseXlsx } from '../src/services/tsbImportService.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.get('/dashboard/summary', adminRoleMiddleware, getDashboardSummary);

router.get('/rfqs', adminRoleMiddleware, listAdminRfqs);
router.get('/rfqs/expired', adminRoleMiddleware, listExpiredRfqs);
router.get('/rfqs/:id', adminRoleMiddleware, getAdminRfq);
router.patch('/rfqs/:id', adminRoleMiddleware, updateAdminRfq);
router.patch('/rfqs/:id/status', adminRoleMiddleware, updateAdminRfqStatus);
router.patch('/rfqs/:id/moderation', adminRoleMiddleware, updateAdminRfqModeration);
router.post('/rfqs/status', adminRoleMiddleware, bulkUpdateRfqStatus);
router.patch('/rfqs/:id/restore', adminRoleMiddleware, requireAdminOnly, restoreExpiredRfq);
router.patch('/rfqs/:id/delete', adminRoleMiddleware, requireAdminOnly, deleteExpiredRfq);

router.get('/users', adminRoleMiddleware, listAdminUsers);
router.get('/users/:id', adminRoleMiddleware, getAdminUser);
router.patch('/users/:id/status', adminRoleMiddleware, updateAdminUserStatus);
router.patch('/users/:id/role', adminRoleMiddleware, requireAdminOnly, updateAdminUserRole);
router.post('/users/:id/notes', adminRoleMiddleware, addAdminUserNote);
router.patch('/users/:id/delete', adminRoleMiddleware, requireAdminOnly, deleteAdminUser);

router.get('/audit', adminRoleMiddleware, listAdminAuditLogs);

router.get('/categories', adminRoleMiddleware, listAdminCategories);
router.post('/categories', adminRoleMiddleware, requireAdminOnly, createAdminCategory);
router.patch('/categories/:id', adminRoleMiddleware, requireAdminOnly, updateAdminCategory);
router.get('/categories/issues', adminRoleMiddleware, listCategoryIssues);
router.get('/categories/search-suggestions', adminRoleMiddleware, listSearchSuggestions);
router.post('/categories/search-suggestions', adminRoleMiddleware, requireAdminOnly, createSearchSuggestion);
router.patch('/categories/search-suggestions/:id', adminRoleMiddleware, requireAdminOnly, updateSearchSuggestion);

router.get('/location/cities', adminRoleMiddleware, listAdminCities);
router.post('/location/cities', adminRoleMiddleware, requireAdminOnly, createAdminCity);
router.patch('/location/cities/:id', adminRoleMiddleware, requireAdminOnly, updateAdminCity);
router.get('/location/districts', adminRoleMiddleware, listAdminDistricts);
router.post('/location/districts', adminRoleMiddleware, requireAdminOnly, createAdminDistrict);
router.patch('/location/districts/:id', adminRoleMiddleware, requireAdminOnly, updateAdminDistrict);
router.get('/location/issues', adminRoleMiddleware, listLocationIssues);
router.patch('/location/issues/:id', adminRoleMiddleware, fixLocationIssue);
router.get('/location/radius-settings', adminRoleMiddleware, getRadiusSettings);
router.patch('/location/radius-settings', adminRoleMiddleware, requireAdminOnly, updateRadiusSettings);

router.get('/notifications/otp-logs', adminRoleMiddleware, listOtpLogs);
router.get('/notifications/sms-logs', adminRoleMiddleware, listSmsLogs);
router.get('/notifications/push-logs', adminRoleMiddleware, listPushLogs);
router.get('/notifications/push-preferences', adminRoleMiddleware, listPushPreferences);
router.post('/notifications/push-test', adminRoleMiddleware, requireAdminOnly, sendAdminTestPush);

router.get('/system/health', adminRoleMiddleware, getSystemHealth);
router.get('/system/feature-flags', adminRoleMiddleware, getFeatureFlags);
router.patch('/system/feature-flags', adminRoleMiddleware, requireAdminOnly, updateFeatureFlags);
router.get('/system/maintenance', adminRoleMiddleware, getMaintenanceMode);
router.patch('/system/maintenance', adminRoleMiddleware, requireAdminOnly, updateMaintenanceMode);
router.get('/system/listing-expiry', adminRoleMiddleware, getListingExpirySettings);
router.patch('/system/listing-expiry', adminRoleMiddleware, requireAdminOnly, updateListingExpirySettings);
router.get('/system/listing-quota', adminRoleMiddleware, getListingQuotaSettings);
router.patch('/system/listing-quota', adminRoleMiddleware, requireAdminOnly, updateListingQuotaSettings);
router.get('/system/moderation-settings', adminRoleMiddleware, getModerationSettings);
router.patch('/system/moderation-settings', adminRoleMiddleware, requireAdminOnly, updateModerationSettings);

router.get('/map/settings', adminRoleMiddleware, getMapSettings);
router.patch('/map/settings', adminRoleMiddleware, requireAdminOnly, updateMapSettings);
router.get('/map/test', adminRoleMiddleware, runMapTest);

router.get('/search/analytics', adminRoleMiddleware, getSearchAnalytics);

router.get('/content/:section', adminRoleMiddleware, getAdminContent);
router.patch('/content/:section', adminRoleMiddleware, requireAdminOnly, updateAdminContent);

router.get('/rfq-flow/steps', adminRoleMiddleware, getRfqFlowSteps);
router.get('/rfq-flow/validation-analytics', adminRoleMiddleware, getRfqValidationAnalytics);

router.get('/moderation/queue-advanced', adminRoleMiddleware, listAdvancedModerationQueue);
router.get('/moderation/risk-signals', adminRoleMiddleware, listRiskSignals);
router.get('/moderation/rules', adminRoleMiddleware, listModerationRules);
router.post('/moderation/rules', adminRoleMiddleware, requireAdminOnly, createModerationRule);
router.patch('/moderation/rules/:id', adminRoleMiddleware, requireAdminOnly, updateModerationRule);
router.delete('/moderation/rules/:id', adminRoleMiddleware, requireAdminOnly, deleteModerationRule);
router.get('/moderation/attempts', adminRoleMiddleware, listModerationAttempts);
router.get('/moderation/attempts/:id', adminRoleMiddleware, getModerationAttempt);
router.patch('/moderation/attempts/:id', adminRoleMiddleware, updateModerationAttempt);
router.get('/moderation/risk-users', adminRoleMiddleware, listModerationRiskUsers);

router.get('/reports/overview', adminRoleMiddleware, getReportOverview);
router.get('/reports/export', adminRoleMiddleware, exportData);
router.get('/reports/issues', adminRoleMiddleware, listAdminIssueReports);
router.get('/reports/issues/:id', adminRoleMiddleware, getAdminIssueReport);
router.patch('/reports/issues/:id/status', adminRoleMiddleware, updateAdminIssueReportStatus);
router.post('/reports/issues/:id/notes', adminRoleMiddleware, addAdminIssueReportNote);

router.post('/import/tsb-cars', adminRoleMiddleware, requireAdminOnly, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'Dosya gerekli' });
    }

    const filename = file.originalname || '';
    const isXlsx = filename.toLowerCase().endsWith('.xlsx');
    const isCsv = filename.toLowerCase().endsWith('.csv');
    if (!isXlsx && !isCsv) {
      return res.status(400).json({ success: false, message: 'Sadece CSV veya XLSX desteklenir' });
    }

    const rows = isXlsx ? parseXlsx(file.buffer) : parseCsv(file.buffer);
    const stats = await importTsbRows(rows);
    return res.status(200).json({ success: true, stats });
  } catch (error) {
    console.error('TSB IMPORT ERROR:', error);
    return res.status(500).json({ success: false, message: 'Import basarisiz' });
  }
});

export default router;
