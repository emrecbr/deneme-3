import mongoose from 'mongoose';

const notificationPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    pushEnabled: {
      type: Boolean,
      default: true
    },
    offerNotifications: {
      type: Boolean,
      default: true
    },
    messageNotifications: {
      type: Boolean,
      default: true
    },
    systemNotifications: {
      type: Boolean,
      default: true
    },
    marketingNotifications: {
      type: Boolean,
      default: false
    },
    paymentNotifications: {
      type: Boolean,
      default: true
    },
    listingNotifications: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

const NotificationPreference = mongoose.model('NotificationPreference', notificationPreferenceSchema);

export default NotificationPreference;
