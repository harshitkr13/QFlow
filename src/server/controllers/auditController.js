import mongoose from 'mongoose';
import { QueueHistory, FinancialAuditLog } from '../models/index.js';

/**
 * Allowed actions in QueueHistory for input validation
 */
const VALID_QUEUE_ACTIONS = [
  'CHECK_IN',
  'CALL_NEXT',
  'START_CONSULTATION',
  'COMPLETE',
  'SKIP',
  'NO_SHOW',
  'CANCEL',
  'REJOIN',
  'PAUSE_QUEUE',
  'RESUME_QUEUE',
  'STATUS_CHANGE',
  'SELF_CHECK_IN',
  'TRIAGE_ESCALATION',
  'QUEUE_TRANSFER',
  'EXPIRED',
  'DAY_END_EXPIRED',
];

/**
 * Allowed actions in FinancialAuditLog for input validation
 */
const VALID_FINANCIAL_ACTIONS = [
  'INVOICE_CREATED',
  'INVOICE_ISSUED',
  'PAYMENT_INITIATED',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
  'REFUND_INITIATED',
  'REFUND_COMPLETED',
  'INVOICE_CANCELLED',
];

/**
 * @desc    Get Queue History Audit Trail
 * @route   GET /api/admin/audit/queue-history
 * @access  Private (ADMIN)
 */
export const getQueueAuditHistory = async (req, res, next) => {
  try {
    const {
      clinicId,
      doctorId,
      action,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};

    // Validate and apply clinicId filter
    if (clinicId) {
      if (!mongoose.Types.ObjectId.isValid(clinicId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid clinicId format',
        });
      }
      filter.clinicId = clinicId;
    }

    // Validate and apply doctorId filter
    if (doctorId) {
      if (!mongoose.Types.ObjectId.isValid(doctorId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid doctorId format',
        });
      }
      filter.doctorId = doctorId;
    }

    // Validate and apply action filter
    if (action) {
      if (!VALID_QUEUE_ACTIONS.includes(action)) {
        return res.status(400).json({
          success: false,
          message: `Invalid action filter. Allowed actions: ${VALID_QUEUE_ACTIONS.join(', ')}`,
        });
      }
      filter.action = action;
    }

    // Date range filtering on timestamp
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        filter.timestamp.$gte = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        filter.timestamp.$lte = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    // Pagination bounds
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    // Indexed execution
    const total = await QueueHistory.countDocuments(filter);
    const logs = await QueueHistory.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('doctorId', 'fullName specialtyId')
      .populate('performedBy', 'email role')
      .populate('queueEntryId', 'tokenNumber source priority status')
      .lean();

    // Operational Security Telemetry Logging
    const actorId = req.user._id || req.user.id;
    console.log(`[AUDIT_QUERY_QUEUE] Admin ${actorId} queried QueueHistory | count=${logs.length} | total=${total} | clinic=${clinicId || 'ALL'}`);

    return res.status(200).json({
      success: true,
      count: logs.length,
      total,
      page: pageNum,
      limit: limitNum,
      logs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Financial Audit Trail
 * @route   GET /api/admin/audit/financial
 * @access  Private (ADMIN)
 */
export const getFinancialAuditHistory = async (req, res, next) => {
  try {
    const {
      clinicId,
      action,
      eventType,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};

    // Validate and apply clinicId filter
    if (clinicId) {
      if (!mongoose.Types.ObjectId.isValid(clinicId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid clinicId format',
        });
      }
      filter.clinicId = clinicId;
    }

    // Support both eventType and action query param
    const selectedAction = action || eventType;
    if (selectedAction) {
      if (!VALID_FINANCIAL_ACTIONS.includes(selectedAction)) {
        return res.status(400).json({
          success: false,
          message: `Invalid action filter. Allowed actions: ${VALID_FINANCIAL_ACTIONS.join(', ')}`,
        });
      }
      filter.action = selectedAction;
    }

    // Date range filtering on timestamp
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        filter.timestamp.$gte = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        filter.timestamp.$lte = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    // Pagination bounds
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    // Indexed execution
    const total = await FinancialAuditLog.countDocuments(filter);
    const logs = await FinancialAuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('invoiceId', 'invoiceNumber totalPayableAmount status')
      .populate('patientId', 'fullName')
      .populate('performedBy', 'email role')
      .lean();

    // Operational Security Telemetry Logging
    const actorId = req.user._id || req.user.id;
    console.log(`[AUDIT_QUERY_FINANCIAL] Admin ${actorId} queried FinancialAuditLog | count=${logs.length} | total=${total} | clinic=${clinicId || 'ALL'}`);

    return res.status(200).json({
      success: true,
      count: logs.length,
      total,
      page: pageNum,
      limit: limitNum,
      logs,
    });
  } catch (error) {
    next(error);
  }
};
