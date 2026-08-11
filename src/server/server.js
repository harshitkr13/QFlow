import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import clinicRoutes from './routes/clinicRoutes.js';
import specialtyRoutes from './routes/specialtyRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import { notFoundHandler, errorHandler } from './middleware/errorMiddleware.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Standard Middleware
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/specialties', specialtyRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/appointments', appointmentRoutes);

// Error Handling Middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Start server function
export const startServer = async () => {
  const server = app.listen(PORT, () => {
    console.log(`QFlow Express Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });

  connectDB().catch((error) => {
    console.error('Failed to connect to MongoDB on server startup:', error.message);
  });

  return server;
};

// Auto-run when started directly
startServer();

export default app;
