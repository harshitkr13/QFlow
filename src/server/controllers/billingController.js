import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import FinancialAuditLog from '../models/FinancialAuditLog.js';
import QueueEntry from '../models/QueueEntry.js';
import Doctor from '../models/Doctor.js';
import Patient from '../models/Patient.js';
import paymentProvider from '../services/paymentProvider.js';

/**
 * Generate invoice for completed consultation
 * Server-authoritative fee calculation from Doctor.consultationFee
 */
export const generateInvoiceForConsultation = async (req, res) => {
  try {
    const { queueEntryId } = req.body;
    if (!queueEntryId || !mongoose.Types.ObjectId.isValid(queueEntryId)) {
      return res.status(400).json({ success: false, message: 'Valid queueEntryId is required' });
    }

    const queueEntry = await QueueEntry.findById(queueEntryId);
    if (!queueEntry) {
      return res.status(404).json({ success: false, message: 'Queue entry not found' });
    }

    if (queueEntry.status !== 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Invoice can only be created for COMPLETED consultations' });
    }

    // Check if invoice already exists
    const existingInvoice = await Invoice.findOne({ queueEntryId: queueEntry._id });
    if (existingInvoice) {
      return res.status(409).json({ success: false, message: 'Invoice already exists for this consultation', invoice: existingInvoice });
    }

    // Fetch doctor to derive authoritative fee
    const doctor = await Doctor.findById(queueEntry.doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor record not found' });
    }

    const consultationFee = doctor.consultationFee || 500;
    const clinicFacilityFee = 50;
    const taxAmount = Math.round(consultationFee * 0.05); // 5% tax
    const discountAmount = 0;
    const totalPayableAmount = consultationFee + clinicFacilityFee + taxAmount - discountAmount;

    const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Atomically create invoice & audit log inside transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const [invoice] = await Invoice.create(
        [
          {
            invoiceNumber,
            clinicId: queueEntry.clinicId,
            doctorId: queueEntry.doctorId,
            patientId: queueEntry.patientId,
            appointmentId: queueEntry.appointmentId || null,
            queueEntryId: queueEntry._id,
            consultationFee,
            clinicFacilityFee,
            taxAmount,
            discountAmount,
            totalPayableAmount,
            status: 'ISSUED',
            issuedAt: new Date(),
          },
        ],
        { session }
      );

      await FinancialAuditLog.create(
        [
          {
            invoiceId: invoice._id,
            patientId: queueEntry.patientId,
            clinicId: queueEntry.clinicId,
            action: 'INVOICE_ISSUED',
            previousStatus: 'DRAFT',
            newStatus: 'ISSUED',
            amount: totalPayableAmount,
            performedBy: req.user._id || req.user.id,
            actorRole: req.user.role,
            provider: 'INTERNAL',
            transactionReference: invoiceNumber,
            timestamp: new Date(),
          },
        ],
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      return res.status(201).json({ success: true, message: 'Invoice created successfully', invoice });
    } catch (txError) {
      await session.abortTransaction();
      session.endSession();
      if (txError.code === 11000) {
        return res.status(409).json({ success: false, message: 'Invoice already exists for this consultation' });
      }
      throw txError;
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/patient/invoices
 * Get authenticated patient's invoices
 */
export const getPatientInvoices = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const patient = await Patient.findOne({ userId });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const invoices = await Invoice.find({ patientId: patient._id })
      .populate('clinicId', 'name address')
      .populate('doctorId', 'fullName specialty')
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: invoices.length, invoices });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/patient/invoices/:id
 * Get single invoice by ID with strict ownership validation
 */
export const getPatientInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid invoice ID' });
    }

    const userId = req.user._id || req.user.id;
    const patient = await Patient.findOne({ userId });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const invoice = await Invoice.findById(id)
      .populate('clinicId', 'name address')
      .populate('doctorId', 'fullName specialty');

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // IDOR Protection
    if (!invoice.patientId.equals(patient._id)) {
      return res.status(403).json({ success: false, message: 'Access denied to this invoice' });
    }

    return res.json({ success: true, invoice });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/patient/payments/initiate
 * Initiate payment with server-derived fee and idempotency check
 */
