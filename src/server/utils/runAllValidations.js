import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import * as models from '../models/index.js';
import { parseDatabaseName, isProtectedDatabase } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../');

const validationSuites = [
  { name: 'Phase 03 — Authentication & RBAC', script: 'src/server/utils/validateAuth.js' },
  { name: 'Phase 04 — Clinic & Doctor Management', script: 'src/server/utils/validatePhase04.js' },
  { name: 'Phase 05 — Patient Discovery & Search', script: 'src/server/utils/validatePhase05.js' },
  { name: 'Phase 06 — Appointment Booking', script: 'src/server/utils/validatePhase06.js' },
  { name: 'Phase 06 — Schema Partial Index Integrity', script: 'src/server/utils/validatePhase06Schema.js' },
  { name: 'Phase 07 — Walk-In & Queue Token Allocation', script: 'src/server/utils/validatePhase07.js' },
  { name: 'Phase 08 — Core HYBRID Queue Engine', script: 'src/server/utils/validatePhase08.js' },
  { name: 'Phase 09 — Patient Live Queue Experience', script: 'src/server/utils/validatePhase09.js' },
  { name: 'Phase 10 — Public Display & Ratings', script: 'src/server/utils/validatePhase10.js' },
  { name: 'Phase 11 — Invoicing, Billing & Analytics', script: 'src/server/utils/validatePhase11.js' },
  { name: 'Phase 12 — Queue Intelligence & ML', script: 'src/server/utils/validatePhase12.js' },
  { name: 'Phase 13 — Production Hardening & Observability', script: 'src/server/utils/validatePhase13.js' },
  { name: 'Phase 14 — Operational Resilience & Day-End Settlement', script: 'src/server/utils/validatePhase14.js' },
  { name: 'Phase 15 — Administrative Governance & Settlement Reporting', script: 'src/server/utils/validatePhase15.js' },
];

const maskMongoUri = (uri) => {
  try {
    const parsed = new URL(uri);
    if (parsed.password) {
      parsed.password = '****';
    }
    return parsed.toString();
  } catch (e) {
    return uri.replace(/:([^@]+)@/, ':****@');
  }
};

const runSuite = (scriptPath, env) => {
  return new Promise((resolve) => {
    const child = spawn('node', [scriptPath], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true,
      env,
    });
    child.on('close', (code) => {
      resolve(code ?? 0);
    });
    child.on('error', (err) => {
      console.error(`[Orchestrator] Failed to start suite process ${scriptPath}:`, err);
      resolve(1);
    });
  });
};

const runAllValidations = async () => {
  console.log('====================================================');
  console.log('QFLOW MASTER REGRESSION TEST ORCHESTRATOR');
  console.log('Executing Phases 03 through 15 Validation Suites');
  console.log('====================================================\n');

  let replSet = null;
  let targetMongoUri = null;

  if (process.env.MONGODB_TEST_URI) {
    const testDbName = parseDatabaseName(process.env.MONGODB_TEST_URI);
    if (!testDbName) {
      console.error('[Test Environment] FATAL: MONGODB_TEST_URI does not specify an explicit database name.');
      process.exit(1);
    }
    if (isProtectedDatabase(testDbName)) {
      console.error(`[Test Environment] FATAL: MONGODB_TEST_URI cannot target protected database '${testDbName}'.`);
      process.exit(1);
    }
    targetMongoUri = process.env.MONGODB_TEST_URI;
    console.log(`[Test Environment] Using explicit dedicated test database via MONGODB_TEST_URI (Database: ${testDbName}): ${maskMongoUri(targetMongoUri)}`);
  } else {
    console.log('[Test Environment] No MONGODB_TEST_URI provided in process environment.');
    console.log('[Test Environment] Starting ephemeral in-memory MongoDB replica set (WiredTiger)...');
    try {
      replSet = await MongoMemoryReplSet.create({
        replSet: {
          count: 1,
          storageEngine: 'wiredTiger',
        },
      });
      const rawUri = replSet.getUri('qflow_test');
      targetMongoUri = rawUri.includes('?') ? `${rawUri}&directConnection=true` : `${rawUri}?directConnection=true`;
      console.log('[Test Environment] In-memory replica set online (Isolated test database: qflow_test)');
    } catch (err) {
      console.error('[Test Environment] Failed to initialize in-memory replica set:', err);
      process.exit(1);
    }
  }

  // Pre-synchronize indexes on models to guarantee unique constraints and 2dsphere indexes
  console.log('[Test Environment] Synchronizing database collection indexes...');
  try {
    await mongoose.connect(targetMongoUri);
    for (const model of Object.values(models)) {
      if (model && typeof model.syncIndexes === 'function') {
        await model.syncIndexes();
      }
    }
    await mongoose.disconnect();
    console.log('[Test Environment] Database collection indexes synchronized successfully.');
  } catch (syncErr) {
    console.warn('[Test Environment] Notice: Index synchronization encountered issue (proceeding):', syncErr.message);
    try {
      await mongoose.disconnect();
    } catch (e) {}
  }

  // Ensure deterministic test JWT_SECRET if none was provided
  const testJwtSecret = process.env.JWT_SECRET || 'ci_test_secret_for_qflow_phase_16_continuous_integration';

  // Environment passed to child validation scripts - strictly isolated from persistent database
  const childEnv = {
    ...process.env,
    MONGODB_URI: targetMongoUri,
    MONGODB_TEST_URI: targetMongoUri,
    NODE_ENV: 'test',
    IS_TEST_RUNNER: 'true',
    JWT_SECRET: testJwtSecret,
  };

  const results = [];
  let allPassed = true;

  try {
    for (const suite of validationSuites) {
      console.log(`\n----------------------------------------------------`);
      console.log(`RUNNING: ${suite.name}`);
      console.log(`Script:  ${suite.script}`);
      console.log(`----------------------------------------------------`);

      const startTime = Date.now();
      const exitCode = await runSuite(suite.script, childEnv);
      const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

      const passed = exitCode === 0;
      if (!passed) {
        allPassed = false;
      }

      results.push({
        name: suite.name,
        passed,
        exitCode,
        durationSec,
      });

      console.log(`--> ${suite.name}: ${passed ? 'PASSED' : 'FAILED'} (${durationSec}s, Exit Code: ${exitCode})`);
    }
  } finally {
    if (replSet) {
      console.log('\n[Test Environment] Tearing down in-memory replica set...');
      await replSet.stop();
      console.log('[Test Environment] In-memory replica set stopped cleanly.');
    }
  }

  console.log('\n====================================================');
  console.log('MASTER REGRESSION TEST RESULTS SUMMARY');
  console.log('====================================================');

  results.forEach((r, idx) => {
    const statusStr = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${(idx + 1).toString().padStart(2, ' ')}. [${statusStr}] ${r.name.padEnd(46, ' ')} (${r.durationSec}s)`);
  });

  console.log('====================================================');

  if (allPassed) {
    console.log('✓ ALL VALIDATION SUITES PASSED (100% REGRESSION INTEGRITY VERIFIED)');
    process.exit(0);
  } else {
    console.error('✗ ONE OR MORE REGRESSION TEST SUITES FAILED. SEE LOGS ABOVE.');
    process.exit(1);
  }
};

runAllValidations().catch((err) => {
  console.error('Fatal unhandled orchestrator error:', err);
  process.exit(1);
});
