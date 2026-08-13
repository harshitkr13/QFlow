import express from 'express';
import { getPublicQueueDisplay } from '../controllers/publicQueueController.js';

const router = express.Router();

router.get('/display', getPublicQueueDisplay);

export default router;
