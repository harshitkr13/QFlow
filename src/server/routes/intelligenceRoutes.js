import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  getPatientQueuePrediction,
  getStaffQueueIntelligence,
  getStaffAnomalies,
  getStaffDoctorIntelligence,
  getDoctorOwnIntelligence,
  getAdminIntelligenceSummary,
  getAppointmentNoShowAdvisoryController
} from '../controllers/intelligenceController.js';

const router = express.Router();

// Patient Intelligence
router.get(
  '/patient/queue/prediction',
  protect,
  authorize('PATIENT'),
  getPatientQueuePrediction
);

// Staff Intelligence
router.get(
  '/staff/intelligence/queue',
  protect,
  authorize('STAFF', 'ADMIN'),
  getStaffQueueIntelligence
);

router.get(
  '/staff/intelligence/anomalies',
  protect,
  authorize('STAFF', 'ADMIN'),
  getStaffAnomalies
);

router.get(
  '/staff/intelligence/doctor/:id',
  protect,
  authorize('STAFF', 'ADMIN'),
  getStaffDoctorIntelligence
);

router.get(
  '/staff/intelligence/no-show/:appointmentId',
  protect,
  authorize('STAFF', 'ADMIN'),
  getAppointmentNoShowAdvisoryController
);

// Doctor Intelligence
router.get(
  '/doctor/intelligence/me',
  protect,
  authorize('DOCTOR'),
  getDoctorOwnIntelligence
);

// Admin Intelligence
router.get(
  '/admin/intelligence/summary',
  protect,
  authorize('ADMIN'),
  getAdminIntelligenceSummary
);

export default router;
