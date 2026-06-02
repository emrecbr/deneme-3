import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    title: {
      type: String,
      trim: true
    },
    body: {
      type: String,
      trim: true
    },
    type: {
      type: String,
      enum: [
        'offer_created',
        'offer_updated',
        'offer_accepted',
        'offer_rejected',
        'message',
        'rfq_updated',
        'new_matching_rfq',
        'listing_expiring',
        'listing_expired',
        'moderation_result',
        'payment_success',
        'premium_activated',
        'featured_activated',
        'report_resolved',
        'system'
      ],
      default: 'system'
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    isRead: {
      type: Boolean,
      default: false
    },
    readAt: {
      type: Date
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId
    },
    targetType: {
      type: String,
      trim: true
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId
    },
    targetUrl: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
