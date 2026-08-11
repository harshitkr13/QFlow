import mongoose from 'mongoose';

const pointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: [true, 'Geospatial coordinates [longitude, latitude] are required'],
    },
  },
  { _id: false }
);

const clinicSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Clinic name is required'],
      trim: true,
    },
    address: {
      street: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true },
    },
    location: {
      type: pointSchema,
      required: [true, 'Clinic GeoJSON location is required'],
    },
    phone: {
      type: String,
      required: [true, 'Contact phone number is required'],
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Clinic admin User ID is required'],
    },
    queuePolicy: {
      type: String,
      enum: ['HYBRID', 'FIFO', 'APPOINTMENT_PRIORITY'],
      default: 'HYBRID',
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
clinicSchema.index({ location: '2dsphere' });
clinicSchema.index({ adminId: 1 });

export const Clinic = mongoose.model('Clinic', clinicSchema);
export default Clinic;
