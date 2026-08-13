import express from 'express';
import { getPatientNotifications, markNotificationRead } from '../controllers/notificationController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, authorize('PATIENT'), getPatientNotifications);
router.patch('/:id/read', protect, authorize('PATIENT'), markNotificationRead);

export default router;
