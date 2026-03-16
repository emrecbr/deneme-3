import mongoose from 'mongoose';

const moderationRuleSchema = new mongoose.Schema(
  {
    term: {
      type: String,
      required: true,
      trim: true
    },
    normalizedTerm: {
      type: String,
      required: true,
      index: true
    },
    category: {
      type: String,
      default: 'other',
      trim: true
    },
    severity: {
      type: String,
      enum: ['warn', 'block'],
      default: 'block'
    },
    matchType: {
      type: String,
      enum: ['contains', 'exact', 'phrase', 'regex'],
      default: 'contains'
    },
    riskScoreWeight: {
      type: Number,
      default: 0
    },
    isSeeded: {
      type: Boolean,
      default: false,
      index: true
    },
    source: {
      type: String,
      default: 'manual',
      trim: true,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    notes: {
      type: String,
      trim: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

moderationRuleSchema.index({ category: 1, isActive: 1 });

const ModerationRule = mongoose.model('ModerationRule', moderationRuleSchema);

export default ModerationRule;
