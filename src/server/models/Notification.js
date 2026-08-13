import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient ID is required'],
    },
    queueEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QueueEntry',
      default: null,
    },
    type: {
      type: String,
      enum: ['PATIENT_CALLED', 'CONSULTATION_STARTED', 'CONSULTATION_COMPLETED', 'PATIENT_SKIPPED', 'QUEUE_PAUSED', 'QUEUE_RESUMED'],
      required: [true, 'Notification type is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
notificationSchema.index({ patientId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index(
  { patientId: 1, queueEntryId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { queueEntryId: { $type: 'objectId' } },
    name: 'unique_patient_entry_event_notification_idx',
  }
);

export const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
