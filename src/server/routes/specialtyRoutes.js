import express from 'express';
import { getSpecialties } from '../controllers/specialtyController.js';

const router = express.Router();

router.get('/', getSpecialties);

export default router;
