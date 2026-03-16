import mongoose from 'mongoose';

const moderationAttemptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    contentType: {
      type: String,
      enum: ['rfq', 'offer', 'message', 'profile', 'other'],
      default: 'rfq'
    },
    sourceRoute: {
      type: String,
      trim: true
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId
    },
    attemptedTitle: {
      type: String,
      trim: true
    },
    attemptedDescription: {
      type: String,
      trim: true
    },
    normalizedText: {
      type: String
    },
    matchedRules: {
      type: Array,
      default: []
    },
    matchedTerms: {
      type: [String],
      default: []
    },
    matchedSignals: {
      type: Array,
      default: []
    },
    riskScore: {
      type: Number,
      default: 0
    },
    decision: {
      type: String,
      enum: ['allow', 'warn', 'review', 'block'],
      default: 'allow'
    },
    similarityKey: {
      type: String
    },
    repeatedAttemptCount: {
      type: Number,
      default: 0
    },
    actionTaken: {
      type: String,
      enum: ['blocked', 'warn', 'allow', 'review'],
      default: 'blocked'
    },
    status: {
      type: String,
      enum: ['blocked', 'under_review', 'approved_override', 'rejected'],
      default: 'blocked'
    },
    adminNotes: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

moderationAttemptSchema.index({ createdAt: -1 });
moderationAttemptSchema.index({ contentType: 1, status: 1 });
moderationAttemptSchema.index({ user: 1, similarityKey: 1, createdAt: -1 });

const ModerationAttempt = mongoose.model('ModerationAttempt', moderationAttemptSchema);

export default ModerationAttempt;
