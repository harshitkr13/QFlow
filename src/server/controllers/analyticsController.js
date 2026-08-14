import mongoose from 'mongoose';
import QueueEntry from '../models/QueueEntry.js';
import Appointment from '../models/Appointment.js';
import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import Doctor from '../models/Doctor.js';

/**
 * Helper to compute IST start and end UTC Date objects for an operational date
 */
export const getISTDateRange = (dateStr) => {
  let dateObj;
  if (dateStr) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      dateObj = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
    } else {
      dateObj = new Date();
    }
  } else {
    dateObj = new Date();
  }

  // Calculate IST midnight start/end (IST is UTC+5:30)
  // IST 00:00:00.000 = previous UTC day 18:30:00.000
  // IST 23:59:59.999 = current UTC day 18:29:59.999
  const istFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = istFormatter.formatToParts(dateObj);
  const year = parts.find((p) => p.type === 'year').value;
  const month = parts.find((p) => p.type === 'month').value;
  const day = parts.find((p) => p.type === 'day').value;

  const queueDateStr = `${year}-${month}-${day}`;

  const startUtc = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0) - 5.5 * 60 * 60 * 1000);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1);

  return { queueDateStr, startUtc, endUtc };
};

/**
 * GET /api/staff/analytics/daily?clinicId=...&date=YYYY-MM-DD
 * Clinic operational analytics (STAFF / ADMIN)
 */
export const getStaffDailyAnalytics = async (req, res) => {
  try {
    let { clinicId, date } = req.query;

    if (req.user.role === 'STAFF') {
      clinicId = req.user.staffClinicId ? req.user.staffClinicId.toString() : clinicId;
    }

    if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: 'Valid clinicId is required' });
    }

    const { queueDateStr, startUtc, endUtc } = getISTDateRange(date);

    // Queue status counts & source breakdown
    const queueStats = await QueueEntry.aggregate([
      {
        $match: {
          clinicId: new mongoose.Types.ObjectId(clinicId),
          queueDate: queueDateStr,
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          walkInCount: { $sum: { $cond: [{ $eq: ['$source', 'WALK_IN'] }, 1, 0] } },
          onlineCount: { $sum: { $cond: [{ $eq: ['$source', 'ONLINE'] }, 1, 0] } },
        },
      },
    ]);

    // Financial revenue summary for today
    const revenueStats = await Invoice.aggregate([
      {
        $match: {
          clinicId: new mongoose.Types.ObjectId(clinicId),
          createdAt: { $gte: startUtc, $lte: endUtc },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: { $cond: [{ $eq: ['$status', 'PAID'] }, '$totalPayableAmount', 0] } },
        },
      },
    ]);

    // Payment gateway success rate today
    const paymentStats = await Payment.aggregate([
      {
        $match: {
          clinicId: new mongoose.Types.ObjectId(clinicId),
          createdAt: { $gte: startUtc, $lte: endUtc },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    let totalPayments = 0;
    let successfulPayments = 0;
    paymentStats.forEach((p) => {
      totalPayments += p.count;
      if (p._id === 'SUCCESS') successfulPayments += p.count;
    });
    const paymentSuccessRate = totalPayments > 0 ? Math.round((successfulPayments / totalPayments) * 100) : 100;

    let totalCompleted = 0;
    let totalWalkIn = 0;
    let totalOnline = 0;
    queueStats.forEach((stat) => {
      if (stat._id === 'COMPLETED') totalCompleted = stat.count;
      totalWalkIn += stat.walkInCount;
      totalOnline += stat.onlineCount;
    });

    let dailyRevenue = 0;
    revenueStats.forEach((r) => {
      if (r._id === 'PAID') dailyRevenue += r.totalRevenue;
    });

    return res.json({
      success: true,
      clinicId,
      queueDate: queueDateStr,
      metrics: {
        totalQueueEntries: totalWalkIn + totalOnline,
        completedConsultations: totalCompleted,
        walkInCount: totalWalkIn,
        onlineCount: totalOnline,
        dailyRevenue,
        paymentSuccessRate,
      },
      queueBreakdown: queueStats,
      revenueBreakdown: revenueStats,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/doctors/me/analytics
 * Doctor personal performance analytics (DOCTOR only)
 */
export const getDoctorAnalytics = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const doctor = await Doctor.findOne({ userId });
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }

    const { queueDateStr } = getISTDateRange();

    const todayQueueStats = await QueueEntry.aggregate([
      {
        $match: {
          doctorId: doctor._id,
          queueDate: queueDateStr,
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const totalConsultationsAllTime = await QueueEntry.countDocuments({
      doctorId: doctor._id,
      status: 'COMPLETED',
    });

    return res.json({
      success: true,
      doctor: {
        id: doctor._id,
        fullName: doctor.fullName,
        averageRating: doctor.averageRating || 0,
        totalReviews: doctor.totalReviews || 0,
      },
      todayMetrics: {
        queueDate: queueDateStr,
        stats: todayQueueStats,
      },
      allTimeConsultations: totalConsultationsAllTime,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/admin/analytics/summary
 * Global platform analytics summary (ADMIN only)
 */
export const getAdminAnalyticsSummary = async (req, res) => {
  try {
    const { queueDateStr, startUtc, endUtc } = getISTDateRange();

    const queueAggregate = await QueueEntry.aggregate([
      {
        $match: {
          queueDate: queueDateStr,
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const revenueAggregate = await Invoice.aggregate([
      {
        $match: {
          status: 'PAID',
        },
      },
      {
        $group: {
          _id: null,
          totalPlatformRevenue: { $sum: '$totalPayableAmount' },
          totalInvoicesPaid: { $sum: 1 },
        },
      },
    ]);

    const totalPlatformRevenue = revenueAggregate[0] ? revenueAggregate[0].totalPlatformRevenue : 0;
    const totalInvoicesPaid = revenueAggregate[0] ? revenueAggregate[0].totalInvoicesPaid : 0;

    return res.json({
      success: true,
      platformDate: queueDateStr,
      todayQueueAggregate: queueAggregate,
      financialSummary: {
        totalPlatformRevenue,
        totalInvoicesPaid,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
