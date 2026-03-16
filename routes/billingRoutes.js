import { Router } from 'express';
import mongoose from 'mongoose';
import { authMiddleware } from '../middleware/authMiddleware.js';
import Plan from '../models/Plan.js';
import Payment from '../models/Payment.js';
import Subscription from '../models/Subscription.js';
import User from '../models/User.js';
import WebhookEvent from '../models/WebhookEvent.js';
import iyzico from '../src/providers/iyzico/index.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import { getListingQuotaSettings } from '../src/utils/listingQuota.js';
import PaymentMethod from '../models/PaymentMethod.js';
import MonetizationPlan from '../models/MonetizationPlan.js';
import { ensureMonetizationPlans } from '../controllers/monetizationController.js';
import { sendPushToUser } from '../src/services/pushNotificationService.js';

const billingRoutes = Router();
const isDev = process.env.NODE_ENV !== 'production';

const ensurePlans = async () => {
  const plans = [
    {
      code: 'premium_monthly',
      name: 'Premium Aylik',
      price: 249,
      currency: 'TRY',
      interval: 'month',
      isRecurring: true
    },
    {
      code: 'premium_yearly',
      name: 'Premium Yillik',
      price: 2490,
      currency: 'TRY',
      interval: 'year',
      isRecurring: true
    },
    {
      code: 'featured_one_time',
      name: 'Öne Çıkanlar',
      price: 149,
      currency: 'TRY',
      interval: null,
      isRecurring: false
    },
    {
      code: 'featured_monthly',
      name: 'Öne Çıkanlar Aylık',
      price: 149,
      currency: 'TRY',
      interval: 'month',
      isRecurring: false
    },
    {
      code: 'featured_yearly',
      name: 'Öne Çıkanlar Yıllık',
      price: 1490,
      currency: 'TRY',
      interval: 'year',
      isRecurring: false
    },
    {
      code: 'listing_extra',
      name: 'Ek İlan',
      price: 99,
      currency: 'TRY',
      interval: null,
      isRecurring: false
    },
    {
      code: 'payment_method_setup',
      name: 'Kart Ekleme',
      price: 1,
      currency: 'TRY',
      interval: null,
      isRecurring: false
    }
  ];

  await Promise.all(
    plans.map((plan) =>
      Plan.findOneAndUpdate({ code: plan.code }, { $setOnInsert: plan }, { upsert: true, new: true })
    )
  );
};

const logAudit = async (action, meta = {}) => {
  try {
    await AdminAuditLog.create({
      adminId: null,
      role: 'system',
      action,
      meta
    });
  } catch (_error) {
    // ignore audit
  }
};

const extractCardSummary = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const card =
    raw?.paymentCard ||
    raw?.card ||
    raw?.payment?.paymentCard ||
    raw?.payment?.card ||
    raw?.paymentCardDetail ||
    null;
  if (!card || typeof card !== 'object') return null;
  const brand =
    card?.cardAssociation ||
    card?.cardType ||
    card?.cardFamily ||
    card?.brand ||
    null;
  const last4 =
    card?.lastFourDigits ||
    card?.last4 ||
    card?.binNumber?.slice?.(-4) ||
    null;
  const expMonth = card?.expireMonth || card?.expMonth || null;
  const expYear = card?.expireYear || card?.expYear || null;
  const holderName = card?.cardHolderName || card?.holderName || null;
  if (!brand && !last4 && !expMonth && !expYear) return null;
  return { brand, last4, expMonth, expYear, holderName };
};

const resolveMonetizationByPlanCode = async (planCode) => {
  await ensureMonetizationPlans();
  const plan = await MonetizationPlan.findOne({
    $or: [
      { 'metadata.planCodes.monthly': planCode },
      { 'metadata.planCodes.yearly': planCode },
      { 'metadata.planCodes.one_time': planCode }
    ]
  }).lean();
  if (!plan) return null;
  let mode = 'monthly';
  if (plan.metadata?.planCodes?.yearly === planCode) mode = 'yearly';
  if (plan.metadata?.planCodes?.one_time === planCode) mode = 'one_time';
  if (!plan.isActive) {
    return { plan, mode, price: 0, blockedReason: 'inactive' };
  }
  if (!plan.showInApp) {
    return { plan, mode, price: 0, blockedReason: 'hidden' };
  }
  if (Array.isArray(plan.billingModes) && !plan.billingModes.includes(mode)) {
    return { plan, mode, price: 0, blockedReason: 'mode_disabled' };
  }
  const price =
    mode === 'yearly'
      ? Number(plan.yearlyPrice || 0)
      : mode === 'monthly'
        ? Number(plan.monthlyPrice || 0)
        : Number(plan.monthlyPrice || 0);
  return { plan, mode, price };
};

