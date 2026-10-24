/**
 * Environment Configuration Validator for QFlow Production Hardening (Phase 7).
 * Ensures critical environment variables and security constraints are satisfied
 * before server initialization and port binding.
 */

import { parseDatabaseName } from './db.js';

const KNOWN_INSECURE_SECRETS = new Set([
  'your_secure_random_jwt_secret_key_minimum_32_characters',
  'secret',
  'jwt_secret',
  'changeme',
  'password',
  '123456',
  'admin',
  'development',
  'test',
]);

/**
 * Validate that all necessary runtime environment variables are present and meet security standards.
 * Supports development, test, staging, and production environments.
 * @param {Object} env - Environment object (defaults to process.env)
 * @throws {Error} if any critical validation check fails
 */
export const validateEnvironment = (env = process.env) => {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProdOrStaging = nodeEnv === 'production' || nodeEnv === 'staging';
  const errors = [];

  // 1. JWT Secret Validation
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret || typeof jwtSecret !== 'string' || jwtSecret.trim() === '') {
    errors.push('JWT_SECRET is missing or empty in environment configuration.');
  } else if (isProdOrStaging) {
    const trimmedSecret = jwtSecret.trim();
    if (trimmedSecret.length < 32) {
      errors.push(
        `JWT_SECRET is too short for ${nodeEnv} (${trimmedSecret.length} chars). Minimum required is 32 characters.`
      );
    }
    if (KNOWN_INSECURE_SECRETS.has(trimmedSecret.toLowerCase())) {
      errors.push(`JWT_SECRET is configured with a known default/insecure placeholder value in ${nodeEnv}.`);
    }
  }

  // 2. MongoDB URI & Database Isolation Validation
  const mongoUri = env.MONGODB_URI;
  if (isProdOrStaging) {
    if (!mongoUri || typeof mongoUri !== 'string' || mongoUri.trim() === '') {
      errors.push(`MONGODB_URI is required in ${nodeEnv} environment.`);
    } else if (!/^mongodb(?:\+srv)?:\/\//i.test(mongoUri.trim())) {
      errors.push('MONGODB_URI must be a valid MongoDB connection string starting with mongodb:// or mongodb+srv://.');
    } else {
      const dbName = parseDatabaseName(mongoUri.trim());
      if (nodeEnv === 'staging') {
        if (!dbName) {
          errors.push('Staging MONGODB_URI must explicitly specify a database name (e.g. qflow_staging).');
        } else if (dbName.toLowerCase() === 'qflow') {
          errors.push(
            'FATAL ISOLATION VIOLATION: Staging environment cannot target the persistent development database "qflow". ' +
            'Please configure a dedicated staging database (e.g. qflow_staging).'
          );
        }
      }
    }
  }

  // 3. Port Validation
  if (env.PORT) {
    const portNum = Number(env.PORT);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      errors.push(`PORT must be a valid integer between 1 and 65535. Received: ${env.PORT}`);
    }
  }

  if (errors.length > 0) {
    const errorMessage = `[FATAL] ${nodeEnv.toUpperCase()} Environment Validation Failed:\n  - ${errors.join('\n  - ')}`;
    throw new Error(errorMessage);
  }

  return {
    valid: true,
    nodeEnv,
    hasMongoUri: Boolean(mongoUri),
    jwtSecretLength: jwtSecret ? jwtSecret.length : 0,
  };
};
