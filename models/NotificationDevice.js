import mongoose from 'mongoose';

const notificationDeviceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    onesignalExternalId: {
      type: String,
      required: true,
      trim: true
    },
    lastKnownSubscriptionId: {
      type: String
    },
    platform: {
      type: String
    },
    appVersion: {
      type: String
    },
    lastSeenAt: {
      type: Date
    }
  },
  { timestamps: true }
);

const NotificationDevice = mongoose.model('NotificationDevice', notificationDeviceSchema);

export default NotificationDevice;