const upsertPaymentMethod = async ({ user, providerMethodId, cardSummary }) => {
  if (!user || !providerMethodId || !cardSummary) return;
  await PaymentMethod.updateMany({ user: user._id }, { $set: { isDefault: false } });
  await PaymentMethod.findOneAndUpdate(
    { user: user._id, providerPaymentMethodId: providerMethodId },
    {
      user: user._id,
      provider: 'iyzico',
      providerPaymentMethodId: providerMethodId,
      brand: cardSummary.brand || '',
      last4: cardSummary.last4 || '',
      expMonth: cardSummary.expMonth || '',
      expYear: cardSummary.expYear || '',
      holderName: cardSummary.holderName || '',
      isDefault: true,
      isDeleted: false
    },
    { upsert: true, new: true }
  );
  user.paymentProvider = 'iyzico';
  user.paymentMethod = {
    brand: cardSummary.brand || '',
    last4: cardSummary.last4 || '',
    expMonth: cardSummary.expMonth || '',
    expYear: cardSummary.expYear || '',
    holderName: cardSummary.holderName || ''
  };
};

billingRoutes.get('/plans', authMiddleware, async (_req, res, next) => {
  try {
    await ensurePlans();
    const plans = await Plan.find({ active: true }).sort({ price: 1 });
    return res.status(200).json({
      success: true,
      data: plans
    });
  } catch (error) {
    return next(error);
  }
});

billingRoutes.post('/checkout', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const planCode = String(req.body?.planCode || '').trim();
    if (!planCode) {
      return res.status(400).json({
        success: false,
        message: 'Plan secilmelidir.'
      });
    }
    await ensurePlans();
    const plan = await Plan.findOne({ code: planCode, active: true });
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan bulunamadi.'
      });
    }

    const monetizationInfo = await resolveMonetizationByPlanCode(planCode);
    if (monetizationInfo?.plan) {
      if (monetizationInfo.blockedReason) {
        return res.status(400).json({
          success: false,
          message: 'Plan şu anda kullanılamıyor.'
        });
      }
      plan.price = monetizationInfo.price;
      plan.currency = monetizationInfo.plan.currency || plan.currency || 'TRY';
      if (Number.isFinite(plan.price) && plan.price <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Plan fiyatı geçersiz.'
        });
      }
    }

    if (plan.code === 'listing_extra') {
      const settings = await getListingQuotaSettings();
      if (!settings.extraEnabled) {
        return res.status(400).json({
          success: false,
          message: 'Ek ilan ödemesi şu anda kapalı.'
        });
      }
      plan.price = Number(settings.extraPrice || plan.price);
      plan.currency = settings.currency || plan.currency || 'TRY';
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanici bulunamadi.'
      });
    }

    const mode = plan.isRecurring ? 'subscription' : 'one_time';
    const snapshotTitle = monetizationInfo?.plan?.title || plan.name;
    const snapshotBillingMode = monetizationInfo?.mode || (plan.interval === 'year' ? 'yearly' : 'monthly');
    const snapshotCurrency = monetizationInfo?.plan?.currency || plan.currency;
    const snapshotPrice = Number(plan.price);
    const payment = await Payment.create({
      user: user._id,
      provider: 'iyzico',
      mode,
      planCode: plan.code,
      amount: plan.price,
      currency: plan.currency,
      planTitleSnapshot: snapshotTitle,
      billingModeSnapshot: snapshotBillingMode,
      currencySnapshot: snapshotCurrency,
      priceSnapshot: snapshotPrice,
      status: 'pending',
      contextType: plan.code === 'listing_extra' ? 'listing_extra' : undefined
    });

    const checkout = await iyzico.createCheckout({ user, plan, mode, paymentId: payment._id.toString() });
    payment.providerPaymentId = checkout.providerPaymentId || payment.providerPaymentId;
    payment.conversationId = checkout.conversationId || payment.conversationId;
    payment.rawLastEvent = checkout.raw || null;
    await payment.save();

    return res.status(200).json({
      success: true,
      checkoutUrl: checkout.checkoutUrl,
      paymentId: payment._id
    });
  } catch (error) {
    return next(error);
  }
});

