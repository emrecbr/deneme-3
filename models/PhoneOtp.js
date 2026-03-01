import mongoose from 'mongoose';

const phoneOtpSchema = new mongoose.Schema(
  {
    phoneE164: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    codeHash: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    attempts: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

phoneOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PhoneOtp = mongoose.model('PhoneOtp', phoneOtpSchema);

export default PhoneOtp;
