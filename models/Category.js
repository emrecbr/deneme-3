import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true
    },
    segment: {
      type: String,
      enum: ['goods', 'service', 'auto', 'jobseeker'],
      required: false,
      index: true
    },
    kind: {
      type: String,
      enum: ['root', 'branch', 'leaf'],
      required: false,
      index: true
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null
    },
    level: {
      type: Number,
      default: 0
    },
    icon: {
      type: String,
      trim: true,
      default: ''
    },
    order: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

categorySchema.index({ parent: 1, order: 1, name: 1 });
categorySchema.index({ level: 1, order: 1 });
categorySchema.index({ segment: 1, parent: 1, order: 1 });
categorySchema.index({ segment: 1, kind: 1, parent: 1 });

const Category = mongoose.model('Category', categorySchema);

export default Category;
