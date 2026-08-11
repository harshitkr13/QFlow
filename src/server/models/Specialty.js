import mongoose from 'mongoose';

const specialtySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Specialty name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Specialty code is required'],
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    iconName: {
      type: String,
      trim: true,
      default: null,
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
specialtySchema.index({ code: 1 }, { unique: true });

export const Specialty = mongoose.model('Specialty', specialtySchema);
export default Specialty;
