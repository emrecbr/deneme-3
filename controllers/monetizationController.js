import MonetizationPlan from '../models/MonetizationPlan.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import Payment from '../models/Payment.js';
import Subscription from '../models/Subscription.js';
import User from '../models/User.js';
import UserEntitlement from '../models/UserEntitlement.js';
import { getPublishingRightsSummary } from '../src/services/publishingRightsService.js';
import { getListingQuotaSettings, getListingQuotaSnapshot } from '../src/utils/listingQuota.js';

const DEFAULT_PLANS = [
  {
    key: 'premium_listing',
    title: 'Premium Ilan',
    shortDescription: 'Ilanini daha gorunur hale getiren premium hesap haklari.',
    longDescription:
      'Premium hesap, profilinde premium rozeti ve platform icinde daha belirgin gorunurluk saglayan dijital hizmet paketidir.',
    isActive: true,
    showInApp: true,
    billingModes: ['monthly', 'yearly'],
    monthlyPrice: 249,
    yearlyPrice: 2490,
    currency: 'TRY',
    sortOrder: 1,
    badgeLabel: 'Populer',
    metadata: {
      digitalServiceLabel: 'Dijital hizmet paketi',
      listingRights: 'Standart ilan haklarin korunur',
      featuredDurationDaysMonthly: 0,
      featuredDurationDaysYearly: 0,
      premiumBadgeIncluded: true,
      visibilityBoostLabel: 'Premium hesap rozeti ve daha fazla profil gorunurlugu',
      offerPriorityLabel: 'Premium hesap sinyali',
      durationLabelMonthly: '30 gun premium hesap aktivasyonu',
      durationLabelYearly: '365 gun premium hesap aktivasyonu',
      planCodes: {
        monthly: 'premium_monthly',
        yearly: 'premium_yearly'
      }
    }
  },
  {
    key: 'featured_listing',
    title: 'One Cikarilan Ilan',
    shortDescription: 'Secilen talebin daha dikkat cekici gorunmesini saglayan one cikarma paketi.',
    longDescription:
      'One cikarilan ilan paketleri, secilen RFQ kaydina kullanilabilen dijital gorunurluk hakkidir.',
    isActive: true,
    showInApp: true,
    billingModes: ['monthly', 'yearly'],
    monthlyPrice: 149,
    yearlyPrice: 1490,
    currency: 'TRY',
    sortOrder: 2,
    badgeLabel: 'One Cikan',
    metadata: {
      digitalServiceLabel: 'Dijital hizmet paketi',
      listingRights: 'Standart ilan haklarin korunur',
      featuredDurationDaysMonthly: 7,
      featuredDurationDaysYearly: 30,
      premiumBadgeIncluded: false,
      visibilityBoostLabel: 'Secilen ilani listelerde daha gorunur kilar',
      offerPriorityLabel: 'Talebin daha once fark edilmesine yardimci olur',
      durationLabelMonthly: '7 gun one cikarma etkisi',
      durationLabelYearly: '30 gun one cikarma etkisi',
      planCodes: {
        monthly: 'featured_monthly',
        yearly: 'featured_yearly'
      }
    }
  }
];

const PLAN_METADATA_DEFAULTS = {
  premium_listing: DEFAULT_PLANS[0].metadata,
  featured_listing: DEFAULT_PLANS[1].metadata
};

const HOW_IT_WORKS_PAYLOAD = {
  title: 'Talepet nasil calisir?',
  summary:
    'Talepet kullanicilar arasi odeme alan bir marketplace degil; talep toplama, gorunurluk ve premium haklar sunan dijital bir platformdur.',
  keyNotices: [
    'Talepet kullanicilar arasinda odeme araciligi yapmaz.',
    'Talepet kullanicilar arasinda komisyon almaz.',
    'Talepet yalnizca dijital gorunurluk, premium hak ve ilan paketleri satar.'
  ],
  steps: [
    {
      step: '01',
      title: 'Kullanici talep olusturur',
      body: 'Talep sahibi kategori, konum ve ihtiyac detaylarini girerek platform uzerinde bir talep olusturur.'
    },
    {
      step: '02',
      title: 'Hizmet veren teklif gonderir',
      body: 'Ilgili hizmet verenler ve tedarikciler talebi gorur, tekliflerini Talepet uzerinden iletir.'
    },
    {
      step: '03',
      title: 'Taraflar detaylari gorusur',
      body: 'Mesajlasma ve profil bilgileri platform icinde kullanilir; is kapsamı ve detaylar burada netlesir.'
    },
    {
      step: '04',
      title: 'Kullanici platform disinda anlasir',
      body: 'Nihai odeme ve teslim kosullari kullanici ile hizmet veren arasinda ayrica kararlastirilir.'
    },
    {
      step: '05',
      title: 'Talepet dijital hizmet sunar',
      body: 'Talepet yalnizca premium gorunurluk, one cikarma ve ek ilan hakki gibi dijital platform hizmetlerini ucretlendirir.'
    }
  ]
};

