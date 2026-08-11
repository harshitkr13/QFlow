import mongoose from 'mongoose';

const shiftIntervalSchema = new mongoose.Schema(
  {
    startTime: { type: String, required: true }, // e.g. "09:00"
    endTime: { type: String, required: true },   // e.g. "13:00"
  },
  { _id: false }
);

const breakIntervalSchema = new mongoose.Schema(
  {
    startTime: { type: String, required: true }, // e.g. "13:00"
    endTime: { type: String, required: true },   // e.g. "14:00"
    label: { type: String, default: 'Break' },
  },
  { _id: false }
);

const dayScheduleSchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: String,
      required: true,
      enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
    },
    isWorkingDay: {
      type: Boolean,
      default: true,
    },
    shifts: [shiftIntervalSchema],
    breaks: [breakIntervalSchema],
  },
  { _id: false }
);

const doctorScheduleSchema = new mongoose.Schema(
  {
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
    weeklyHours: {
      type: [dayScheduleSchema],
      required: [true, 'Weekly schedule hours are required'],
    },
    effectiveFrom: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
doctorScheduleSchema.index({ doctorId: 1, clinicId: 1, isActive: 1 });

export const DoctorSchedule = mongoose.model('DoctorSchedule', doctorScheduleSchema);
export default DoctorSchedule;
