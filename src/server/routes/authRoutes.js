import express from 'express';
import {
  registerPatient,
  loginUser,
  getMe,
  logoutUser,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public Authentication Endpoints
router.post('/register', registerPatient);
router.post('/login', loginUser);

// Protected Authentication Endpoints
router.get('/me', protect, getMe);
router.post('/logout', protect, logoutUser);

export default router;
