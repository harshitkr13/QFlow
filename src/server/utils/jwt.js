import jwt from 'jsonwebtoken';

/**
 * Generate a signed JWT token containing minimal user identity.
 * @param {Object} payload - Token payload containing userId and role.
 * @returns {String} Signed JWT token string (24h expiration).
 */
export const generateToken = (payload) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured in environment variables.');
  }

  return jwt.sign(
    {
      id: payload.id || payload._id,
      role: payload.role,
    },
    secret,
    {
      expiresIn: '24h',
    }
  );
};

/**
 * Verify a JWT token signature and return decoded payload.
 * @param {String} token - JWT token string.
 * @returns {Object} Decoded payload.
 */
export const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured in environment variables.');
  }

  return jwt.verify(token, secret);
};
