import mongoose from 'mongoose';

const securityEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    role: {
      type: String,
      trim: true
    },
    ip: {
      type: String,
      trim: true
    },
    userAgent: {
      type: String,
      trim: true
    },
    path: {
      type: String,
      trim: true
    },
    method: {
      type: String,
      trim: true
    },
    meta: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  { timestamps: true }
);

securityEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

const SecurityEvent = mongoose.model('SecurityEvent', securityEventSchema);

export default SecurityEvent;
