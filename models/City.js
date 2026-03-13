import mongoose from 'mongoose';

const citySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    slug: {
      type: String,
      trim: true
    },
    areaKm2: {
      type: Number
    },
    radiusKm: {
      type: Number
    },
    center: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        default: undefined
      }
    },
    isActive: {
      type: Boolean,
      default: true
    },
    boundaryUpdatedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

citySchema.index({ name: 'text' });
citySchema.index({ center: '2dsphere' });

const City = mongoose.model('City', citySchema);

export default City;
