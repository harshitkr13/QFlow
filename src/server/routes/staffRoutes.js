import express from 'express';
import { updateStatusStaff } from '../controllers/doctorStatusController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Staff doctor operational status update (clinic scoped)
router.patch('/doctors/:id/status', protect, authorize('STAFF', 'ADMIN'), updateStatusStaff);

export default router;
