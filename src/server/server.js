import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import clinicRoutes from './routes/clinicRoutes.js';
import specialtyRoutes from './routes/specialtyRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import staffQueueRoutes from './routes/staffQueueRoutes.js';
import patientQueueRoutes from './routes/patientQueueRoutes.js';
import publicQueueRoutes from './routes/publicQueueRoutes.js';
import ratingRoutes from './routes/ratingRoutes.js';
import patientNotificationRoutes from './routes/patientNotificationRoutes.js';
import billingRoutes from './routes/billingRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import intelligenceRoutes from './routes/intelligenceRoutes.js';
import reconciliationRoutes from './routes/reconciliationRoutes.js';
import { notFoundHandler, errorHandler } from './middleware/errorMiddleware.js';
import {
  securityHeaders,
  apiRateLimiter,
  authRateLimiter,
  publicDisplayRateLimiter,
} from './middleware/securityMiddleware.js';
import { validateEnvironment } from './config/envValidator.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Disable Express fingerprint header to prevent technology disclosure
app.disable('x-powered-by');

// Trust first proxy hop (e.g. Render, Cloudflare, AWS ALB, Nginx) for accurate client IP resolution
app.set('trust proxy', 1);

// Security Headers Middleware
app.use(securityHeaders);

// Parse comma-separated or single CLIENT_URL values for flexible cross-origin support
// Normalizes trailing slashes to match browser Origin headers exactly
// Wildcard origins ('*') are strictly prohibited when credentials: true is enabled per CORS security specification
const allowedOrigins = CLIENT_URL
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter((origin) => origin && origin !== '*');

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server requests, health probes, or curl where origin header is absent
    if (!origin) {
      return callback(null, true);
    }
    const normalizedOrigin = origin.trim().replace(/\/+$/, '');
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
};

// Standard Middleware with explicit body size limits and inflation disabled (prevents payload memory exhaustion DoS)
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb', inflate: false }));
app.use(express.urlencoded({ extended: true, limit: '1mb', inflate: false }));

// General API Rate Limiting (500 req / 15m)
app.use('/api', apiRateLimiter);

// Bounded IP Rate Limiters for Sensitive Endpoints
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/register', authRateLimiter);
app.use('/api/public/queue/display', publicDisplayRateLimiter);

// API Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/specialties', specialtyRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/staff/queue', staffQueueRoutes);
app.use('/api/staff/reconciliation', reconciliationRoutes);
app.use('/api/patient/queue', patientQueueRoutes);
app.use('/api/patient/notifications', patientNotificationRoutes);
app.use('/api/public/queue', publicQueueRoutes);
app.use('/api', ratingRoutes);
app.use('/api', billingRoutes);
app.use('/api', analyticsRoutes);
app.use('/api', intelligenceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/appointments', appointmentRoutes);

// Error Handling Middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Start server function with Graceful Shutdown & Observability
export const startServer = async () => {
  // Validate runtime environment configuration before opening network listener
  validateEnvironment();

  const server = app.listen(PORT, () => {
    const routeCount = app._router?.stack?.filter((r) => r.route || r.name === 'router')?.length || 0;
    console.log(`QFlow Express Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    console.log(`Operational Security Active: Rate Limiting & Security Headers Enabled | Route Handlers: ${routeCount}`);
  });

  connectDB().catch((error) => {
    console.error('Failed to connect to MongoDB on server startup:', error.message);
  });

  // Graceful Shutdown Sequence for SIGTERM & SIGINT
  let isShuttingDown = false;
  const gracefulShutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\nReceived ${signal}. Initiating graceful shutdown...`);

    // Safety timeout to prevent hanging shutdown
    const forceExitTimer = setTimeout(() => {
      console.error('Graceful shutdown timed out (10s limit). Forcing process exit.');
      process.exit(1);
    }, 10000);
    if (forceExitTimer.unref) forceExitTimer.unref();

    try {
      // 1. Close HTTP server and drain connections
      await new Promise((resolve) => {
        server.close((err) => {
          if (err) {
            console.error('Error closing HTTP server:', err.message);
          } else {
            console.log('HTTP server closed. Active sockets drained.');
          }
          resolve();
        });
      });

      // 2. Disconnect Mongoose / MongoDB connection
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close(false);
        console.log('MongoDB connection disconnected cleanly.');
      }

      console.log('Graceful shutdown completed successfully.');
      clearTimeout(forceExitTimer);
      process.exit(0);
    } catch (err) {
      console.error('Error encountered during graceful shutdown:', err.message);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return server;
};

// Auto-run when started directly (skip auto-listen during automated testing)
if (process.env.NODE_ENV !== 'test' && !process.env.IS_TEST_RUNNER) {
  startServer();
}

export default app;