const normalizePlanMetadata = (plan) => ({
  ...(PLAN_METADATA_DEFAULTS?.[plan?.key] || {}),
  ...(plan?.metadata || {})
});

const serializePlanForAdmin = (plan) => ({
  ...plan,
  metadata: normalizePlanMetadata(plan)
});

const buildPlanEntitlements = (plan) => {
  const metadata = normalizePlanMetadata(plan);
  return {
    digitalServiceLabel: metadata.digitalServiceLabel || 'Dijital hizmet paketi',
    listingRights: metadata.listingRights || 'Standart ilan haklarin korunur',
    featuredDurationDays: {
      monthly: Number(metadata.featuredDurationDaysMonthly || 0),
      yearly: Number(metadata.featuredDurationDaysYearly || 0)
    },
    premiumBadgeIncluded: Boolean(metadata.premiumBadgeIncluded),
    visibilityBoostLabel: metadata.visibilityBoostLabel || 'Platform ici gorunurluk avantaji',
    offerPriorityLabel: metadata.offerPriorityLabel || 'Dahil degil',
    durationLabels: {
      monthly: metadata.durationLabelMonthly || '30 gun',
      yearly: metadata.durationLabelYearly || '365 gun'
    }
  };
};

const serializePublicPlan = (plan) => {
  const metadata = normalizePlanMetadata(plan);
  const entitlements = buildPlanEntitlements(plan);
  const billingModes =
    Array.isArray(plan.billingModes) && plan.billingModes.length
      ? plan.billingModes
      : ['monthly', 'yearly'];

  return {
    id: String(plan._id),
    key: plan.key,
    title: plan.title,
    badgeLabel: plan.badgeLabel || '',
    shortDescription: plan.shortDescription || '',
    longDescription: plan.longDescription || '',
    billingModes,
    currency: plan.currency || 'TRY',
    monthlyPrice: Number(plan.monthlyPrice || 0),
    yearlyPrice: Number(plan.yearlyPrice || 0),
    planCodes: metadata.planCodes || {},
    entitlements,
    disclaimer:
      'Bu odeme dijital platform hizmeti icindir. Talepet kullanicilar arasinda odeme araciligi yapmaz.'
  };
};

const SOURCE_LABELS = {
  payment: 'Satın alma',
  purchase: 'Satın alma',
  admin: 'Admin tanımlama',
  admin_grant: 'Admin tanımlama',
  promo: 'Kampanya',
  campaign: 'Kampanya',
  current_state: 'Mevcut hak'
};

const formatSource = (source) => SOURCE_LABELS[source] || source || '—';

const serializeUserForEntitlementList = (user) => ({
  id: user?._id?.toString?.() || user?._id || null,
  name: user?.name || '—',
  email: user?.email || '',
  phone: user?.phone || ''
});

const buildEntitlementListItem = ({
  user,
  entitlementType,
  source,
  startAt,
  expiresAt,
  quantity = 0,
  usedQuantity = 0,
  actionAt,
  grantedByAdmin,
  payment,
  note
}) => ({
  id:
    payment?._id?.toString?.() ||
    `${user?._id || 'user'}-${entitlementType}-${source}-${actionAt || expiresAt || startAt || ''}`,
  user: serializeUserForEntitlementList(user),
  entitlementType,
  source,
  sourceLabel: formatSource(source),
  startAt: startAt || null,
  expiresAt: expiresAt || null,
  quantity: Number(quantity || 0),
  usedQuantity: Number(usedQuantity || 0),
  remainingQuantity: Math.max(Number(quantity || 0) - Number(usedQuantity || 0), 0),
  actionAt: actionAt || null,
  grantedByAdmin: grantedByAdmin ? serializeUserForEntitlementList(grantedByAdmin) : null,
  payment: payment
    ? {
        id: payment._id,
        planCode: payment.planCode,
        planTitle: payment.planTitleSnapshot || payment.planCode,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency
      }
    : null,
  note: note || ''
});

