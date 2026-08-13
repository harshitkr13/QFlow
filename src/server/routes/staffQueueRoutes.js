import express from 'express';
import {
  searchPatients,
  createWalkInPatient,
  registerWalkIn,
  getTodayQueue,
} from '../controllers/staffQueueController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/patients/search', protect, authorize('STAFF', 'ADMIN'), searchPatients);
router.post('/patients', protect, authorize('STAFF', 'ADMIN'), createWalkInPatient);
router.post('/walk-in', protect, authorize('STAFF', 'ADMIN'), registerWalkIn);
router.get('/today', protect, authorize('STAFF', 'ADMIN'), getTodayQueue);

export default router;
