import mongoose from 'mongoose';

const carBrandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, index: true },
    slug: { type: String, required: true, trim: true, unique: true, index: true }
  },
  { timestamps: true }
);

const CarBrand = mongoose.model('CarBrand', carBrandSchema);

export default CarBrand;