export const initiatePayment = async (req, res) => {
  try {
    const { invoiceId, paymentMethod = 'ONLINE_MOCK', idempotencyKey, simulateFailure = false } = req.body;

    if (!invoiceId || !mongoose.Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json({ success: false, message: 'Valid invoiceId is required' });
    }

    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim() === '') {
      return res.status(400).json({ success: false, message: 'idempotencyKey is required' });
    }

    const userId = req.user._id || req.user.id;
    const patient = await Patient.findOne({ userId });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // IDOR Protection
    if (!invoice.patientId.equals(patient._id)) {
      return res.status(403).json({ success: false, message: 'Access denied to this invoice' });
    }

    if (invoice.status === 'PAID') {
      return res.status(400).json({ success: false, message: 'Invoice already paid' });
    }

    if (invoice.status === 'CANCELLED' || invoice.status === 'REFUNDED') {
      return res.status(400).json({ success: false, message: `Cannot pay invoice in ${invoice.status} status` });
    }

    // Check for existing payment with idempotency key
    const existingPayment = await Payment.findOne({ idempotencyKey: idempotencyKey.trim() });
    if (existingPayment) {
      return res.status(200).json({
        success: true,
        message: 'Idempotency key replayed; returning existing payment record',
        payment: existingPayment,
      });
    }

    // Authoritative Amount from Invoice
    const amount = invoice.totalPayableAmount;

    // STEP 1: External Provider Interaction (OUTSIDE DB Transaction)
    const providerResult = await paymentProvider.createPayment({
      invoiceId: invoice._id,
      amount,
      currency: 'INR',
      idempotencyKey: idempotencyKey.trim(),
      simulateFailure,
    });

    if (!providerResult.success) {
      // Record failed payment attempt
      const sessionFail = await mongoose.startSession();
      sessionFail.startTransaction();
      try {
        const [failedPayment] = await Payment.create(
          [
            {
              invoiceId: invoice._id,
              patientId: patient._id,
              clinicId: invoice.clinicId,
              amount,
              currency: 'INR',
              paymentMethod,
              status: 'FAILED',
              idempotencyKey: idempotencyKey.trim(),
              provider: 'MOCK',
              failureReason: providerResult.error,
            },
          ],
          { session: sessionFail }
        );

        await FinancialAuditLog.create(
          [
            {
              paymentId: failedPayment._id,
              invoiceId: invoice._id,
              patientId: patient._id,
              clinicId: invoice.clinicId,
              action: 'PAYMENT_FAILED',
              previousStatus: 'INITIATED',
              newStatus: 'FAILED',
              amount,
              performedBy: req.user._id || req.user.id,
              actorRole: req.user.role,
              provider: 'MOCK',
              transactionReference: idempotencyKey.trim(),
              reason: providerResult.error,
              timestamp: new Date(),
            },
          ],
          { session: sessionFail }
        );

        await sessionFail.commitTransaction();
        sessionFail.endSession();

        return res.status(400).json({ success: false, message: providerResult.error, payment: failedPayment });
      } catch (err) {
        await sessionFail.abortTransaction();
        sessionFail.endSession();
        throw err;
      }
    }

    // STEP 2: MongoDB Session Transaction (Atomic Writes)
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const [payment] = await Payment.create(
        [
          {
            invoiceId: invoice._id,
            patientId: patient._id,
            clinicId: invoice.clinicId,
            amount,
            currency: 'INR',
            paymentMethod,
            status: 'SUCCESS',
            idempotencyKey: idempotencyKey.trim(),
            provider: 'MOCK',
            providerTransactionId: providerResult.providerTransactionId,
            completedAt: new Date(),
          },
        ],
        { session }
      );

      await Invoice.updateOne({ _id: invoice._id }, { status: 'PAID', paidAt: new Date() }, { session });

      await FinancialAuditLog.create(
        [
          {
            paymentId: payment._id,
            invoiceId: invoice._id,
            patientId: patient._id,
            clinicId: invoice.clinicId,
            action: 'PAYMENT_SUCCESS',
            previousStatus: 'ISSUED',
            newStatus: 'PAID',
            amount,
            performedBy: req.user._id || req.user.id,
            actorRole: req.user.role,
            provider: 'MOCK',
            transactionReference: providerResult.providerTransactionId,
            timestamp: new Date(),
          },
        ],
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({ success: true, message: 'Payment completed successfully', payment });
    } catch (txError) {
      await session.abortTransaction();
      session.endSession();
      if (txError.code === 11000) {
        return res.status(409).json({ success: false, message: 'Payment initiation collision or invoice already paid' });
      }
      throw txError;
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/staff/billing/refund
 * Process full refund (STAFF / ADMIN only)
 */
export const processRefund = async (req, res) => {
  try {
    const { invoiceId, reason = 'Patient request', simulateFailure = false } = req.body;
    if (!invoiceId || !mongoose.Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json({ success: false, message: 'Valid invoiceId is required' });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Role Scope Check for Staff
    if (req.user.role === 'STAFF' && req.user.staffClinicId) {
      if (!invoice.clinicId.equals(req.user.staffClinicId)) {
        return res.status(403).json({ success: false, message: 'Staff cannot process refund for another clinic' });
      }
    }

    if (invoice.status !== 'PAID') {
      return res.status(400).json({ success: false, message: `Invoice status is ${invoice.status}; only PAID invoices can be refunded` });
    }

    const payment = await Payment.findOne({ invoiceId: invoice._id, status: 'SUCCESS' });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'No successful payment record found for this invoice' });
    }

    // STEP 1: Provider Interaction (OUTSIDE DB Tx)
    const refundResult = await paymentProvider.refundPayment({
      providerTransactionId: payment.providerTransactionId,
      amount: payment.amount,
      simulateFailure,
    });

    if (!refundResult.success) {
      return res.status(400).json({ success: false, message: refundResult.error });
    }

    // STEP 2: MongoDB Session Transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await Payment.updateOne({ _id: payment._id }, { status: 'REFUNDED', refundedAt: new Date() }, { session });
      await Invoice.updateOne({ _id: invoice._id }, { status: 'REFUNDED' }, { session });

      await FinancialAuditLog.create(
        [
          {
            paymentId: payment._id,
            invoiceId: invoice._id,
            patientId: invoice.patientId,
            clinicId: invoice.clinicId,
            action: 'REFUND_COMPLETED',
            previousStatus: 'PAID',
            newStatus: 'REFUNDED',
            amount: payment.amount,
            performedBy: req.user._id || req.user.id,
            actorRole: req.user.role,
            provider: 'MOCK',
            transactionReference: refundResult.refundReference,
            reason,
            timestamp: new Date(),
          },
        ],
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      return res.json({ success: true, message: 'Refund processed successfully', refundReference: refundResult.refundReference });
    } catch (txError) {
      await session.abortTransaction();
      session.endSession();
      throw txError;
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/staff/billing/summary?clinicId=...
 * Get clinic billing summary (STAFF / ADMIN)
 */
export const getStaffBillingSummary = async (req, res) => {
  try {
    let { clinicId } = req.query;

    if (req.user.role === 'STAFF') {
      clinicId = req.user.staffClinicId ? req.user.staffClinicId.toString() : clinicId;
    }

    if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: 'Valid clinicId is required' });
    }

    const summary = await Invoice.aggregate([
      { $match: { clinicId: new mongoose.Types.ObjectId(clinicId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalPayableAmount' },
        },
      },
    ]);

    const invoices = await Invoice.find({ clinicId })
      .populate('patientId', 'fullName phone')
      .populate('doctorId', 'fullName')
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json({ success: true, clinicId, summary, count: invoices.length, invoices });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
