import mongoose from 'mongoose';

const dailySettlementSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      required: [true, 'Clinic ID is required'],
    },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: [true, 'Settlement date (YYYY-MM-DD) is required'],
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID of operator closing the day is required'],
    },
    closedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['CLOSED', 'REOPENED'],
      default: 'CLOSED',
    },
    metrics: {
      totalTokensIssued: {
        type: Number,
        default: 0,
        min: 0,
      },
      completedVisits: {
        type: Number,
        default: 0,
        min: 0,
      },
      noShowVisits: {
        type: Number,
        default: 0,
        min: 0,
      },
      cancelledVisits: {
        type: Number,
        default: 0,
        min: 0,
      },
      expiredVisits: {
        type: Number,
        default: 0,
        min: 0,
      },
      walkInCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      appointmentCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalRevenueCollected: {
        type: Number,
        default: 0,
        min: 0,
      },
      outstandingRevenue: {
        type: Number,
        default: 0,
        min: 0,
      },
      avgWaitMinutes: {
        type: Number,
        default: 0,
        min: 0,
      },
      avgConsultationMinutes: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    notes: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring exactly one authoritative settlement per clinic per date
dailySettlementSchema.index(
  { clinicId: 1, date: 1 },
  { unique: true, name: 'unique_clinic_date_settlement' }
);
dailySettlementSchema.index({ clinicId: 1, createdAt: -1 });

export const DailySettlement = mongoose.model('DailySettlement', dailySettlementSchema);
export default DailySettlement;
