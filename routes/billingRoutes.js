import { Router } from 'express';
import mongoose from 'mongoose';
import { authMiddleware } from '../middleware/authMiddleware.js';
import Plan from '../models/Plan.js';
import Payment from '../models/Payment.js';
import Subscription from '../models/Subscription.js';
import User from '../models/User.js';
import WebhookEvent from '../models/WebhookEvent.js';
import iyzico from '../src/providers/iyzico/index.js';

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
    }
  ];

  await Promise.all(
    plans.map((plan) =>
      Plan.findOneAndUpdate({ code: plan.code }, { $setOnInsert: plan }, { upsert: true, new: true })
    )
  );
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

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanici bulunamadi.'
      });
    }

    const mode = plan.isRecurring ? 'subscription' : 'one_time';
    const payment = await Payment.create({
      user: user._id,
      provider: 'iyzico',
      mode,
      planCode: plan.code,
      amount: plan.price,
      currency: plan.currency,
      status: 'pending'
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
        mode: payment.mode
      }
    });
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
            rawLastEvent: event.raw
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
          { status: 'paid', rawLastEvent: event.raw },
          { new: true }
        );
      }

      const userId = payment?.user || event.userId;
      if (userId) {
        const user = await User.findById(userId);
        if (user) {
          const oneTimeDurationDays = 30;
          if (payment?.planCode === 'featured_one_time') {
            user.featuredCredits = Number(user.featuredCredits || 0) + 1;
            await user.save();
          } else if (payment?.mode === 'subscription') {
            const periodEnd = event.periodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            user.isPremium = true;
            user.premiumUntil = periodEnd;
            user.premiumSource = 'payment';
            await user.save();

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
