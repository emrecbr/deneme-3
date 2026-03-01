import mongoose from 'mongoose';

const neighborhoodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'City',
      required: true
    },
    district: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'District',
      required: true
    }
  },
  {
    timestamps: true
  }
);

neighborhoodSchema.index({ city: 1 });
neighborhoodSchema.index({ district: 1 });
neighborhoodSchema.index({ name: 1, district: 1 }, { unique: true });

const Neighborhood = mongoose.model('Neighborhood', neighborhoodSchema);

export default Neighborhood;
