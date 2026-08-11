import mongoose from 'mongoose';

const staffSchema = new mongoose.Schema(
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
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
staffSchema.index({ userId: 1 }, { unique: true });
staffSchema.index({ clinicId: 1 });

export const Staff = mongoose.model('Staff', staffSchema);
export default Staff;