const buildListingExtraPublicPlan = (settings) => ({
  id: 'listing_extra_public',
  key: 'listing_extra',
  title: 'Ek Ilan Hakki',
  badgeLabel: 'Esnek',
  shortDescription: 'Ucretsiz ilan hakkin doldugunda hesabina ek ilan hakki tanimlar.',
  longDescription:
    'Bu hak fiziksel urun degil, Talepet platformu icinde ek talep yayini acma hakkidir.',
  billingModes: ['one_time'],
  currency: settings.currency || 'TRY',
  monthlyPrice: Number(settings.extraPrice || 0),
  yearlyPrice: 0,
  planCodes: {
    one_time: 'listing_extra'
  },
  entitlements: {
    digitalServiceLabel: 'Dijital hizmet paketi',
    listingRights: '+1 ek ilan hakki',
    featuredDurationDays: {
      monthly: 0,
      yearly: 0
    },
    premiumBadgeIncluded: false,
    visibilityBoostLabel: 'Ek gorunurluk degil, ek yayin hakki saglar',
    offerPriorityLabel: 'Dahil degil',
    durationLabels: {
      monthly: 'Tek seferlik hak aktivasyonu',
      yearly: 'Tek seferlik hak aktivasyonu'
    }
  },
  disclaimer:
    'Bu odeme dijital platform hizmeti icindir. Talepet kullanicilar arasinda odeme araciligi yapmaz.'
});

