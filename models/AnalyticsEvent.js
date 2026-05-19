import mongoose from 'mongoose';

const analyticsEventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    anonymousId: {
      type: String,
      trim: true,
      index: true
    },
    source: {
      type: String,
      trim: true,
      index: true
    },
    deviceType: {
      type: String,
      trim: true,
      index: true
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

analyticsEventSchema.index({ name: 1, occurredAt: -1 });
analyticsEventSchema.index({ user: 1, occurredAt: -1 });

export default mongoose.model('AnalyticsEvent', analyticsEventSchema);
