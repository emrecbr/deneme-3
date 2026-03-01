import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
  {
    channel: {
      type: String,
      enum: ['sms', 'email'],
      required: true
    },
    target: {
      type: String,
      required: true
    },
    codeHash: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    usedAt: {
      type: Date,
      default: null
    },
    attempts: {
      type: Number,
      default: 0
    },
    lastSentAt: {
      type: Date,
      required: true
    }
  },
  { timestamps: true }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ channel: 1, target: 1 });

const Otp = mongoose.model('Otp', otpSchema);

export default Otp;
