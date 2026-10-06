import express from 'express';
import { createClinic, updateClinic } from '../controllers/clinicController.js';
import { createSpecialty, updateSpecialty } from '../controllers/specialtyController.js';
import { onboardDoctor, updateDoctorAdmin } from '../controllers/doctorController.js';
import { updateScheduleAdmin } from '../controllers/scheduleController.js';
import { updateStatusAdmin } from '../controllers/doctorStatusController.js';
import { getClinicPolicy, updateClinicPolicy } from '../controllers/clinicPolicyController.js';
import { getQueueAuditHistory, getFinancialAuditHistory } from '../controllers/auditController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply protect & ADMIN authorization to all admin routes
router.use(protect);
router.use(authorize('ADMIN'));

// Clinic management
router.post('/clinics', createClinic);
router.patch('/clinics/:id', updateClinic);
router.get('/clinics/:id/policy', getClinicPolicy);
router.patch('/clinics/:id/policy', updateClinicPolicy);

// Specialty management
router.post('/specialties', createSpecialty);
router.patch('/specialties/:id', updateSpecialty);

// Doctor management & onboarding
router.post('/doctors', onboardDoctor);
router.patch('/doctors/:id', updateDoctorAdmin);
router.put('/doctors/:id/schedule', updateScheduleAdmin);
router.patch('/doctors/:id/status', updateStatusAdmin);

// Operational Audit & Governance
router.get('/audit/queue-history', getQueueAuditHistory);
router.get('/audit/financial', getFinancialAuditHistory);

export default router;
