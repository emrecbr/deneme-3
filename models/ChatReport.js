import mongoose from 'mongoose';

const chatReportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    reportedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      index: true
    },
    rfqId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RFQ',
      index: true
    },
    reason: {
      type: String,
      enum: ['spam', 'harassment', 'inappropriate', 'scam', 'other'],
      required: true
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    status: {
      type: String,
      enum: ['open', 'reviewed', 'dismissed', 'action_taken'],
      default: 'open',
      index: true
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

chatReportSchema.index({ reporterId: 1, chatId: 1, messageId: 1, createdAt: -1 });
chatReportSchema.index({ status: 1, createdAt: -1 });

const ChatReport = mongoose.model('ChatReport', chatReportSchema);

export default ChatReport;
