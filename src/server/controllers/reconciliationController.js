import mongoose from 'mongoose';
import {
  DailySettlement,
  QueueEntry,
  Appointment,
  Invoice,
  Doctor,
  QueueHistory,
  Notification,
} from '../models/index.js';

/**
 * Helper: Format Date string to 'YYYY-MM-DD' in Asia/Kolkata (IST)
 */
const getFormattedDateIST = (dateObj = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(dateObj); // Returns 'YYYY-MM-DD'
};

/**
 * Helper: Resolve and authorize clinic ID for STAFF or ADMIN
 */
const resolveClinicId = (req) => {
  if (req.user.role === 'STAFF') {
    return req.user.staffClinicId ? req.user.staffClinicId.toString() : null;
  }
  if (req.user.role === 'ADMIN') {
    return req.query.clinicId || req.body?.clinicId || (req.user.staffClinicId ? req.user.staffClinicId.toString() : null);
  }
  return null;
};

/**
 * @desc    Get Daily Reconciliation Preview (Read-Only)
 * @route   GET /api/staff/reconciliation/daily-preview
 * @access  Private (STAFF, ADMIN)
 */
export const getDailyReconciliationPreview = async (req, res, next) => {
  try {
    const clinicId = resolveClinicId(req);
    if (!clinicId) {
      return res.status(400).json({
        success: false,
        message: 'Clinic ID could not be determined. Please specify clinicId.',
      });
    }

    const date = req.query.date || getFormattedDateIST();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Expected YYYY-MM-DD.',
      });
    }

    // Fetch all Queue Entries for clinic and date
    const allEntries = await QueueEntry.find({
      clinicId,
      queueDate: date,
    })
      .populate('doctorId', 'fullName consultationFee specialtyId')
      .populate('patientId', 'fullName phone');

    // Status Counts
    const waitingEntries = allEntries.filter((e) => e.status === 'WAITING');
    const calledEntries = allEntries.filter((e) => e.status === 'CALLED');
    const skippedEntries = allEntries.filter((e) => e.status === 'SKIPPED');
    const inConsultationEntries = allEntries.filter((e) => e.status === 'IN_CONSULTATION');
    const completedEntries = allEntries.filter((e) => e.status === 'COMPLETED');
    const cancelledEntries = allEntries.filter((e) => e.status === 'CANCELLED');
    const noShowEntries = allEntries.filter((e) => e.status === 'NO_SHOW');
    const expiredEntries = allEntries.filter((e) => e.status === 'EXPIRED');

    // Active Consultations
    const activeConsultations = inConsultationEntries.map((e) => ({
      _id: e._id,
      tokenNumber: e.tokenNumber,
      doctorName: e.doctorId?.fullName || 'Doctor',
      patientName: e.patientId?.fullName || 'Patient',
      consultationStartedAt: e.consultationStartedAt,
    }));

    // Invoicing & Financial Analysis for Completed Consultations
    const completedEntryIds = completedEntries.map((e) => e._id);
    const invoices = await Invoice.find({
      clinicId,
      queueEntryId: { $in: completedEntryIds },
    });

    const invoicedEntryIdSet = new Set(invoices.map((inv) => inv.queueEntryId.toString()));
    const unbilledCompletedCount = completedEntries.filter(
      (e) => !invoicedEntryIdSet.has(e._id.toString())
    ).length;

    // Financial totals
    const allEntryIds = allEntries.map((e) => e._id);
    const dayInvoices = await Invoice.find({
      clinicId,
      queueEntryId: { $in: allEntryIds },
    });

    let totalInvoiced = 0;
    let totalCollected = 0;
    for (const inv of dayInvoices) {
      totalInvoiced += inv.totalPayableAmount || 0;
      if (inv.status === 'PAID') {
        totalCollected += inv.totalPayableAmount || 0;
      }
    }
    const outstandingRevenue = Math.max(0, totalInvoiced - totalCollected);

    // Existing settlement check
    const existingSettlement = await DailySettlement.findOne({ clinicId, date });

    return res.status(200).json({
      success: true,
      clinicId,
      date,
      isClosed: Boolean(existingSettlement && existingSettlement.status === 'CLOSED'),
      settlement: existingSettlement || null,
      summary: {
        totalTokensIssued: allEntries.length,
        waitingCount: waitingEntries.length,
        calledCount: calledEntries.length,
        skippedCount: skippedEntries.length,
        inConsultationCount: inConsultationEntries.length,
        completedCount: completedEntries.length,
        cancelledCount: cancelledEntries.length,
        noShowCount: noShowEntries.length,
        expiredCount: expiredEntries.length,
        walkInCount: allEntries.filter((e) => e.source === 'WALK_IN').length,
        appointmentCount: allEntries.filter((e) => e.source === 'ONLINE').length,
      },
      hasActiveConsultations: inConsultationEntries.length > 0,
      activeConsultations,
      unservedCount: waitingEntries.length + calledEntries.length + skippedEntries.length,
      billing: {
        totalCompleted: completedEntries.length,
        invoicedCount: invoices.length,
        unbilledCompletedCount,
        totalInvoiced,
        totalCollected,
        outstandingRevenue,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Finalize and Close Clinic Day (Settlement Execution)
 * @route   POST /api/staff/reconciliation/close-day
 * @access  Private (STAFF, ADMIN)
 */
export const closeClinicDay = async (req, res, next) => {
  try {
    const clinicId = resolveClinicId(req);
    if (!clinicId) {
      return res.status(400).json({
        success: false,
        message: 'Clinic ID could not be determined. Please specify clinicId.',
      });
    }

    const { date, notes, force } = req.body;
    const targetDate = date || getFormattedDateIST();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Expected YYYY-MM-DD.',
      });
    }

    // Safety Invariant 1: Prevent duplicate closure
    const existingSettlement = await DailySettlement.findOne({ clinicId, date: targetDate });
    if (existingSettlement && existingSettlement.status === 'CLOSED') {
      return res.status(400).json({
        success: false,
        message: `Clinic day ${targetDate} has already been settled and closed`,
        settlement: existingSettlement,
      });
    }

    // Safety Invariant 2: Check for in-progress consultations
    const inConsultationEntries = await QueueEntry.find({
      clinicId,
      queueDate: targetDate,
      status: 'IN_CONSULTATION',
    })
      .populate('doctorId', 'fullName')
      .populate('patientId', 'fullName');

    if (inConsultationEntries.length > 0 && force !== true) {
      return res.status(400).json({
        success: false,
        message: 'Cannot close clinic day while consultations are in progress. Complete or pause consultations, or use force: true.',
        activeConsultations: inConsultationEntries.map((e) => ({
          queueEntryId: e._id,
          tokenNumber: e.tokenNumber,
          doctorName: e.doctorId?.fullName || 'Doctor',
          patientName: e.patientId?.fullName || 'Patient',
        })),
      });
    }

    // Expiration: Unserved entries transition to EXPIRED
    const unservedStatuses = ['WAITING', 'CALLED', 'SKIPPED'];
    if (force === true) {
      unservedStatuses.push('IN_CONSULTATION');
    }

    const unservedEntries = await QueueEntry.find({
      clinicId,
      queueDate: targetDate,
      status: { $in: unservedStatuses },
    });

    if (unservedEntries.length > 0) {
      const unservedIds = unservedEntries.map((e) => e._id);
      await QueueEntry.updateMany(
        { _id: { $in: unservedIds } },
        { status: 'EXPIRED' }
      );

      // Transition linked appointments to EXPIRED
      const linkedApptIds = unservedEntries
        .filter((e) => e.appointmentId)
        .map((e) => e.appointmentId);

      if (linkedApptIds.length > 0) {
        await Appointment.updateMany(
          { _id: { $in: linkedApptIds }, status: { $in: ['BOOKED', 'CHECKED_IN'] } },
          { status: 'EXPIRED' }
        );
      }

      // Also expire booked appointments for this clinic and date that never checked in
      await Appointment.updateMany(
        { clinicId, appointmentDate: targetDate, status: 'BOOKED' },
        { status: 'EXPIRED' }
      );

      // Write QueueHistory audit entries
      const performedBy = req.user._id || req.user.id;
      const historyRecords = unservedEntries.map((e) => ({
        queueEntryId: e._id,
        doctorId: e.doctorId,
        clinicId: e.clinicId,
        action: 'EXPIRED',
        previousState: e.status,
        newState: 'EXPIRED',
        performedBy,
        userRole: req.user.role,
        reason: 'Clinic day ended: Unserved queue entry expired during day-end reconciliation',
        timestamp: new Date(),
      }));

      await QueueHistory.insertMany(historyRecords);

      // In-app Notification to unserved patients
      for (const e of unservedEntries) {
        if (e.patientId) {
          await Notification.create({
            patientId: e.patientId,
            queueEntryId: e._id,
            type: 'QUEUE_EXPIRED',
            title: 'Clinic Day Ended',
            message: 'Your queue entry has expired as the clinic operational day has concluded. Please contact reception or rebook.',
          }).catch(() => {});
        }
      }
    }

    // Auto-generate missing invoices for COMPLETED consultations without duplicate invoices
    const completedEntries = await QueueEntry.find({
      clinicId,
      queueDate: targetDate,
      status: 'COMPLETED',
    }).populate('doctorId');

    let autoGeneratedInvoicesCount = 0;
    for (const compEntry of completedEntries) {
      const existingInv = await Invoice.findOne({ queueEntryId: compEntry._id });
      if (!existingInv) {
        const fee = compEntry.doctorId?.consultationFee || 500;
        const invNumber = `INV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        await Invoice.create({
          invoiceNumber: invNumber,
          clinicId,
          doctorId: compEntry.doctorId._id || compEntry.doctorId,
          patientId: compEntry.patientId,
          appointmentId: compEntry.appointmentId || null,
          queueEntryId: compEntry._id,
          consultationFee: fee,
          clinicFacilityFee: 0,
          taxAmount: 0,
          discountAmount: 0,
          totalPayableAmount: fee,
          status: 'ISSUED',
          issuedAt: new Date(),
        });
        autoGeneratedInvoicesCount++;
      }
    }

    // Authoritative Metric Calculations
    const allDayEntries = await QueueEntry.find({ clinicId, queueDate: targetDate });
    const totalTokensIssued = allDayEntries.length;
    const completedVisits = allDayEntries.filter((e) => e.status === 'COMPLETED').length;
    const noShowVisits = allDayEntries.filter((e) => e.status === 'NO_SHOW').length;
    const cancelledVisits = allDayEntries.filter((e) => e.status === 'CANCELLED').length;
    const expiredVisits = allDayEntries.filter((e) => e.status === 'EXPIRED').length;
    const walkInCount = allDayEntries.filter((e) => e.source === 'WALK_IN').length;
    const appointmentCount = allDayEntries.filter((e) => e.source === 'ONLINE').length;

    // Wait & Consultation Duration Averages
    const waitTimes = [];
    const consultTimes = [];
    for (const e of allDayEntries) {
      if (e.calledAt && e.joinedAt) {
        const waitMin = Math.round((new Date(e.calledAt).getTime() - new Date(e.joinedAt).getTime()) / 60000);
        if (waitMin >= 0) waitTimes.push(waitMin);
      }
      if (e.completedAt && e.consultationStartedAt) {
        const consultMin = Math.round((new Date(e.completedAt).getTime() - new Date(e.consultationStartedAt).getTime()) / 60000);
        if (consultMin >= 0) consultTimes.push(consultMin);
      }
    }

    const avgWaitMinutes = waitTimes.length > 0
      ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
      : 0;

    const avgConsultationMinutes = consultTimes.length > 0
      ? Math.round(consultTimes.reduce((a, b) => a + b, 0) / consultTimes.length)
      : 0;

    // Financial Reconciliation
    const dayInvoices = await Invoice.find({
      clinicId,
      queueEntryId: { $in: allDayEntries.map((e) => e._id) },
    });

    let totalRevenueCollected = 0;
    let outstandingRevenue = 0;
    for (const inv of dayInvoices) {
      if (inv.status === 'PAID') {
        totalRevenueCollected += inv.totalPayableAmount || 0;
      } else if (inv.status !== 'CANCELLED' && inv.status !== 'REFUNDED') {
        outstandingRevenue += inv.totalPayableAmount || 0;
      }
    }

    // Persist Authoritative DailySettlement Document
    const performedBy = req.user._id || req.user.id;
    const settlement = await DailySettlement.findOneAndUpdate(
      { clinicId, date: targetDate },
      {
        clinicId,
        date: targetDate,
        closedBy: performedBy,
        closedAt: new Date(),
        status: 'CLOSED',
        notes: notes ? notes.trim() : null,
        metrics: {
          totalTokensIssued,
          completedVisits,
          noShowVisits,
          cancelledVisits,
          expiredVisits,
          walkInCount,
          appointmentCount,
          totalRevenueCollected,
          outstandingRevenue,
          avgWaitMinutes,
          avgConsultationMinutes,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: `Clinic day ${targetDate} finalized and closed successfully`,
      settlement,
      autoGeneratedInvoicesCount,
      expiredCount: unservedEntries.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Clinic Settlement History (Past Closures)
 * @route   GET /api/staff/reconciliation/history
 * @access  Private (STAFF, ADMIN)
 */
export const getSettlementHistory = async (req, res, next) => {
  try {
    const clinicId = resolveClinicId(req);
    if (!clinicId) {
      return res.status(400).json({
        success: false,
        message: 'Clinic ID could not be determined. Please specify clinicId.',
      });
    }

    const filter = { clinicId };
    if (req.query.date) {
      filter.date = req.query.date;
    }

    const settlements = await DailySettlement.find(filter)
      .populate('closedBy', 'name email role')
      .sort({ date: -1 });

    return res.status(200).json({
      success: true,
      count: settlements.length,
      settlements,
    });
  } catch (error) {
    next(error);
  }
};
