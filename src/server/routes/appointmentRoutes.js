import express from 'express';
import {
  createAppointment,
  getMyAppointments,
  getAppointmentById,
  cancelAppointment,
  checkInAppointment,
  selfCheckInAppointment,
  getPatientLiveQueue,
} from '../controllers/appointmentController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/me', protect, authorize('PATIENT'), getMyAppointments);
router.get('/queue/live', protect, authorize('PATIENT'), getPatientLiveQueue);
router.post('/', protect, authorize('PATIENT'), createAppointment);
router.get('/:id', protect, getAppointmentById);
router.patch('/:id/cancel', protect, cancelAppointment);
router.patch('/:id/check-in', protect, authorize('STAFF', 'ADMIN'), checkInAppointment);
router.post('/:id/self-check-in', protect, authorize('PATIENT'), selfCheckInAppointment);

export default router;
