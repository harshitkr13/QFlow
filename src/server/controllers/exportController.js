import { Readable } from 'stream';
import mongoose from 'mongoose';
import { DailySettlement, Invoice, Clinic, Payment } from '../models/index.js';

/**
 * Helper: Escapes and sanitizes a value for RFC 4180 CSV compliance and CSV formula injection protection.
 * Any string value starting with =, +, -, @, \t, or \r is prefixed with a single quote (') unless it is a valid numeric value.
 */
export const sanitizeCSVCell = (val) => {
  if (val === null || val === undefined) {
    return '""';
  }

  // Preserve numbers, booleans as-is
  if (typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }

  let str = String(val).trim();

  // CSV Formula Injection Prevention:
  // If the cell begins with =, +, -, @, \t, or \r, and is NOT a valid finite number, prefix with a single quote (')
  const formulaTriggers = ['=', '+', '-', '@', '\t', '\r'];
  if (formulaTriggers.some((trigger) => str.startsWith(trigger))) {
    const isPureNumber = !isNaN(Number(str)) && str !== '';
    if (!isPureNumber) {
      str = `'${str}`;
    }
  }

  // RFC 4180 Escaping: Wrap in quotes if it contains commas, double quotes, or newlines
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    str = `"${str.replace(/"/g, '""')}"`;
  } else {
    str = `"${str}"`;
  }

  return str;
};

/**
 * Helper: Formats an array of cells into an RFC 4180 CSV line terminated by CRLF (\r\n)
 */
