import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { pathToFileURL } from 'url';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';

const REVIEWER_USERS = [
  {
    key: 'standard',
    label: 'Reviewer account ready',
    name: 'Talepet Reviewer',
    firstName: 'Talepet',
    lastName: 'Reviewer',
    email: 'review.user@talepet.net.tr',
    password: 'TalepetReview2026!',
    role: 'buyer',
    city: 'Istanbul',
    isPremium: false,
    premiumUntil: null,
    premiumSource: 'promo',
    featuredCredits: 0,
    paidListingCredits: 0,
    subscription: null
  },
  {
    key: 'premium',
    label: 'Premium reviewer account ready',
    name: 'Talepet Premium Reviewer',
    firstName: 'Talepet',
    lastName: 'Premium Reviewer',
    email: 'premium.review@talepet.net.tr',
    password: 'TalepetPremium2026!',
    role: 'buyer',
    city: 'Istanbul',
    isPremium: true,
    premiumUntil: new Date('2027-12-31T23:59:59.999Z'),
    premiumSource: 'promo',
    featuredCredits: 12,
    paidListingCredits: 40,
    subscription: {
      provider: 'iyzico',
      planCode: 'premium_yearly',
      status: 'active',
      providerSubId: 'review-premium-annual',
      currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2027-12-31T23:59:59.999Z'),
      cancelAtPeriodEnd: false
    }
  }
];

const WINDOW_START = new Date('2026-05-01T00:00:00.000Z');
const WINDOW_END = new Date('2026-05-31T23:59:59.999Z');

const ensurePassword = async (user, nextPassword) => {
  if (!nextPassword) return;
  const hasPassword = Boolean(user.password);
  const matches = hasPassword ? await bcrypt.compare(nextPassword, user.password) : false;
  if (!matches) {
    user.password = nextPassword;
  }
};

const ensureReviewerUser = async (config) => {
  const user = (await User.findOne({ email: config.email }).select('+password')) || new User();

  user.name = config.name;
  user.firstName = config.firstName;
  user.lastName = config.lastName;
  user.email = config.email;
  user.role = 'buyer';
  user.phone = '';
  user.phoneE164 = undefined;
  user.phoneVerified = false;
  user.emailVerified = true;
  user.isActive = true;
  user.isDeleted = false;
  user.city = config.city;
  user.locationSelection = {
    city: config.city,
    district: '',
    neighborhood: '',
    street: ''
  };
  user.isOnboardingCompleted = true;
  user.isPremium = Boolean(config.isPremium);
  user.premiumUntil = config.premiumUntil;
  user.premiumSource = config.premiumSource;
  user.featuredCredits = Number(config.featuredCredits || 0);
  user.paidListingCredits = Number(config.paidListingCredits || 0);
  user.listingQuotaWindowStart = WINDOW_START;
  user.listingQuotaWindowEnd = WINDOW_END;
  user.listingQuotaUsedFree = 0;
  user.paymentProvider = '';
  user.paymentCustomerId = '';
  user.paymentMethod = null;
  user.lastLoginAt = user.lastLoginAt || null;

  await ensurePassword(user, config.password);
  user.recomputeTrustScore();
  await user.save();

  return user;
};

const ensureReviewerSubscription = async (user, subscriptionConfig) => {
  await Subscription.deleteMany({
    user: user._id,
    providerSubId: { $regex: /^review-/i },
    provider: 'iyzico'
  });

  if (!subscriptionConfig) {
    await Subscription.updateMany(
      { user: user._id, status: { $in: ['active', 'past_due'] } },
      { $set: { status: 'ended', cancelAtPeriodEnd: false } }
    );
    return null;
  }

  return Subscription.findOneAndUpdate(
    { user: user._id, providerSubId: subscriptionConfig.providerSubId },
    {
      $set: {
        user: user._id,
        provider: subscriptionConfig.provider,
        planCode: subscriptionConfig.planCode,
        status: subscriptionConfig.status,
        providerSubId: subscriptionConfig.providerSubId,
        currentPeriodStart: subscriptionConfig.currentPeriodStart,
        currentPeriodEnd: subscriptionConfig.currentPeriodEnd,
        cancelAtPeriodEnd: Boolean(subscriptionConfig.cancelAtPeriodEnd),
        canceledAt: null,
        cancelRequestedAt: null
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

export const createReviewerAccounts = async () => {
  await connectDB();

  for (const config of REVIEWER_USERS) {
    const user = await ensureReviewerUser(config);
    const subscription = await ensureReviewerSubscription(user, config.subscription);

    console.log(`${config.label}:`);
    console.log(`email: ${config.email}`);
    console.log(`password: ${config.password}`);
    console.log(`role: ${user.role}`);
    console.log(`premium: ${user.isPremium ? 'active' : 'inactive'}`);
    console.log(`featuredCredits: ${Number(user.featuredCredits || 0)}`);
    console.log(`paidListingCredits: ${Number(user.paidListingCredits || 0)}`);
    if (subscription) {
      console.log(`subscription: ${subscription.planCode} (${subscription.status})`);
      console.log(`subscriptionEnds: ${subscription.currentPeriodEnd.toISOString()}`);
    }
    if (user.premiumUntil) {
      console.log(`premiumUntil: ${user.premiumUntil.toISOString()}`);
    }
    console.log('');
  }
};

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  createReviewerAccounts()
    .then(async () => {
      await mongoose.connection.close();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('REVIEWER_ACCOUNT_SEED_ERROR:', error);
      try {
        await mongoose.connection.close();
      } catch (_closeError) {
        // ignore close failure
      }
      process.exit(1);
    });
}
