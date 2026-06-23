import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['text', 'image'],
      default: 'text',
      index: true
    },
    content: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000
    },
    mediaUrl: {
      type: String,
      trim: true,
      default: ''
    },
    mediaProvider: {
      type: String,
      trim: true,
      default: ''
    },
    mediaPublicId: {
      type: String,
      trim: true,
      default: ''
    },
    mediaMimeType: {
      type: String,
      trim: true,
      default: ''
    },
    mediaSize: {
      type: Number,
      default: 0
    },
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
      index: true
    },
    riskReasons: [
      {
        type: String,
        trim: true
      }
    ],
    moderationStatus: {
      type: String,
      enum: ['clean', 'flagged', 'reviewed', 'dismissed'],
      default: 'clean',
      index: true
    },
    read: {
      type: Boolean,
      default: false
    },
    readAt: {
      type: Date
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ]
  },
  {
    timestamps: true
  }
);

const Message = mongoose.model('Message', messageSchema);

export default Message;
