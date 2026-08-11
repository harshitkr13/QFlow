import mongoose from 'mongoose';

const queueCounterSchema = new mongoose.Schema(
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
    date: {
      type: String, // 'YYYY-MM-DD'
      required: [true, 'Date string (YYYY-MM-DD) is required'],
    },
    lastTokenNumber: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring 1 counter per clinic + doctor + date
queueCounterSchema.index(
  { clinicId: 1, doctorId: 1, date: 1 },
  { unique: true, name: 'unique_clinic_doctor_date_counter' }
);

export const QueueCounter = mongoose.model('QueueCounter', queueCounterSchema);
export default QueueCounter;
