import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    city: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    district: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    neighborhood: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    street: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    postalCode: {
      type: String,
      trim: true
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        default: undefined
      }
    }
  },
  {
    timestamps: true
  }
);

locationSchema.index({ city: 1, district: 1, neighborhood: 1 });
locationSchema.index({ coordinates: '2dsphere' });

const Location = mongoose.model('Location', locationSchema);

export default Location;
