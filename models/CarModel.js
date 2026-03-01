import mongoose from 'mongoose';

const carModelSchema = new mongoose.Schema(
  {
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'CarBrand', index: true, required: true },
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, required: true, trim: true, index: true }
  },
  { timestamps: true }
);

carModelSchema.index({ brandId: 1, slug: 1 }, { unique: true });

const CarModel = mongoose.model('CarModel', carModelSchema);

export default CarModel;
