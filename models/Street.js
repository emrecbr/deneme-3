import mongoose from 'mongoose';

const streetSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['Cadde', 'Sokak'],
      required: true
    },
    neighborhood: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Neighborhood',
      required: true
    }
  },
  {
    timestamps: true
  }
);

streetSchema.index({ neighborhood: 1 });
streetSchema.index({ name: 1, neighborhood: 1, type: 1 }, { unique: true });

const Street = mongoose.model('Street', streetSchema);

export default Street;
