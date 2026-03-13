import mongoose from 'mongoose';

const adminNoteSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ['user', 'rfq'],
      required: true,
      index: true
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    note: {
      type: String,
      required: true,
      trim: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

adminNoteSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

const AdminNote = mongoose.model('AdminNote', adminNoteSchema);

export default AdminNote;
