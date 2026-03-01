import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    ],
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    rfq: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RFQ',
      required: true
    },
    lastMessage: {
      type: String,
      trim: true,
      default: ''
    },
    lastMessageAt: {
      type: Date,
      default: Date.now
    },
    offer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer'
    },
    status: {
      type: String,
      enum: ['pending', 'active'],
      default: 'pending'
    },
    initiatedBy: {
      type: String,
      enum: ['buyer', 'seller'],
      default: 'buyer'
    },
    firstMessageAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

chatSchema.index({ participants: 1 });
chatSchema.index({ updatedAt: -1 });
chatSchema.index(
  { rfq: 1, buyer: 1, supplier: 1 },
  {
    unique: true,
    partialFilterExpression: {
      rfq: { $exists: true },
      buyer: { $exists: true },
      supplier: { $exists: true }
    }
  }
);

const Chat = mongoose.model('Chat', chatSchema);

export default Chat;
