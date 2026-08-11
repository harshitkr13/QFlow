import mongoose from 'mongoose';
import dns from 'dns';

// Configure DNS resolution for MongoDB Atlas SRV queries on environments where default system DNS rejects querySrv
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore if custom DNS setting is unsupported
}

/**
 * Connect to MongoDB directly using process.env.MONGODB_URI.
 */
export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('FATAL ERROR: MONGODB_URI is not defined in environment variables.');
    throw new Error('MONGODB_URI is not defined in environment configuration.');
  }

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
