import express from 'express';
import { updateStatusStaff } from '../controllers/doctorStatusController.js';
import { getStaffAppointments } from '../controllers/appointmentController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Staff doctor operational status update (clinic scoped)
router.patch('/doctors/:id/status', protect, authorize('STAFF', 'ADMIN'), updateStatusStaff);

// Staff clinic appointments lookup
router.get('/appointments', protect, authorize('STAFF', 'ADMIN'), getStaffAppointments);

export default router;
