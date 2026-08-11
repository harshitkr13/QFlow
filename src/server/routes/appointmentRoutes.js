import express from 'express';
import {
  createAppointment,
  getMyAppointments,
  getAppointmentById,
  cancelAppointment,
  checkInAppointment,
} from '../controllers/appointmentController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/me', protect, authorize('PATIENT'), getMyAppointments);
router.post('/', protect, authorize('PATIENT'), createAppointment);
router.get('/:id', protect, getAppointmentById);
router.patch('/:id/cancel', protect, cancelAppointment);
router.patch('/:id/check-in', protect, authorize('STAFF', 'ADMIN'), checkInAppointment);

export default router;
