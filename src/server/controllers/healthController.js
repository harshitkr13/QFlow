import { getDBStatus } from '../config/db.js';

/**
 * GET /api/health
 * Returns server operational status and database connection state.
 */
export const getHealthStatus = (req, res) => {
  const dbStatus = getDBStatus();
  const isConnected = dbStatus === 'connected';

  return res.status(isConnected ? 200 : 503).json({
    success: true,
    message: 'QFlow API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: dbStatus,
  });
};
