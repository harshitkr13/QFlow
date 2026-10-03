/**
 * Lightweight Security & Rate Limiting Middleware for QFlow (Phase 13).
 * Provides HTTP security headers and bounded in-memory IP rate limiting
 * without external infrastructure or heavy package dependencies.
 */

/**
 * Security Headers Middleware.
 * Protects against clickjacking, MIME sniffing, and cross-site scripting.
 */
export const securityHeaders = (req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Apply Strict-Transport-Security only in production to protect plain HTTP localhost in development
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};

/**
 * Factory for Bounded In-Memory IP Rate Limiter.
 * Uses a sliding time window with automatic memory pruning.
 */
export const createRateLimiter = ({
  windowMs = 15 * 60 * 1000,
  maxRequests = 100,
  message = 'Too many requests from this IP. Please try again later.'
} = {}) => {
  const ipStore = new Map();

  // Periodic pruning of expired entries every 5 minutes to ensure bounded memory
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of ipStore.entries()) {
      if (now > record.resetTime) {
        ipStore.delete(ip);
      }
    }
  }, 5 * 60 * 1000);

  // Allow Node process to exit without waiting for the cleanup interval
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req, res, next) => {
    // Determine client IP (handles x-forwarded-for or connection remoteAddress)
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || '127.0.0.1';
    const now = Date.now();

    let record = ipStore.get(clientIp);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      ipStore.set(clientIp, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > maxRequests) {
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        success: false,
        message,
        retryAfterSeconds: retryAfterSec
      });
    }

    next();
  };
};

// Sensitive Auth Endpoints Rate Limiter: 30 requests per 15-minute window
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
  message: 'Too many authentication attempts. Please wait 15 minutes before trying again.'
});

// Anonymous Public Display Polling Rate Limiter: 120 requests per 1-minute window
export const publicDisplayRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 120,
  message: 'Public display polling rate exceeded. Please throttle requests.'
});
