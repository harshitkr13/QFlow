import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'CARD', 'UPI', 'ONLINE_MOCK'],
      default: 'ONLINE_MOCK',
    },
    status: {
      type: String,
      enum: ['PENDING', 'INITIATED', 'SUCCESS', 'FAILED', 'REFUNDED'],
      default: 'INITIATED',
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
    },
    provider: {
      type: String,
      default: 'MOCK',
    },
    providerTransactionId: {
      type: String,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    refundedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

paymentSchema.index({ idempotencyKey: 1 }, { unique: true });
paymentSchema.index({ invoiceId: 1, createdAt: -1 });
paymentSchema.index({ patientId: 1, createdAt: -1 });
paymentSchema.index(
  { invoiceId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'SUCCESS' },
    name: 'unique_successful_payment_per_invoice',
  }
);

export const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
