import mongoose from 'mongoose';

const financialAuditLogSchema = new mongoose.Schema(
  {
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
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
    action: {
      type: String,
      enum: [
        'INVOICE_CREATED',
        'INVOICE_ISSUED',
        'PAYMENT_INITIATED',
        'PAYMENT_SUCCESS',
        'PAYMENT_FAILED',
        'REFUND_INITIATED',
        'REFUND_COMPLETED',
        'INVOICE_CANCELLED',
      ],
      required: true,
    },
    previousStatus: {
      type: String,
      default: null,
    },
    newStatus: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actorRole: {
      type: String,
      required: true,
    },
    provider: {
      type: String,
      default: 'INTERNAL',
    },
    transactionReference: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  { timestamps: false }
);

financialAuditLogSchema.index({ invoiceId: 1, timestamp: -1 });
financialAuditLogSchema.index({ patientId: 1, timestamp: -1 });

export const FinancialAuditLog = mongoose.model('FinancialAuditLog', financialAuditLogSchema);
export default FinancialAuditLog;
