import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
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
    specialtyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Specialty',
      required: [true, 'Specialty ID is required'],
    },
    appointmentDate: {
      type: String, // 'YYYY-MM-DD'
      required: [true, 'Appointment date (YYYY-MM-DD) is required'],
    },
    timeSlot: {
      startTime: { type: String, required: true }, // e.g. "10:30"
      endTime: { type: String, required: true },   // e.g. "10:45"
    },
    status: {
      type: String,
      enum: ['BOOKED', 'CHECKED_IN', 'CANCELLED', 'COMPLETED', 'NO_SHOW'],
      default: 'BOOKED',
    },
    cancellationReason: {
      type: String,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    checkedInAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
appointmentSchema.index(
  { doctorId: 1, appointmentDate: 1, 'timeSlot.startTime': 1, status: 1 },
  { name: 'doctor_date_slot_status_idx' }
);
appointmentSchema.index({ patientId: 1, appointmentDate: -1 });

export const Appointment = mongoose.model('Appointment', appointmentSchema);
export default Appointment;
