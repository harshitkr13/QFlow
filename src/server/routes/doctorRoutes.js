import express from 'express';
import {
  getDoctors,
  getDoctorById,
  updateDoctorSelf,
  discoverDoctors,
} from '../controllers/doctorController.js';
import {
  getDoctorSchedule,
  updateScheduleSelf,
} from '../controllers/scheduleController.js';
import {
  getDoctorStatus,
  updateStatusSelf,
} from '../controllers/doctorStatusController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Patient Discovery Endpoint (Stage 1)
router.get('/discover', discoverDoctors);

// Public / Protected doctor endpoints
router.get('/', getDoctors);
router.patch('/me', protect, authorize('DOCTOR'), updateDoctorSelf);
router.put('/me/schedule', protect, authorize('DOCTOR'), updateScheduleSelf);
router.patch('/me/status', protect, authorize('DOCTOR'), updateStatusSelf);

// Specific doctor ID endpoints
router.get('/:id', getDoctorById);
router.get('/:id/schedule', getDoctorSchedule);
router.get('/:id/status', protect, getDoctorStatus);

export default router;
