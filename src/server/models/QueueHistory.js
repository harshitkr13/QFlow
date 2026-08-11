import mongoose from 'mongoose';

const queueHistorySchema = new mongoose.Schema(
  {
    queueEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QueueEntry',
      default: null,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Doctor ID is required'],
    },
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      required: [true, 'Clinic ID is required'],
    },
    action: {
      type: String,
      required: [true, 'Action name is required'],
      enum: [
        'CHECK_IN',
        'CALL_NEXT',
        'START_CONSULTATION',
        'COMPLETE',
        'SKIP',
        'NO_SHOW',
        'CANCEL',
        'REJOIN',
        'PAUSE_QUEUE',
        'RESUME_QUEUE',
        'STATUS_CHANGE',
      ],
    },
    previousState: {
      type: String,
      default: null,
    },
    newState: {
      type: String,
      required: [true, 'New state value is required'],
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID of actor is required'],
    },
    userRole: {
      type: String,
      required: [true, 'Role of actor is required'],
      enum: ['PATIENT', 'DOCTOR', 'STAFF', 'ADMIN'],
    },
    reason: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false, // Append-only audit record, uses explicit timestamp field
  }
);

// Indexes
queueHistorySchema.index({ doctorId: 1, timestamp: -1 });
queueHistorySchema.index({ queueEntryId: 1, timestamp: 1 });

export const QueueHistory = mongoose.model('QueueHistory', queueHistorySchema);
export default QueueHistory;
