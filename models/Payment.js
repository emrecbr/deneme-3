import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
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
    mode: {
      type: String,
      enum: ['one_time', 'subscription'],
      required: true
    },
    planCode: {
      type: String,
      required: true
    },
    planTitleSnapshot: {
      type: String
    },
    billingModeSnapshot: {
      type: String
    },
    currencySnapshot: {
      type: String
    },
    priceSnapshot: {
      type: Number
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'TRY'
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    lifecycleStatus: {
      type: String,
      enum: ['initiated', 'pending', 'webhook_received', 'succeeded', 'failed', 'cancelled', 'refunded'],
      default: 'initiated'
    },
    providerPaymentId: {
      type: String,
      index: true
    },
    conversationId: {
      type: String,
      index: true
    },
    rawLastEvent: {
      type: mongoose.Schema.Types.Mixed
    },
    cardSummary: {
      type: mongoose.Schema.Types.Mixed
    },
    saveCardConsent: {
      type: Boolean,
      default: null
    },
    saveCardDecidedAt: {
      type: Date
    },
    contextType: {
      type: String,
      trim: true
    },
    contextId: {
      type: mongoose.Schema.Types.ObjectId
    },
    paidAt: {
      type: Date
    },
    webhookReceivedAt: {
      type: Date
    },
    lastWebhookEventId: {
      type: String
    },
    fulfillmentStatus: {
      type: String,
      enum: ['pending', 'processing', 'done', 'failed', 'skipped'],
      default: 'pending'
    },
    fulfillmentDoneAt: {
      type: Date
    },
    fulfillmentAttempts: {
      type: Number,
      default: 0
    },
    lastErrorCode: {
      type: String
    }
  },
  { timestamps: true }
);

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
