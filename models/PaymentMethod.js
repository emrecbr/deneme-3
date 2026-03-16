import mongoose from 'mongoose';

const paymentMethodSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    provider: {
      type: String,
      default: 'iyzico'
    },
    providerPaymentMethodId: {
      type: String,
      index: true
    },
    brand: {
      type: String,
      trim: true
    },
    last4: {
      type: String,
      trim: true
    },
    expMonth: {
      type: String,
      trim: true
    },
    expYear: {
      type: String,
      trim: true
    },
    holderName: {
      type: String,
      trim: true
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

paymentMethodSchema.index({ user: 1, isDeleted: 1 });

const PaymentMethod = mongoose.model('PaymentMethod', paymentMethodSchema);

export default PaymentMethod;
