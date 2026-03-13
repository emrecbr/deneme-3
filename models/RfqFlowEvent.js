import mongoose from 'mongoose';

const rfqFlowEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    step: {
      type: Number,
      required: true
    },
    event: {
      type: String,
      enum: ['step_view', 'step_complete', 'step_blocked'],
      required: true
    },
    field: {
      type: String,
      trim: true
    },
    error: {
      type: String,
      trim: true
    },
    meta: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  { timestamps: true }
);

rfqFlowEventSchema.index({ step: 1, event: 1, createdAt: -1 });
rfqFlowEventSchema.index({ createdAt: -1 });

const RfqFlowEvent = mongoose.model('RfqFlowEvent', rfqFlowEventSchema);

export default RfqFlowEvent;
