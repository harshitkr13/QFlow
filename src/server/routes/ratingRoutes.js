import express from 'express';
import { submitRating, getDoctorRatings } from '../controllers/ratingController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Patient rating submission
router.post('/ratings', protect, authorize('PATIENT'), submitRating);

// Public doctor ratings lookup
router.get('/doctors/:id/ratings', getDoctorRatings);

export default router;
