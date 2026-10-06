import express from 'express';
import {
  getDailyReconciliationPreview,
  closeClinicDay,
  getSettlementHistory,
} from '../controllers/reconciliationController.js';
import {
  exportDailySettlementCSV,
  exportInvoicesCSV,
} from '../controllers/exportController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All reconciliation endpoints require authentication and STAFF or ADMIN authorization
router.use(protect, authorize('STAFF', 'ADMIN'));

// Daily Preview (read-only)
router.get('/daily-preview', getDailyReconciliationPreview);
router.get('/preview', getDailyReconciliationPreview);

// Finalize & Close Clinic Day
router.post('/close-day', closeClinicDay);
router.post('/close', closeClinicDay);

// Settlement History
router.get('/history', getSettlementHistory);

// CSV Export Endpoints (Streamed RFC 4180 Responses)
router.get('/settlements/:id/export', exportDailySettlementCSV);
router.get('/invoices/export', exportInvoicesCSV);

export default router;
