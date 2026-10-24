/**
 * 404 Handler for non-existent API routes.
 */
export const notFoundHandler = (req, res, next) => {
  const error = new Error(`Resource Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * Global Error Handling Middleware.
 * Catches unhandled errors, formats Mongoose/MongoDB error exceptions,
 * and masks sensitive internal database traces in production.
 */
export const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  let message = err.message || 'Internal Server Error';

  // Handle Mongoose CastError (invalid ObjectId format)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid identifier format: ${err.value}`;
  }

  // Handle Mongoose Schema ValidationError
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors || {})
      .map((e) => e.message)
      .join(', ') || 'Validation failed';
  }

  // Handle MongoDB Duplicate Key Conflict (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    const fields = Object.keys(err.keyValue || {}).join(', ');
    message = `Duplicate field value entered: ${fields || 'unique constraint'}`;
  }

  // In production/staging, mask unhandled 500 server error details to prevent internal information leakage
  if ((process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') && statusCode === 500) {
    console.error(`[INTERNAL_SERVER_ERROR] [${req.method || 'UNKNOWN'} ${req.originalUrl || ''}]:`, err);
    message = 'Internal Server Error';
  }

  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
