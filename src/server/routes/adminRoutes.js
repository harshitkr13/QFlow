import express from 'express';
import { createClinic, updateClinic } from '../controllers/clinicController.js';
import { createSpecialty, updateSpecialty } from '../controllers/specialtyController.js';
import { onboardDoctor, updateDoctorAdmin } from '../controllers/doctorController.js';
import { updateScheduleAdmin } from '../controllers/scheduleController.js';
import { updateStatusAdmin } from '../controllers/doctorStatusController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply protect & ADMIN authorization to all admin routes
router.use(protect);
router.use(authorize('ADMIN'));

// Clinic management
router.post('/clinics', createClinic);
router.patch('/clinics/:id', updateClinic);

// Specialty management
router.post('/specialties', createSpecialty);
router.patch('/specialties/:id', updateSpecialty);

// Doctor management & onboarding
router.post('/doctors', onboardDoctor);
router.patch('/doctors/:id', updateDoctorAdmin);
router.put('/doctors/:id/schedule', updateScheduleAdmin);
router.patch('/doctors/:id/status', updateStatusAdmin);

export default router;