export const ensureMonetizationPlans = async () => {
  await Promise.all(
    DEFAULT_PLANS.map((plan) =>
      MonetizationPlan.findOneAndUpdate(
        { key: plan.key },
        { $setOnInsert: plan },
        { upsert: true, new: true }
      )
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
    const items = (await MonetizationPlan.find().sort({ sortOrder: 1, title: 1 }).lean()).map(
      serializePlanForAdmin
    );
    return res.status(200).json({ success: true, items });
  } catch (error) {
    return next(error);
  }
};

export const updateAdminMonetizationPlan = async (req, res, next) => {
  try {
    const plan = await MonetizationPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Paket bulunamadi.' });
    }
    const payload = req.body || {};
    const nextMonthly =
      payload.monthlyPrice !== undefined ? Number(payload.monthlyPrice) : plan.monthlyPrice;
    const nextYearly =
      payload.yearlyPrice !== undefined ? Number(payload.yearlyPrice) : plan.yearlyPrice;
    const nextBillingModes = Array.isArray(payload.billingModes)
      ? payload.billingModes
      : plan.billingModes;
    const nextIsActive =
      payload.isActive !== undefined ? Boolean(payload.isActive) : plan.isActive;
    const nextShowInApp =
      payload.showInApp !== undefined ? Boolean(payload.showInApp) : plan.showInApp;

    if (payload.monthlyPrice !== undefined && Number(payload.monthlyPrice) < 0) {
      return res.status(400).json({ success: false, message: 'Aylik fiyat gecersiz.' });
    }
    if (payload.yearlyPrice !== undefined && Number(payload.yearlyPrice) < 0) {
      return res.status(400).json({ success: false, message: 'Yillik fiyat gecersiz.' });
    }
    if (Array.isArray(nextBillingModes) && nextBillingModes.length) {
      const invalid = nextBillingModes.find(
        (mode) => !['monthly', 'yearly', 'one_time'].includes(mode)
      );
      if (invalid) {
        return res.status(400).json({ success: false, message: 'Gecersiz fatura modu.' });
      }
    }
    if (nextIsActive && nextShowInApp) {
      if (nextBillingModes?.includes('monthly') && Number(nextMonthly) <= 0) {
        return res.status(400).json({ success: false, message: 'Aylik fiyat 0 olamaz.' });
      }
      if (nextBillingModes?.includes('yearly') && Number(nextYearly) <= 0) {
        return res.status(400).json({ success: false, message: 'Yillik fiyat 0 olamaz.' });
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

    return res.status(200).json({ success: true, data: serializePlanForAdmin(plan.toObject()) });
  } catch (error) {
    return next(error);
  }
};

export const listAdminEntitlementUsers = async (_req, res, next) => {
  try {
    const now = new Date();
    const [activePremiumUsers, featuredCreditUsers, entitlementHistory, paidPayments] = await Promise.all([
      User.find({
        isPremium: true,
        $or: [{ premiumUntil: null }, { premiumUntil: { $gt: now } }]
      })
        .select('name email phone isPremium premiumUntil premiumSource featuredCredits updatedAt')
        .sort({ premiumUntil: -1, updatedAt: -1 })
        .limit(100)
        .lean(),
      User.find({ featuredCredits: { $gt: 0 } })
        .select('name email phone featuredCredits updatedAt')
        .sort({ featuredCredits: -1, updatedAt: -1 })
        .limit(100)
        .lean(),
      UserEntitlement.find({})
        .sort({ createdAt: -1 })
        .limit(300)
        .populate('userId', 'name email phone')
        .populate('grantedByAdminId', 'name email')
        .lean(),
      Payment.find({
        $or: [{ status: 'paid' }, { lifecycleStatus: 'succeeded' }],
        planCode: { $in: ['premium_monthly', 'premium_yearly', 'featured_one_time', 'featured_monthly', 'featured_yearly', 'listing_extra'] }
      })
        .sort({ paidAt: -1, updatedAt: -1 })
        .limit(150)
        .populate('user', 'name email phone')
        .lean()
    ]);

    const entitlementByUserAndType = new Map();
    entitlementHistory.forEach((item) => {
      const userId = item.userId?._id?.toString?.();
      const key = `${userId}:${item.entitlementType}`;
      if (userId && !entitlementByUserAndType.has(key)) {
        entitlementByUserAndType.set(key, item);
      }
    });

    const activePremium = activePremiumUsers.map((user) => {
      const latestEntitlement = entitlementByUserAndType.get(`${user._id}:premium`);
      return buildEntitlementListItem({
        user,
        entitlementType: 'premium',
        source: latestEntitlement?.source || user.premiumSource || 'current_state',
        startAt: latestEntitlement?.startAt || null,
        expiresAt: user.premiumUntil || latestEntitlement?.expiresAt || null,
        quantity: 1,
        usedQuantity: 0,
        actionAt: latestEntitlement?.createdAt || user.updatedAt,
        grantedByAdmin: latestEntitlement?.grantedByAdminId || null,
        note: latestEntitlement?.note || ''
      });
    });

    const featuredAvailable = featuredCreditUsers.map((user) => {
      const latestEntitlement = entitlementByUserAndType.get(`${user._id}:featured_listing`);
      return buildEntitlementListItem({
        user,
        entitlementType: 'featured_listing',
        source: latestEntitlement?.source || 'current_state',
        startAt: latestEntitlement?.startAt || null,
        expiresAt: latestEntitlement?.expiresAt || null,
        quantity: Number(user.featuredCredits || 0) + Number(latestEntitlement?.usedQuantity || 0),
        usedQuantity: Number(latestEntitlement?.usedQuantity || 0),
        actionAt: latestEntitlement?.createdAt || user.updatedAt,
        grantedByAdmin: latestEntitlement?.grantedByAdminId || null,
        note: latestEntitlement?.note || ''
      });
    });

    const usedFeatured = entitlementHistory
      .filter((item) => item.entitlementType === 'featured_listing' && Number(item.usedQuantity || 0) > 0)
      .map((item) =>
        buildEntitlementListItem({
          user: item.userId,
          entitlementType: item.entitlementType,
          source: item.source,
          startAt: item.startAt,
          expiresAt: item.expiresAt,
          quantity: item.quantity,
          usedQuantity: item.usedQuantity,
          actionAt: item.updatedAt || item.createdAt,
          grantedByAdmin: item.grantedByAdminId,
          note: item.note
        })
      );

    const adminGranted = entitlementHistory
      .filter((item) => item.source === 'admin_grant')
      .map((item) =>
        buildEntitlementListItem({
          user: item.userId,
          entitlementType: item.entitlementType,
          source: item.source,
          startAt: item.startAt,
          expiresAt: item.expiresAt,
          quantity: item.quantity,
          usedQuantity: item.usedQuantity,
          actionAt: item.createdAt,
          grantedByAdmin: item.grantedByAdminId,
          note: item.note
        })
      );

    const purchasers = paidPayments.map((payment) => {
      const entitlementType = payment.planCode?.startsWith('featured')
        ? 'featured_listing'
        : payment.planCode === 'listing_extra'
          ? 'listing_extra'
          : 'premium';
      return buildEntitlementListItem({
        user: payment.user,
        entitlementType,
        source: 'purchase',
        startAt: payment.paidAt || payment.updatedAt,
        expiresAt: null,
        quantity: 1,
        usedQuantity: 0,
        actionAt: payment.paidAt || payment.updatedAt,
        payment
      });
    });

    return res.status(200).json({
      success: true,
      data: {
        sections: [
          { key: 'activePremiumUsers', title: 'Premium aktif kullanıcılar', items: activePremium },
          { key: 'featuredCreditUsers', title: 'Öne çıkarma hakkı olan kullanıcılar', items: featuredAvailable },
          { key: 'featuredUsedUsers', title: 'Öne çıkarma hakkını kullanan kullanıcılar', items: usedFeatured },
          { key: 'purchasers', title: 'Satın alan kullanıcılar', items: purchasers },
          { key: 'adminGrantedUsers', title: 'Admin tarafından manuel hak verilen kullanıcılar', items: adminGranted }
        ]
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const listAppMonetizationPlans = async (_req, res, next) => {
  try {
    await ensureMonetizationPlans();
    const items = (await MonetizationPlan.find({ showInApp: true }).sort({ sortOrder: 1, title: 1 }).lean())
      .filter((item) => item.isActive)
      .map(serializePlanForAdmin);
    return res.status(200).json({ success: true, items });
  } catch (error) {
    return next(error);
  }
};

export const listPublicMonetizationPlans = async (_req, res, next) => {
  try {
    await ensureMonetizationPlans();
    const settings = await getListingQuotaSettings();
    const plans = await MonetizationPlan.find({ showInApp: true, isActive: true })
      .sort({ sortOrder: 1, title: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        notice:
          'Talepet yalnizca dijital gorunurluk, premium hak ve ilan paketleri satar. Kullanicilar arasinda odeme araciligi yapmaz.',
        items: [buildListingExtraPublicPlan(settings), ...plans.map(serializePublicPlan)]
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const getPublicHowItWorks = async (_req, res, next) => {
  try {
    return res.status(200).json({ success: true, data: HOW_IT_WORKS_PAYLOAD });
  } catch (error) {
    return next(error);
  }
};

export const getMySubscriptionSummary = async (req, res, next) => {
  try {
    const user = await User.findById(req.user?.id).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanici bulunamadi.' });
    }

    const subscription = await Subscription.findOne({
      user: user._id,
      status: { $in: ['active', 'past_due'] }
    }).lean();
    const now = new Date();
    const premiumActive = Boolean(user.isPremium && (!user.premiumUntil || user.premiumUntil > now));

    return res.status(200).json({
      success: true,
      data: {
        premiumActive,
        premiumUntil: user.premiumUntil || null,
        featuredCredits: Number(user.featuredCredits || 0),
        paidListingCredits: Number(user.paidListingCredits || 0),
        subscription: subscription || null,
        notices: [
          'Talepet kullanicilar arasinda odeme araciligi yapmaz.',
          'Talepet yalnizca dijital premium haklar ve gorunurluk hizmetleri sunar.'
        ]
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyListingQuotaSummary = async (req, res, next) => {
  try {
    const user = await User.findById(req.user?.id).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanici bulunamadi.' });
    }

    const settings = await getListingQuotaSettings();
    const quota = getListingQuotaSnapshot(user, settings);

    return res.status(200).json({
      success: true,
      data: {
        limit: quota.maxFree,
        used: quota.usedFree,
        remaining: quota.remainingFree,
        windowDays: quota.periodDays,
        resetAt: quota.windowEnd || null,
        paidCredits: quota.paidListingCredits,
        extraEnabled: quota.extraEnabled,
        extraPrice: quota.extraPrice,
        currency: quota.currency,
        notice:
          'Kalan ilan hakki ve ek ilan kredileri dijital platform hakki olarak hesabina tanimlanir.'
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyPublishingRightsSummary = async (req, res, next) => {
  try {
    const summary = await getPublishingRightsSummary(req.user?.id);
    if (!summary) {
      return res.status(404).json({ success: false, message: 'Kullanici bulunamadi.' });
    }
    return res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    return next(error);
  }
};