export const formatCSVRow = (cells) => {
  return cells.map(sanitizeCSVCell).join(',') + '\r\n';
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
 * @desc    Export Daily Settlement to CSV (Streamed Response)
 * @route   GET /api/staff/reconciliation/settlements/:id/export
 * @access  Private (STAFF, ADMIN)
 */
export const exportDailySettlementCSV = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid settlement ID format',
      });
    }

    const settlement = await DailySettlement.findById(id).populate('clinicId', 'name address');
    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Settlement record not found',
      });
    }

    // Must be in CLOSED status
    if (settlement.status !== 'CLOSED') {
      return res.status(400).json({
        success: false,
        message: 'Only closed and finalized settlements can be exported',
      });
    }

    // Clinic Isolation Check: STAFF may only export their own clinic
    const staffClinicId = req.user.staffClinicId ? req.user.staffClinicId.toString() : null;
    const settlementClinicId = (settlement.clinicId?._id || settlement.clinicId).toString();

    if (req.user.role === 'STAFF' && staffClinicId !== settlementClinicId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to export settlement records for this clinic',
      });
    }

    // Headers for CSV download
    const filename = `settlement-${settlement.date}-${settlementClinicId}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    const headers = [
      'Settlement Date',
      'Clinic ID',
      'Clinic Name',
      'Status',
      'Total Tokens Issued',
      'Completed Visits',
      'No-Show Visits',
      'Cancelled Visits',
      'Expired Visits',
      'Walk-In Count',
      'Online Appointments',
      'Total Revenue Collected',
      'Outstanding Revenue',
      'Average Wait Time (Mins)',
      'Average Consultation Time (Mins)',
      'Closed At',
      'Notes',
    ];

    const metrics = settlement.metrics || {};
    const dataRow = [
      settlement.date,
      settlementClinicId,
      settlement.clinicId?.name || 'N/A',
      settlement.status,
      metrics.totalTokensIssued ?? 0,
      metrics.completedVisits ?? 0,
      metrics.noShowVisits ?? 0,
      metrics.cancelledVisits ?? 0,
      metrics.expiredVisits ?? 0,
      metrics.walkInCount ?? 0,
      metrics.appointmentCount ?? 0,
      metrics.totalRevenueCollected ?? 0,
      metrics.outstandingRevenue ?? 0,
      metrics.avgWaitMinutes ?? 0,
      metrics.avgConsultationMinutes ?? 0,
      settlement.closedAt ? new Date(settlement.closedAt).toISOString() : 'N/A',
      settlement.notes || '',
    ];

    // Stream CSV content using Node.js stream
    const csvContent = formatCSVRow(headers) + formatCSVRow(dataRow);
    const readable = Readable.from([csvContent]);

    console.log(`[EXPORT_SETTLEMENT] User ${req.user._id || req.user.id} (${req.user.role}) exported settlement ${settlement._id} for clinic ${settlementClinicId}`);

    readable.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export Clinic Invoices / Billing Reconciliation to CSV (Streamed Response)
 * @route   GET /api/staff/reconciliation/invoices/export
 * @access  Private (STAFF, ADMIN)
 */
export const exportInvoicesCSV = async (req, res, next) => {
  try {
    const targetClinicId = req.query.clinicId;
    const staffClinicId = req.user.staffClinicId ? req.user.staffClinicId.toString() : null;

    // Clinic Isolation Check for STAFF
    if (req.user.role === 'STAFF') {
      if (!staffClinicId) {
        return res.status(403).json({
          success: false,
          message: 'Staff account has no assigned clinic',
        });
      }
      if (targetClinicId && targetClinicId.toString() !== staffClinicId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not have permission to export invoices for this clinic',
        });
      }
    }

    const clinicId = req.user.role === 'STAFF' ? staffClinicId : (targetClinicId || staffClinicId);
    if (!clinicId) {
      return res.status(400).json({
        success: false,
        message: 'Clinic ID could not be determined. Please specify clinicId.',
      });
    }

    const { date, startDate, endDate } = req.query;

    const filter = { clinicId };

    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Expected YYYY-MM-DD.',
        });
      }
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd = new Date(`${date}T23:59:59.999Z`);
      filter.createdAt = { $gte: dayStart, $lte: dayEnd };
    } else if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) filter.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    // Query Invoices with minimal privacy-safe projections
    const invoices = await Invoice.find(filter)
      .populate('doctorId', 'fullName specialtyId')
      .populate('patientId', 'fullName')
      .sort({ createdAt: -1 })
      .lean();

    // Query associated payments to determine payment method
    const invoiceIds = invoices.map((inv) => inv._id);
    const payments = await Payment.find({
      invoiceId: { $in: invoiceIds },
      status: 'SUCCESS',
    }).lean();

    const paymentMap = new Map();
    for (const p of payments) {
      paymentMap.set(p.invoiceId.toString(), p.paymentMethod);
    }

    const filename = `invoices-${clinicId}-${date || 'range'}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    const headers = [
      'Invoice Number',
      'Date',
      'Doctor Name',
      'Patient Name',
      'Consultation Fee',
      'Facility Fee',
      'Tax Amount',
      'Discount Amount',
      'Total Payable Amount',
      'Status',
      'Payment Method',
      'Issued At',
      'Paid At',
    ];

    // Stream generation
    async function* generateInvoiceCSV() {
      yield formatCSVRow(headers);

      for (const inv of invoices) {
        const issuedDateStr = inv.issuedAt ? new Date(inv.issuedAt).toISOString().split('T')[0] : '';
        const paidDateStr = inv.paidAt ? new Date(inv.paidAt).toISOString() : '';
        const paymentMethod = paymentMap.get(inv._id.toString()) || (inv.status === 'PAID' ? 'CASH' : 'UNPAID');

        const row = [
          inv.invoiceNumber,
          issuedDateStr,
          inv.doctorId?.fullName || 'Doctor',
          inv.patientId?.fullName || 'Patient', // Minimal Necessary PII for reconciliation
          inv.consultationFee ?? 0,
          inv.clinicFacilityFee ?? 0,
          inv.taxAmount ?? 0,
          inv.discountAmount ?? 0,
          inv.totalPayableAmount ?? 0,
          inv.status,
          paymentMethod,
          inv.issuedAt ? new Date(inv.issuedAt).toISOString() : '',
          paidDateStr,
        ];

        yield formatCSVRow(row);
      }
    }

    const readable = Readable.from(generateInvoiceCSV());

    console.log(`[EXPORT_INVOICES] User ${req.user._id || req.user.id} (${req.user.role}) exported ${invoices.length} invoices for clinic ${clinicId}`);

    readable.pipe(res);
  } catch (error) {
    next(error);
  }
};
