import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  generateInvoiceForConsultation,
  getPatientInvoices,
  getPatientInvoiceById,
  initiatePayment,
  processRefund,
  getStaffBillingSummary,
} from '../controllers/billingController.js';

const router = express.Router();

// Patient Invoice & Payment Endpoints
router.get('/patient/invoices', protect, authorize('PATIENT'), getPatientInvoices);
router.get('/patient/invoices/:id', protect, authorize('PATIENT'), getPatientInvoiceById);
router.post('/patient/payments/initiate', protect, authorize('PATIENT'), initiatePayment);

// Staff / Admin Billing Management Endpoints
router.post('/staff/invoices/generate', protect, authorize('STAFF', 'ADMIN', 'DOCTOR'), generateInvoiceForConsultation);
router.post('/staff/billing/refund', protect, authorize('STAFF', 'ADMIN'), processRefund);
router.get('/staff/billing/summary', protect, authorize('STAFF', 'ADMIN'), getStaffBillingSummary);

export default router;
