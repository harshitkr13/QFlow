import mongoose from 'mongoose';

const ratingSchema = new mongoose.Schema(
  {
    queueEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QueueEntry',
      required: [true, 'QueueEntry ID is required'],
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
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
    rating: {
      type: Number,
      required: [true, 'Rating score (1 to 5) is required'],
      min: [1, 'Rating must be at least 1 star'],
      max: [5, 'Rating cannot exceed 5 stars'],
    },
    reviewText: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Unique index enforcing strict 1 rating per completed consultation
ratingSchema.index({ queueEntryId: 1 }, { unique: true });
ratingSchema.index({ doctorId: 1, createdAt: -1 });

export const Rating = mongoose.model('Rating', ratingSchema);
export default Rating;