billingRoutes.post('/listing-extra/checkout', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanici bulunamadi.' });
    }
    const settings = await getListingQuotaSettings();
    if (!settings.extraEnabled) {
      return res.status(400).json({ success: false, message: 'Ek ilan ödemesi kapalı.' });
    }
    const plan = {
      code: 'listing_extra',
      name: 'Ek İlan',
      price: Number(settings.extraPrice || 0),
      currency: settings.currency || 'TRY',
      isRecurring: false
    };
    if (!Number.isFinite(plan.price) || plan.price <= 0) {
      return res.status(400).json({ success: false, message: 'Ek ilan ücreti geçersiz.' });
    }

    const payment = await Payment.create({
      user: user._id,
      provider: 'iyzico',
      mode: 'one_time',
      planCode: plan.code,
      amount: plan.price,
      currency: plan.currency,
      planTitleSnapshot: plan.name,
      billingModeSnapshot: 'one_time',
      currencySnapshot: plan.currency,
      priceSnapshot: plan.price,
      status: 'pending',
      contextType: 'listing_extra'
    });

    await logAudit('listing_paid_create_started', { userId, paymentId: payment._id });

    const checkout = await iyzico.createCheckout({ user, plan, mode: 'one_time', paymentId: payment._id.toString() });
    payment.providerPaymentId = checkout.providerPaymentId || payment.providerPaymentId;
    payment.conversationId = checkout.conversationId || payment.conversationId;
    payment.rawLastEvent = checkout.raw || null;
    await payment.save();

    return res.status(200).json({
      success: true,
      checkoutUrl: checkout.checkoutUrl,
      paymentId: payment._id
    });
  } catch (error) {
    return next(error);
  }
});

billingRoutes.post('/payment-method/checkout', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanici bulunamadi.' });
    }
    const settings = await getListingQuotaSettings();
    if (settings?.paymentMethodSetupEnabled === false) {
      return res.status(400).json({ success: false, message: 'Kart ekleme şu an kapalı.' });
    }
    const setupPrice = Number(settings?.paymentMethodSetupPrice ?? 1);
    if (!Number.isFinite(setupPrice) || setupPrice < 0) {
      return res.status(400).json({ success: false, message: 'Kart ekleme ücreti geçersiz.' });
    }

    const plan = {
      code: 'payment_method_setup',
      name: 'Kart Ekleme',
      price: setupPrice,
      currency: settings?.currency || 'TRY',
      isRecurring: false
    };

    const payment = await Payment.create({
      user: user._id,
      provider: 'iyzico',
      mode: 'one_time',
      planCode: plan.code,
      amount: plan.price,
      currency: plan.currency,
      planTitleSnapshot: plan.name,
      billingModeSnapshot: 'one_time',
      currencySnapshot: plan.currency,
      priceSnapshot: plan.price,
      status: 'pending',
      contextType: 'payment_method_setup'
    });

    await logAudit('payment_method_add', { userId, paymentId: payment._id });

    const checkout = await iyzico.createCheckout({ user, plan, mode: 'one_time', paymentId: payment._id.toString() });
    payment.providerPaymentId = checkout.providerPaymentId || payment.providerPaymentId;
    payment.conversationId = checkout.conversationId || payment.conversationId;
    payment.rawLastEvent = checkout.raw || null;
    await payment.save();

    return res.status(200).json({
      success: true,
      checkoutUrl: checkout.checkoutUrl,
      paymentId: payment._id
    });
  } catch (error) {
    return next(error);
  }
});

billingRoutes.get('/payment/:paymentId', authMiddleware, async (req, res, next) => {
  try {
    const paymentId = String(req.params.paymentId || '').trim();
    if (!mongoose.isValidObjectId(paymentId)) {
      return res.status(400).json({
        success: false,
        message: 'Gecerli bir odeme kimligi gerekli.'
      });
    }
    const payment = await Payment.findById(paymentId).lean();
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Odeme bulunamadi.'
      });
    }
    if (payment.user?.toString?.() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Bu odemeyi gorme yetkin yok.'
      });
    }
    return res.status(200).json({
      success: true,
      data: {
        status: payment.status,
        planCode: payment.planCode,
        mode: payment.mode,
        saveCardConsent: payment.saveCardConsent ?? null
      }
    });
  } catch (error) {
    return next(error);
  }
});

