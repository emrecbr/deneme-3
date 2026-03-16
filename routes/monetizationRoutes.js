import { Router } from 'express';
import { adminRoleMiddleware, requireAdminOnly } from '../middleware/adminRoleMiddleware.js';
import {
  listAdminMonetizationPlans,
  updateAdminMonetizationPlan,
  listAppMonetizationPlans
} from '../controllers/monetizationController.js';

const router = Router();

router.get('/admin/monetization/plans', adminRoleMiddleware, listAdminMonetizationPlans);
router.patch('/admin/monetization/plans/:id', adminRoleMiddleware, requireAdminOnly, updateAdminMonetizationPlan);

router.get('/app/monetization/plans', listAppMonetizationPlans);

export default router;
