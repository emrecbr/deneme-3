import mongoose from 'mongoose';

const monetizationPlanSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    title: {
      type: String,
      required: true
    },
    shortDescription: {
      type: String,
      required: true
    },
    longDescription: {
      type: String
    },
    isActive: {
      type: Boolean,
      default: true
    },
    showInApp: {
      type: Boolean,
      default: true
    },
    billingModes: {
      type: [String],
      default: ['monthly', 'yearly']
    },
    monthlyPrice: {
      type: Number,
      default: 0
    },
    yearlyPrice: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'TRY'
    },
    sortOrder: {
      type: Number,
      default: 0
    },
    badgeLabel: {
      type: String
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

const MonetizationPlan = mongoose.model('MonetizationPlan', monetizationPlanSchema);

export default MonetizationPlan;
