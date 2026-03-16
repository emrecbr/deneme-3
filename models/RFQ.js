import mongoose from 'mongoose';

const rfqSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    targetPrice: {
      type: Number
    },
    deadline: {
      type: Date,
      required: true
    },
    expiresAt: {
      type: Date
    },
    expiredAt: {
      type: Date
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        required: true
      }
    },
    city: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'City',
      index: true
    },
    district: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'District',
      index: true
    },
    neighborhood: {
      type: String,
      trim: true
    },
    street: {
      type: String,
      trim: true
    },
    locationData: {
      city: {
        type: String,
        trim: true
      },
      district: {
        type: String,
        trim: true
      },
      neighborhood: {
        type: String,
        trim: true
      },
      street: {
        type: String,
        trim: true
      }
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['open', 'closed', 'awarded', 'expired'],
      default: 'open'
    },
    statusUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    statusUpdatedAt: {
      type: Date
    },
    moderationNote: {
      type: String,
      trim: true
    },
    moderationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'flagged'],
      default: 'pending'
    },
    moderationReason: {
      type: String,
      trim: true
    },
    isFlagged: {
      type: Boolean,
      default: false
    },
    followUp: {
      type: Boolean,
      default: false
    },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    moderatedAt: {
      type: Date
    },
    isAuction: {
      type: Boolean,
      default: false
    },
    currentBestOffer: {
      type: Number
    },
    offers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Offer'
      }
    ],
    images: [
      {
        type: String
      }
    ],
    favoriteCount: {
      type: Number,
      default: 0
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    featuredUntil: {
      type: Date
    },
    featuredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    car: {
      brandId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CarBrand'
      },
      modelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CarModel'
      },
      variantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CarVariant'
      },
      year: {
        type: Number
      },
      brandName: {
        type: String,
        trim: true
      },
      modelName: {
        type: String,
        trim: true
      },
      variantName: {
        type: String,
        trim: true
      }
    },
    productDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    vehicleDetails: {
      brand: { type: String, trim: true },
      year: { type: Number },
      partCode: { type: String, trim: true },
      engine: { type: String, trim: true },
      oemNo: { type: String, trim: true }
    }
  },
  {
    timestamps: true
  }
);

rfqSchema.index({ location: '2dsphere' });

const RFQ = mongoose.model('RFQ', rfqSchema);

export default RFQ;
