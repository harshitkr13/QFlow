import mongoose from 'mongoose';
import dns from 'dns';

// Configure DNS resolution for MongoDB Atlas SRV queries on environments where default system DNS rejects querySrv
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore if custom DNS setting is unsupported
}

/**
 * Safely parse the database name from a MongoDB connection URI without exposing credentials.
 * @param {string} uri - MongoDB connection URI
 * @returns {string|null} Database name or null
 */
export const parseDatabaseName = (uri) => {
  if (!uri || typeof uri !== 'string') return null;
  try {
    const url = new URL(uri);
    const pathname = url.pathname ? url.pathname.replace(/^\//, '').split('/')[0] : '';
    return pathname.split('?')[0].trim() || null;
  } catch (e) {
    const match = uri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/i);
    return match ? match[1].trim() : null;
  }
};

/**
 * Check whether a database name corresponds to the protected production/development database.
 * @param {string} dbName
 * @returns {boolean}
 */
export const isProtectedDatabase = (dbName) => {
  if (!dbName || typeof dbName !== 'string') return false;
  const protectedNames = ['qflow', 'qflow_staging', 'qflow_prod'];
  return protectedNames.includes(dbName.trim().toLowerCase());
};

/**
 * Detect whether the current process is executing within an automated test or validation suite.
 * @returns {boolean}
 */
export const isTestExecutionContext = () => {
  if (process.env.NODE_ENV === 'test') return true;
  if (process.env.IS_TEST_RUNNER === 'true') return true;
  if (process.argv && process.argv.length > 1) {
    return process.argv.some((arg) =>
      /\.test\.[mc]?js|validate[A-Za-z0-9_]*\.js|runAllValidations\.js/i.test(arg)
    );
  }
  return false;
};

/**
 * Resolve the target MongoDB connection URI based on execution context and isolation rules.
 * Never silently redirects or alters explicitly supplied database URIs.
 * Never allows tests to silently run against the protected production/development database.
 * @returns {string} Safe connection URI
 */
export const getEffectiveMongoUri = () => {
  const isTest = isTestExecutionContext();

  if (isTest) {
    // 1. Check for explicit MONGODB_TEST_URI
    if (process.env.MONGODB_TEST_URI) {
      const testDbName = parseDatabaseName(process.env.MONGODB_TEST_URI);
      if (!testDbName) {
        throw new Error(
          'FATAL: MONGODB_TEST_URI is defined but does not specify a database name. ' +
          'An explicit test database name is required (e.g., mongodb://localhost:27017/qflow_test).'
        );
      }
      if (isProtectedDatabase(testDbName)) {
        throw new Error(
          `FATAL: Unsafe test configuration. MONGODB_TEST_URI cannot target the protected database '${testDbName}'. ` +
          'Automated tests must run against an isolated test database.'
        );
      }
      return process.env.MONGODB_TEST_URI;
    }

    // 2. If MONGODB_TEST_URI is not provided, inspect candidate MONGODB_URI to prevent pollution of protected DB
    const candidateUri = process.env.MONGODB_URI;
    const dbName = parseDatabaseName(candidateUri);

    if (!candidateUri || isProtectedDatabase(dbName)) {
      throw new Error(
        `FATAL: Automated test execution prohibited against protected database '${dbName || 'qflow'}'. ` +
        'Automated tests cannot run against the persistent development or production database. ' +
        'Please execute tests via "npm test" (in-memory replica set) or configure a dedicated test database via MONGODB_TEST_URI.'
      );
    }

    return candidateUri;
  }

  // Production / Development application runtime
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('FATAL ERROR: MONGODB_URI is not defined in environment variables.');
    throw new Error('MONGODB_URI is not defined in environment configuration.');
  }

  return uri;
};

/**
 * Connect to MongoDB safely enforcing test-database isolation.
 */
export const connectDB = async () => {
  const uri = getEffectiveMongoUri();

  try {
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Failure: ${error.message}`);
    throw error;
  }
};

/**
 * Get human-readable MongoDB connection state.
 * @returns {'connected' | 'disconnected' | 'connecting' | 'disconnecting' | 'unknown'}
 */
export const getDBStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  const stateCode = mongoose.connection.readyState;
  return states[stateCode] || 'unknown';
};
