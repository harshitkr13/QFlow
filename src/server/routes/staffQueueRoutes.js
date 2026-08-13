import express from 'express';
import {
  searchPatients,
  createWalkInPatient,
  registerWalkIn,
  getTodayQueue,
  callNextPatient,
  startConsultation,
  completeConsultation,
  skipPatient,
  markNoShow,
  rejoinPatient,
  pauseQueue,
  resumeQueue,
  cancelQueueEntry,
} from '../controllers/staffQueueController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All staff queue routes require protection and STAFF/ADMIN/DOCTOR authorization
router.use(protect, authorize('STAFF', 'ADMIN', 'DOCTOR'));

router.post('/patients/search', searchPatients);
router.post('/patients', createWalkInPatient);
router.post('/walk-in', registerWalkIn);
router.get('/today', getTodayQueue);

// Phase 08 Queue Engine Endpoints
router.post('/call-next', callNextPatient);
router.patch('/pause', pauseQueue);
router.patch('/resume', resumeQueue);
router.patch('/:id/start', startConsultation);
router.patch('/:id/complete', completeConsultation);
router.patch('/:id/skip', skipPatient);
router.patch('/:id/no-show', markNoShow);
router.post('/:id/rejoin', rejoinPatient);
router.patch('/:id/cancel', cancelQueueEntry);

export default router;
