import mongoose from 'mongoose';

const queueEntrySchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      required: [true, 'Clinic ID is required'],
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Doctor ID is required'],
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient ID is required'],
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null, // Optional for walk-in patients
    },
    queueDate: {
      type: String, // 'YYYY-MM-DD'
      required: [true, 'Queue date (YYYY-MM-DD) is required'],
    },
    tokenNumber: {
      type: Number,
      required: [true, 'Token number is required'],
    },
    source: {
      type: String,
      enum: ['ONLINE', 'WALK_IN', 'STAFF_CREATED'],
      required: [true, 'Queue entry source is required'],
    },
    priority: {
      type: String,
      enum: ['NORMAL', 'URGENT'],
      default: 'NORMAL',
    },
    status: {
      type: String,
      enum: ['WAITING', 'CALLED', 'IN_CONSULTATION', 'COMPLETED', 'SKIPPED', 'NO_SHOW', 'CANCELLED'],
      default: 'WAITING',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    calledAt: {
      type: Date,
      default: null,
    },
    consultationStartedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
queueEntrySchema.index(
  { doctorId: 1, queueDate: 1, tokenNumber: 1 },
  { unique: true, name: 'unique_doctor_date_token' }
);
queueEntrySchema.index(
  { doctorId: 1, patientId: 1, queueDate: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['WAITING', 'CALLED', 'IN_CONSULTATION'] },
    },
    name: 'unique_active_patient_queue_idx',
  }
);
queueEntrySchema.index(
  { appointmentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      appointmentId: { $type: 'objectId' },
    },
    name: 'unique_appointment_queue_entry_idx',
  }
);
queueEntrySchema.index({ doctorId: 1, queueDate: 1, status: 1, joinedAt: 1 });
queueEntrySchema.index({ patientId: 1, queueDate: -1 });

export const QueueEntry = mongoose.model('QueueEntry', queueEntrySchema);
export default QueueEntry;
