import mongoose from 'mongoose';

const authLogSchema = new mongoose.Schema(
  {
    channel: {
      type: String,
      enum: ['sms', 'email'],
      required: true
    },
    event: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['success', 'failed'],
      required: true
    },
    target: {
      type: String,
      trim: true
    },
    maskedTarget: {
      type: String,
      trim: true
    },
    errorMessage: {
      type: String,
      trim: true
    },
    provider: {
      type: String,
      trim: true
    },
    meta: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  { timestamps: true }
);

authLogSchema.index({ channel: 1, event: 1, status: 1, createdAt: -1 });
authLogSchema.index({ target: 1 });

const AuthLog = mongoose.model('AuthLog', authLogSchema);

export default AuthLog;
