import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  getStaffDailyAnalytics,
  getDoctorAnalytics,
  getAdminAnalyticsSummary,
} from '../controllers/analyticsController.js';

const router = express.Router();

router.get('/staff/analytics/daily', protect, authorize('STAFF', 'ADMIN'), getStaffDailyAnalytics);
router.get('/doctors/me/analytics', protect, authorize('DOCTOR'), getDoctorAnalytics);
router.get('/admin/analytics/summary', protect, authorize('ADMIN'), getAdminAnalyticsSummary);

export default router;
