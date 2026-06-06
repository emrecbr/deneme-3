import mongoose from 'mongoose';

const chatRestrictionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 1000,
      required: true
    },
    scope: {
      type: String,
      enum: ['chat', 'platform'],
      default: 'chat',
      index: true
    },
    expiresAt: {
      type: Date,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    liftedAt: {
      type: Date,
      index: true
    },
    liftedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

chatRestrictionSchema.index({ userId: 1, liftedAt: 1, expiresAt: 1 });

const ChatRestriction = mongoose.model('ChatRestriction', chatRestrictionSchema);

export default ChatRestriction;
