import MonetizationPlan from '../models/MonetizationPlan.js';
import AdminAuditLog from '../models/AdminAuditLog.js';

const DEFAULT_PLANS = [
  {
    key: 'premium_listing',
    title: 'Premium İlan',
    shortDescription: 'İlanınızı daha görünür hale getirin.',
    longDescription: 'Premium ilanlar listelerde daha görünür olur ve öne çıkar.',
    isActive: true,
    showInApp: true,
    billingModes: ['monthly', 'yearly'],
    monthlyPrice: 249,
    yearlyPrice: 2490,
    currency: 'TRY',
    sortOrder: 1,
    badgeLabel: 'Popüler',
    metadata: {
      planCodes: {
        monthly: 'premium_monthly',
        yearly: 'premium_yearly'
      }
    }
  },
  {
    key: 'featured_listing',
    title: 'Öne Çıkarılan İlan',
    shortDescription: 'İlanınızı listelerde üst sıralara taşıyın.',
    longDescription: 'Öne çıkarılan ilanlar dikkat çeker ve daha fazla görüntülenir.',
    isActive: true,
    showInApp: true,
    billingModes: ['monthly', 'yearly'],
    monthlyPrice: 149,
    yearlyPrice: 1490,
    currency: 'TRY',
    sortOrder: 2,
    badgeLabel: 'Öne Çıkan',
    metadata: {
      planCodes: {
        monthly: 'featured_monthly',
        yearly: 'featured_yearly'
      }
    }
  }
];

export const ensureMonetizationPlans = async () => {
  await Promise.all(
    DEFAULT_PLANS.map((plan) =>
      MonetizationPlan.findOneAndUpdate({ key: plan.key }, { $setOnInsert: plan }, { upsert: true, new: true })
    )
  );
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
    // ignore
  }
};

export const listAdminMonetizationPlans = async (_req, res, next) => {
  try {
    await ensureMonetizationPlans();
    const items = await MonetizationPlan.find().sort({ sortOrder: 1, title: 1 }).lean();
    return res.status(200).json({ success: true, items });
  } catch (error) {
    return next(error);
  }
};

export const updateAdminMonetizationPlan = async (req, res, next) => {
  try {
    const plan = await MonetizationPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Paket bulunamadı.' });
    }
    const payload = req.body || {};
    const nextMonthly = payload.monthlyPrice !== undefined ? Number(payload.monthlyPrice) : plan.monthlyPrice;
    const nextYearly = payload.yearlyPrice !== undefined ? Number(payload.yearlyPrice) : plan.yearlyPrice;
    const nextBillingModes = Array.isArray(payload.billingModes) ? payload.billingModes : plan.billingModes;
    const nextIsActive = payload.isActive !== undefined ? Boolean(payload.isActive) : plan.isActive;
    const nextShowInApp = payload.showInApp !== undefined ? Boolean(payload.showInApp) : plan.showInApp;
    if (payload.monthlyPrice !== undefined && Number(payload.monthlyPrice) < 0) {
      return res.status(400).json({ success: false, message: 'Aylık fiyat geçersiz.' });
    }
    if (payload.yearlyPrice !== undefined && Number(payload.yearlyPrice) < 0) {
      return res.status(400).json({ success: false, message: 'Yıllık fiyat geçersiz.' });
    }
    if (Array.isArray(nextBillingModes) && nextBillingModes.length) {
      const invalid = nextBillingModes.find((mode) => !['monthly', 'yearly', 'one_time'].includes(mode));
      if (invalid) {
        return res.status(400).json({ success: false, message: 'Geçersiz fatura modu.' });
      }
    }
    if (nextIsActive && nextShowInApp) {
      if (nextBillingModes?.includes('monthly') && Number(nextMonthly) <= 0) {
        return res.status(400).json({ success: false, message: 'Aylık fiyat 0 olamaz.' });
      }
      if (nextBillingModes?.includes('yearly') && Number(nextYearly) <= 0) {
        return res.status(400).json({ success: false, message: 'Yıllık fiyat 0 olamaz.' });
      }
    }

    const prevIsActive = plan.isActive;
    const prevShowInApp = plan.showInApp;
    Object.assign(plan, payload);
    plan.updatedBy = req.admin?.id || null;
    await plan.save();

    if (prevIsActive !== plan.isActive || prevShowInApp !== plan.showInApp) {
      await logAdminAction(req, 'monetization_plan_toggle', {
        planId: plan._id,
        key: plan.key,
        prev: { isActive: prevIsActive, showInApp: prevShowInApp },
        next: { isActive: plan.isActive, showInApp: plan.showInApp }
      });
    }
    await logAdminAction(req, 'monetization_plan_update', {
      planId: plan._id,
      key: plan.key,
      value: payload
    });

    return res.status(200).json({ success: true, data: plan });
  } catch (error) {
    return next(error);
  }
};

export const listAppMonetizationPlans = async (_req, res, next) => {
  try {
    await ensureMonetizationPlans();
    const items = await MonetizationPlan.find({ showInApp: true }).sort({ sortOrder: 1, title: 1 }).lean();
    return res.status(200).json({ success: true, items: items.filter((item) => item.isActive) });
  } catch (error) {
    return next(error);
  }
};
