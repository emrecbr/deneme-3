import mongoose from 'mongoose';

const webhookEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true
    },
    eventId: {
      type: String,
      required: true
    },
    processedAt: {
      type: Date,
      default: Date.now
    },
    payload: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  { timestamps: true }
);

webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);

export default WebhookEvent;
