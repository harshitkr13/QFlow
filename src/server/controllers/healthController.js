import mongoose from 'mongoose';
import { getDBStatus } from '../config/db.js';

/**
 * GET /api/health
 * Returns server operational status, database connection state, latency probe,
 * process uptime, and memory utilization metrics.
 */
export const getHealthStatus = async (req, res) => {
  const dbStatus = getDBStatus();
  const isConnected = dbStatus === 'connected';

  let dbLatencyMs = null;
  let isDbResponsive = false;

  if (isConnected && mongoose.connection.db) {
    try {
      const pingStart = Date.now();
      await Promise.race([
        mongoose.connection.db.admin().ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database ping timeout')), 2000)
        ),
      ]);
      dbLatencyMs = Date.now() - pingStart;
      isDbResponsive = true;
    } catch (err) {
      dbLatencyMs = null;
      isDbResponsive = false;
    }
  }

  const mem = process.memoryUsage();
  const memoryMetrics = {
    rssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
    heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
    heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
  };

  const isHealthy = isConnected && isDbResponsive;

  return res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    message: isHealthy ? 'QFlow API is healthy' : 'QFlow API is running with degraded database state',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatus,
      responsive: isDbResponsive,
      latencyMs: dbLatencyMs,
    },
    memory: memoryMetrics,
  });
};
