import mongoose from 'mongoose';

const apiRateLimitCounterSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      index: true
    },
    windowBucket: {
      type: Number,
      required: true,
      index: true
    },
    count: {
      type: Number,
      default: 0
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }
    }
  },
  { timestamps: true }
);

const ApiRateLimitCounter = mongoose.model('ApiRateLimitCounter', apiRateLimitCounterSchema);

export default ApiRateLimitCounter;
