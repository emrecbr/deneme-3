import mongoose from 'mongoose';

const notificationSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['category', 'category_city', 'category_city_district', 'keyword'],
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
    keyword: {
      type: String,
      trim: true
    },
    keywordNormalized: {
      type: String,
      trim: true
    },
    key: {
      type: String,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    notifyPush: {
      type: Boolean,
      default: true
    },
    notifyInApp: {
      type: Boolean,
      default: false
    },
    lastTriggeredAt: {
      type: Date
    },
    triggerCount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

notificationSubscriptionSchema.index({ user: 1, key: 1 }, { unique: true });
notificationSubscriptionSchema.index({ type: 1, isActive: 1 });

const NotificationSubscription = mongoose.model('NotificationSubscription', notificationSubscriptionSchema);

export default NotificationSubscription;
