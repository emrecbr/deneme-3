import mongoose from 'mongoose';

const notificationLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    provider: {
      type: String,
      default: 'onesignal'
    },
    channel: {
      type: String,
      default: 'push'
    },
    type: {
      type: String,
      required: true
    },
    title: {
      type: String,
      default: ''
    },
    body: {
      type: String,
      default: ''
    },
    payload: {
      type: mongoose.Schema.Types.Mixed
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'failed', 'opened', 'clicked'],
      default: 'queued'
    },
    providerMessageId: {
      type: String
    },
    providerResponse: {
      type: mongoose.Schema.Types.Mixed
    },
    sentAt: {
      type: Date
    },
    failedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

notificationLogSchema.index({ user: 1, createdAt: -1 });
notificationLogSchema.index({ status: 1, createdAt: -1 });
notificationLogSchema.index({ type: 1, createdAt: -1 });

const NotificationLog = mongoose.model('NotificationLog', notificationLogSchema);

export default NotificationLog;
