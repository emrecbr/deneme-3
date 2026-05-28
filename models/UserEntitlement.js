import mongoose from 'mongoose';

const userEntitlementSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    entitlementType: {
      type: String,
      enum: ['premium', 'featured_listing'],
      required: true,
      index: true
    },
    source: {
      type: String,
      enum: ['purchase', 'admin_grant', 'campaign'],
      required: true,
      index: true
    },
    quantity: {
      type: Number,
      default: 1,
      min: 0
    },
    usedQuantity: {
      type: Number,
      default: 0,
      min: 0
    },
    startAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      index: true
    },
    grantedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    note: {
      type: String,
      trim: true
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment'
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  { timestamps: true }
);

userEntitlementSchema.index({ userId: 1, entitlementType: 1, source: 1, createdAt: -1 });

const UserEntitlement = mongoose.model('UserEntitlement', userEntitlementSchema);

export default UserEntitlement;
