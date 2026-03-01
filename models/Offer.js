import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema(
  {
    rfq: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RFQ',
      required: true
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    message: {
      type: String,
      trim: true
    },
    quantity: {
      type: Number
    },
    deliveryTime: {
      type: Number,
      required: true,
      min: 1
    },
    status: {
      type: String,
      enum: ['sent', 'viewed', 'countered', 'accepted', 'rejected', 'withdrawn', 'completed'],
      default: 'sent'
    },
    viewedAt: {
      type: Date
    },
    counterOffer: {
      price: {
        type: Number
      },
      note: {
        type: String,
        trim: true
      }
    },
    timeline: [
      {
        status: {
          type: String,
          enum: ['sent', 'viewed', 'countered', 'accepted', 'rejected', 'withdrawn', 'completed']
        },
        date: {
          type: Date
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

offerSchema.index(
  { rfq: 1, supplier: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['sent', 'viewed', 'countered', 'accepted'] }
    }
  }
);

const Offer = mongoose.model('Offer', offerSchema);

export default Offer;