billingRoutes.post('/payment-method/consent', authMiddleware, async (req, res, next) => {
  try {
    const paymentId = String(req.body?.paymentId || '').trim();
    const saveCard = Boolean(req.body?.saveCard);
    if (!mongoose.isValidObjectId(paymentId)) {
      return res.status(400).json({ success: false, message: 'Gecerli bir odeme kimligi gerekli.' });
    }
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Odeme bulunamadi.' });
    }
    if (payment.user?.toString?.() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bu odeme icin yetkin yok.' });
    }
    if (payment.planCode !== 'payment_method_setup') {
      return res.status(400).json({ success: false, message: 'Bu odeme kart kaydi icin uygun degil.' });
    }
    if (payment.status !== 'paid') {
      return res.status(400).json({ success: false, message: 'Odeme tamamlanmamis.' });
    }

    if (!saveCard) {
      payment.saveCardConsent = false;
      payment.saveCardDecidedAt = new Date();
      payment.cardSummary = null;
      await payment.save();
      await logAudit('payment_method_add', { userId: req.user.id, paymentId, status: 'declined' });
      return res.status(200).json({ success: true, saved: false });
    }

    const cardSummary = payment.cardSummary || extractCardSummary(payment.rawLastEvent);
    if (!cardSummary) {
      return res.status(400).json({ success: false, message: 'Kart bilgisi saglanamadi.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanici bulunamadi.' });
    }
    const providerMethodId = payment.providerPaymentId || payment._id?.toString?.();
    await upsertPaymentMethod({ user, providerMethodId, cardSummary });
    await user.save();
    payment.cardSummary = cardSummary;
    payment.saveCardConsent = true;
    payment.saveCardDecidedAt = new Date();
    await payment.save();
    await logAudit('payment_method_add', { userId: req.user.id, paymentId, status: 'saved' });
    return res.status(200).json({ success: true, saved: true });
  } catch (error) {
    return next(error);
  }
});

billingRoutes.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanici bulunamadi.'
      });
    }
    const subscription = await Subscription.findOne({ user: user._id, status: { $in: ['active', 'past_due'] } }).lean();
    const now = new Date();
    const premiumActive = Boolean(user.isPremium && (!user.premiumUntil || user.premiumUntil > now));
    return res.status(200).json({
      success: true,
      data: {
        premiumActive,
        premiumUntil: user.premiumUntil || null,
        subscription: subscription || null,
        featuredCredits: Number(user.featuredCredits || 0)
      }
    });
  } catch (error) {
    return next(error);
  }
});

billingRoutes.post('/subscription/cancel', authMiddleware, async (req, res, next) => {
  try {
    const subscriptionId = String(req.body?.subscriptionId || '').trim();
    if (!subscriptionId || !mongoose.isValidObjectId(subscriptionId)) {
      return res.status(400).json({
        success: false,
        message: 'Gecerli bir abonelik secilmelidir.'
      });
    }
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Abonelik bulunamadi.'
      });
    }
    if (subscription.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Bu abonelik icin yetkin yok.'
      });
    }
    subscription.cancelAtPeriodEnd = true;
    subscription.cancelRequestedAt = new Date();
    await subscription.save();
    return res.status(200).json({
      success: true,
      message: 'Abonelik donem sonunda iptal edilecek.',
      data: subscription
    });
  } catch (error) {
    return next(error);
  }
});

