import mongoose from 'mongoose';

const adminDashboardSnapshotSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    computedAt: {
      type: Date,
      default: null
    },
    source: {
      type: String,
      default: 'unknown'
    }
  },
  {
    timestamps: true,
    minimize: false
  }
);

export default mongoose.models.AdminDashboardSnapshot ||
  mongoose.model('AdminDashboardSnapshot', adminDashboardSnapshotSchema);
