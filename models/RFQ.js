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
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
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
      enum: ['open', 'closed', 'awarded'],
      default: 'open'
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
    }
  },
  {
    timestamps: true
  }
);

rfqSchema.index({ location: '2dsphere' });

const RFQ = mongoose.model('RFQ', rfqSchema);

export default RFQ;