billingRoutes.post('/webhook/iyzico', async (req, res, _next) => {
  try {
    iyzico.verifyWebhook(req);
    const event = iyzico.parseWebhook(req);
    if (isDev) {
      console.log('[BILLING_WEBHOOK]', {
        eventType: event.eventType,
        eventId: event.eventId,
        planCode: event.planCode,
        userId: event.userId
      });
    }

    try {
      await WebhookEvent.create({
        provider: 'iyzico',
        eventId: event.eventId,
        payload: event.raw
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(200).json({ success: true, duplicate: true });
      }
      throw error;
    }

    if (event.eventType === 'payment.succeeded') {
      let payment = null;
      if (event.providerPaymentId) {
        payment = await Payment.findOneAndUpdate(
          {
            provider: 'iyzico',
            providerPaymentId: event.providerPaymentId
          },
          {
            status: 'paid',
            rawLastEvent: event.raw,
            paidAt: new Date()
          },
          { new: true }
        );
      }

      if (!payment && event.userId && event.planCode) {
        payment = await Payment.findOneAndUpdate(
          {
            provider: 'iyzico',
            user: event.userId,
            planCode: event.planCode,
            status: 'pending'
          },
          { status: 'paid', rawLastEvent: event.raw, paidAt: new Date() },
          { new: true }
        );
      }

      const userId = payment?.user || event.userId;
      if (userId) {
        const user = await User.findById(userId);
        if (user) {
          const cardSummary = extractCardSummary(event.raw);
          const planCode = payment?.planCode || event.planCode;
          const providerMethodId = payment?.providerPaymentId || event.providerPaymentId || payment?._id?.toString();
          if (cardSummary && planCode === 'payment_method_setup') {
            payment.cardSummary = cardSummary;
            if (payment.saveCardConsent === true) {
              await upsertPaymentMethod({ user, providerMethodId, cardSummary });
              await user.save();
            }
            await payment.save();
          } else if (cardSummary && planCode !== 'payment_method_setup') {
            await upsertPaymentMethod({ user, providerMethodId, cardSummary });
            await user.save();
          }
          const oneTimeDurationDays = 30;
          if (payment?.planCode === 'payment_method_setup') {
            await logAudit('payment_method_add', { userId, paymentId: payment?._id });
          } else if (payment?.planCode === 'listing_extra') {
            user.paidListingCredits = Number(user.paidListingCredits || 0) + 1;
            await user.save();
            await logAudit('listing_paid_create_success', { userId, paymentId: payment?._id });
            await sendPushToUser({
              userId,
              type: 'payment_success',
              payload: { planCode: payment?.planCode }
            });
          } else if (payment?.planCode && payment.planCode.startsWith('featured')) {
            user.featuredCredits = Number(user.featuredCredits || 0) + 1;
            await user.save();
            await sendPushToUser({
              userId,
              type: 'featured_activated',
              payload: { planCode: payment?.planCode }
            });
          } else if (payment?.mode === 'subscription') {
            const periodEnd = event.periodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            user.isPremium = true;
            user.premiumUntil = periodEnd;
            user.premiumSource = 'payment';
            await user.save();
            await sendPushToUser({
              userId,
              type: 'premium_activated',
              payload: { planCode: payment?.planCode }
            });

            await Subscription.findOneAndUpdate(
              { user: user._id, providerSubId: event.providerSubId || payment?.providerPaymentId },
              {
                user: user._id,
                provider: 'iyzico',
                planCode: payment?.planCode || event.planCode || 'premium_monthly',
                status: 'active',
                providerSubId: event.providerSubId || payment?.providerPaymentId,
                currentPeriodStart: event.periodStart || new Date(),
                currentPeriodEnd: periodEnd
              },
              { upsert: true, new: true }
            );
          } else {
            const premiumUntil = new Date(Date.now() + oneTimeDurationDays * 24 * 60 * 60 * 1000);
            user.isPremium = true;
            user.premiumUntil = premiumUntil;
            user.premiumSource = 'payment';
            await user.save();
            await sendPushToUser({
              userId,
              type: 'premium_activated',
              payload: { planCode: payment?.planCode }
            });
          }
        }
      }
    }

    if (event.eventType === 'payment.failed') {
      if (event.providerPaymentId) {
        await Payment.findOneAndUpdate(
          { providerPaymentId: event.providerPaymentId },
          { status: 'failed', rawLastEvent: event.raw }
        );
      }
      if (event.planCode === 'listing_extra' && event.userId) {
        await logAudit('listing_paid_create_failed', { userId: event.userId });
      }
      if (event.planCode === 'payment_method_setup' && event.userId) {
        await logAudit('payment_method_add', { userId: event.userId, status: 'failed' });
      }
    }

    if (event.eventType === 'subscription.renewed') {
      const subscription = await Subscription.findOneAndUpdate(
        { providerSubId: event.providerSubId },
        {
          status: 'active',
          currentPeriodStart: event.periodStart || new Date(),
          currentPeriodEnd: event.periodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },
        { new: true }
      );
      if (subscription?.user) {
        await User.findByIdAndUpdate(subscription.user, {
          isPremium: true,
          premiumUntil: subscription.currentPeriodEnd,
          premiumSource: 'payment'
        });
      }
    }

    if (event.eventType === 'subscription.canceled') {
      const subscription = await Subscription.findOneAndUpdate(
        { providerSubId: event.providerSubId },
        { status: 'canceled', canceledAt: new Date() },
        { new: true }
      );
      if (subscription?.user) {
        const user = await User.findById(subscription.user);
        if (user && user.premiumUntil && user.premiumUntil <= new Date()) {
          user.isPremium = false;
          user.premiumUntil = null;
          await user.save();
        }
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    if (isDev) {
      console.warn('[BILLING_WEBHOOK_ERROR]', error?.message || error);
    }
    return res.status(200).json({ success: true });
  }
});

export default billingRoutes;
