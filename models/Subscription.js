import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    provider: {
      type: String,
      default: 'iyzico'
    },
    planCode: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['active', 'past_due', 'canceled', 'ended'],
      default: 'active'
    },
    providerSubId: {
      type: String,
      index: true
    },
    currentPeriodStart: {
      type: Date
    },
    currentPeriodEnd: {
      type: Date
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false
    },
    cancelRequestedAt: {
      type: Date
    },
    canceledAt: {
      type: Date
    }
  },
  { timestamps: true }
);

const Subscription = mongoose.model('Subscription', subscriptionSchema);

export default Subscription;
