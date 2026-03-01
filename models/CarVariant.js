import mongoose from 'mongoose';

const carVariantSchema = new mongoose.Schema(
  {
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'CarBrand', index: true, required: true },
    modelId: { type: mongoose.Schema.Types.ObjectId, ref: 'CarModel', index: true, required: true },
    year: { type: Number, index: true },
    vehicleCode: { type: String, index: true },
    variantName: { type: String, trim: true },
    kaskoValue: { type: Number },
    raw: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

carVariantSchema.index({ vehicleCode: 1 }, { unique: true, sparse: true });
carVariantSchema.index({ brandId: 1, modelId: 1, year: 1 });

const CarVariant = mongoose.model('CarVariant', carVariantSchema);

export default CarVariant;
