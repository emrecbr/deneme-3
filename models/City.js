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
    }
  },
  {
    timestamps: true
  }
);

citySchema.index({ name: 'text' });

const City = mongoose.model('City', citySchema);

export default City;
