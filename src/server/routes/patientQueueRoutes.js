import express from 'express';
import { getPatientLiveQueue } from '../controllers/appointmentController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/live', protect, authorize('PATIENT'), getPatientLiveQueue);

export default router;
