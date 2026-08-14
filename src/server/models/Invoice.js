import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
    queueEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QueueEntry',
      required: true,
    },
    consultationFee: {
      type: Number,
      required: true,
      min: 0,
    },
    clinicFacilityFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPayableAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'ISSUED', 'PAID', 'CANCELLED', 'REFUNDED'],
      default: 'ISSUED',
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

invoiceSchema.index({ queueEntryId: 1 }, { unique: true });
invoiceSchema.index({ patientId: 1, createdAt: -1 });
invoiceSchema.index({ clinicId: 1, createdAt: -1 });

export const Invoice = mongoose.model('Invoice', invoiceSchema);
export default Invoice;
