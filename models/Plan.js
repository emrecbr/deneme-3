import mongoose from 'mongoose';

const planSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'TRY'
    },
    interval: {
      type: String,
      enum: ['month', 'year', null],
      default: null
    },
    isRecurring: {
      type: Boolean,
      default: false
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

const Plan = mongoose.model('Plan', planSchema);

export default Plan;
