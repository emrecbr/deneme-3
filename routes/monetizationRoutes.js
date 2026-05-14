import { Router } from 'express';
import { adminRoleMiddleware, requireAdminOnly } from '../middleware/adminRoleMiddleware.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  getMyListingQuotaSummary,
  getMySubscriptionSummary,
  getPublicHowItWorks,
  listAdminMonetizationPlans,
  updateAdminMonetizationPlan,
  listAppMonetizationPlans,
  listPublicMonetizationPlans
} from '../controllers/monetizationController.js';

const router = Router();

router.get('/admin/monetization/plans', adminRoleMiddleware, listAdminMonetizationPlans);
router.patch('/admin/monetization/plans/:id', adminRoleMiddleware, requireAdminOnly, updateAdminMonetizationPlan);

router.get('/app/monetization/plans', listAppMonetizationPlans);
router.get('/public/plans', listPublicMonetizationPlans);
router.get('/public/how-it-works', getPublicHowItWorks);
router.get('/me/subscription', authMiddleware, getMySubscriptionSummary);
router.get('/me/listing-quota', authMiddleware, getMyListingQuotaSummary);

export default router;
