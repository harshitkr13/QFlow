import mongoose from 'mongoose';

const doctorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      required: [true, 'Clinic ID is required'],
    },
    specialtyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Specialty',
      required: [true, 'Specialty ID is required'],
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    gender: {
      type: String,
      required: [true, 'Gender is required'],
      enum: ['MALE', 'FEMALE', 'OTHER'],
    },
    qualifications: {
      type: [String],
      required: [true, 'Qualifications are required'],
    },
    experienceYears: {
      type: Number,
      required: [true, 'Experience years is required'],
      min: 0,
      default: 0,
    },
    consultationFee: {
      type: Number,
      required: [true, 'Consultation fee is required'],
      min: 0,
      default: 0,
    },
    averageConsultationDurationMinutes: {
      type: Number,
      default: 15,
      min: 1,
    },
    operationalStatus: {
      type: String,
      enum: ['AVAILABLE', 'BUSY', 'ON_BREAK', 'UNAVAILABLE', 'OFFLINE'],
      default: 'AVAILABLE',
    },
    statusExpectedResumeTime: {
      type: Date,
      default: null,
    },
    averageRating: {
      type: Number,
      default: 0.0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
    photoUrl: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
doctorSchema.index({ clinicId: 1, specialtyId: 1 });
doctorSchema.index({ userId: 1 });
doctorSchema.index({ averageRating: -1, experienceYears: -1 });

export const Doctor = mongoose.model('Doctor', doctorSchema);
export default Doctor;
