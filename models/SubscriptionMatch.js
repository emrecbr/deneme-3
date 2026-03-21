import mongoose from 'mongoose';

const subscriptionMatchSchema = new mongoose.Schema(
  {
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NotificationSubscription',
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    rfq: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RFQ',
      required: true
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    },
    city: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'City'
    },
    district: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'District'
    },
    matchedBy: {
      type: String,
      enum: ['category', 'category_city', 'category_city_district', 'keyword'],
      required: true
    },
    isSeen: {
      type: Boolean,
      default: false
    },
    isNotified: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

subscriptionMatchSchema.index({ user: 1, subscription: 1, createdAt: -1 });
subscriptionMatchSchema.index({ user: 1, isSeen: 1, createdAt: -1 });
subscriptionMatchSchema.index({ subscription: 1, rfq: 1 }, { unique: true });

const SubscriptionMatch = mongoose.model('SubscriptionMatch', subscriptionMatchSchema);

export default SubscriptionMatch;
