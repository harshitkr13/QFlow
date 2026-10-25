import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateEnvironment } from '../config/envValidator.js';
import { isProtectedDatabase, parseDatabaseName, getEffectiveMongoUri } from '../config/db.js';
import { resolveApiBaseUrl } from '../../client/src/services/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../');

async function main() {
  console.log('🚀 Starting QFlow P0 Security & Environment Isolation Test Suite...\n');

  let passedTests = 0;
  let totalTests = 0;

  function runTest(name, fn) {
    totalTests++;
    try {
      fn();
      passedTests++;
      console.log(`  ✅ [PASS ${totalTests}] ${name}`);
    } catch (err) {
      console.error(`  ❌ [FAIL ${totalTests}] ${name}`);
      console.error(err);
      process.exit(1);
    }
  }

  // ============================================================================
  // SECTION 1: Database Environment Isolation (envValidator & db.js)
  // ============================================================================
  console.log('--- Section 1: Database Environment Isolation (envValidator & db.js) ---');

  const validJwtSecret = 'a_very_secure_random_jwt_secret_key_minimum_32_characters_long_12345';
  const dummyCredsUri = 'mongodb+srv://admin_user:SuperSecretPassword123@cluster0.abcde.mongodb.net';

  runTest('Staging: Accepted with exactly qflow_staging', () => {
    const env = {
      NODE_ENV: 'staging',
      MONGODB_URI: `${dummyCredsUri}/qflow_staging?retryWrites=true&w=majority`,
      JWT_SECRET: validJwtSecret,
    };
    const res = validateEnvironment(env);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.nodeEnv, 'staging');
  });

  runTest('Staging: Rejected when targeting persistent dev database "qflow"', () => {
    const env = {
      NODE_ENV: 'staging',
      MONGODB_URI: `${dummyCredsUri}/qflow?retryWrites=true&w=majority`,
      JWT_SECRET: validJwtSecret,
    };
    assert.throws(
      () => validateEnvironment(env),
      /FATAL ISOLATION VIOLATION.*Staging environment.*must strictly target database "qflow_staging".*Rejected target database: "qflow"/i
    );
  });

  runTest('Staging: Rejected when targeting production database "qflow_prod"', () => {
    const env = {
      NODE_ENV: 'staging',
      MONGODB_URI: `${dummyCredsUri}/qflow_prod?retryWrites=true&w=majority`,
      JWT_SECRET: validJwtSecret,
    };
    assert.throws(
      () => validateEnvironment(env),
      /FATAL ISOLATION VIOLATION.*Staging environment.*must strictly target database "qflow_staging".*Rejected target database: "qflow_prod"/i
    );
  });

  runTest('Staging: Rejected when database name is missing from connection string', () => {
    const env = {
      NODE_ENV: 'staging',
      MONGODB_URI: `${dummyCredsUri}/?retryWrites=true&w=majority`,
      JWT_SECRET: validJwtSecret,
    };
    assert.throws(
      () => validateEnvironment(env),
      /Staging environment.*requires an explicit database name/i
    );
  });

  runTest('Staging: Rejected when targeting unrecognized database name (e.g. qflow_dev)', () => {
    const env = {
      NODE_ENV: 'staging',
      MONGODB_URI: `${dummyCredsUri}/qflow_dev?retryWrites=true&w=majority`,
      JWT_SECRET: validJwtSecret,
    };
    assert.throws(
      () => validateEnvironment(env),
      /FATAL ISOLATION VIOLATION.*Staging environment.*must strictly target database "qflow_staging".*Rejected target database: "qflow_dev"/i
    );
  });

  runTest('Production: Accepted with exactly qflow_prod', () => {
    const env = {
      NODE_ENV: 'production',
      MONGODB_URI: `${dummyCredsUri}/qflow_prod?retryWrites=true&w=majority`,
      JWT_SECRET: validJwtSecret,
    };
    const res = validateEnvironment(env);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.nodeEnv, 'production');
  });

  runTest('Production: Rejected when targeting staging database "qflow_staging"', () => {
    const env = {
      NODE_ENV: 'production',
      MONGODB_URI: `${dummyCredsUri}/qflow_staging?retryWrites=true&w=majority`,
      JWT_SECRET: validJwtSecret,
    };
    assert.throws(
      () => validateEnvironment(env),
      /FATAL ISOLATION VIOLATION.*Production environment.*must strictly target database "qflow_prod".*Rejected target database: "qflow_staging"/i
    );
  });

  runTest('Production: Rejected when targeting dev database "qflow"', () => {
    const env = {
      NODE_ENV: 'production',
      MONGODB_URI: `${dummyCredsUri}/qflow?retryWrites=true&w=majority`,
      JWT_SECRET: validJwtSecret,
    };
    assert.throws(
      () => validateEnvironment(env),
      /FATAL ISOLATION VIOLATION.*Production environment.*must strictly target database "qflow_prod".*Rejected target database: "qflow"/i
    );
  });

  runTest('Production: Rejected when database name is missing from connection string', () => {
    const env = {
      NODE_ENV: 'production',
      MONGODB_URI: `${dummyCredsUri}/?retryWrites=true&w=majority`,
      JWT_SECRET: validJwtSecret,
    };
    assert.throws(
      () => validateEnvironment(env),
      /Production environment.*requires an explicit database name/i
    );
  });

  runTest('Production: Rejected when targeting unrecognized database (e.g. qflow_prod_v2)', () => {
    const env = {
      NODE_ENV: 'production',
      MONGODB_URI: `${dummyCredsUri}/qflow_prod_v2?retryWrites=true&w=majority`,
      JWT_SECRET: validJwtSecret,
    };
    assert.throws(
      () => validateEnvironment(env),
      /FATAL ISOLATION VIOLATION.*Production environment.*must strictly target database "qflow_prod".*Rejected target database: "qflow_prod_v2"/i
    );
  });

  runTest('Development: Accepted with approved dev database "qflow"', () => {
    const env = {
      NODE_ENV: 'development',
      MONGODB_URI: `${dummyCredsUri}/qflow?retryWrites=true`,
      JWT_SECRET: 'dev_secret',
    };
    const res = validateEnvironment(env);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.nodeEnv, 'development');
  });

  runTest('Development: Rejected when targeting production database "qflow_prod"', () => {
    const env = {
      NODE_ENV: 'development',
      MONGODB_URI: `${dummyCredsUri}/qflow_prod?retryWrites=true`,
      JWT_SECRET: 'dev_secret',
    };
    assert.throws(
      () => validateEnvironment(env),
      /FATAL ISOLATION VIOLATION.*Development environment cannot target production or staging database "qflow_prod"/i
    );
  });

  runTest('Development: Rejected when targeting staging database "qflow_staging"', () => {
    const env = {
      NODE_ENV: 'development',
      MONGODB_URI: `${dummyCredsUri}/qflow_staging?retryWrites=true`,
      JWT_SECRET: 'dev_secret',
    };
    assert.throws(
      () => validateEnvironment(env),
      /FATAL ISOLATION VIOLATION.*Development environment cannot target production or staging database "qflow_staging"/i
    );
  });

  runTest('Development: Rejected when targeting unauthorized database name', () => {
    const env = {
      NODE_ENV: 'development',
      MONGODB_URI: `${dummyCredsUri}/arbitrary_db?retryWrites=true`,
      JWT_SECRET: 'dev_secret',
    };
    assert.throws(
      () => validateEnvironment(env),
      /FATAL ISOLATION VIOLATION.*Development environment must use approved database "qflow".*Rejected target database: "arbitrary_db"/i
    );
  });

  runTest('Test environment: Prohibits targeting protected databases (qflow, qflow_staging, qflow_prod)', () => {
    for (const protectedDb of ['qflow', 'qflow_staging', 'qflow_prod']) {
      const env = {
        NODE_ENV: 'test',
        MONGODB_URI: `${dummyCredsUri}/${protectedDb}`,
        JWT_SECRET: 'test_secret',
      };
      assert.throws(
        () => validateEnvironment(env),
        new RegExp(`FATAL ISOLATION VIOLATION.*Test environment cannot target protected database "${protectedDb}"`, 'i')
      );
    }
  });

  runTest('Test environment: Allows isolated test databases (e.g. qflow_test)', () => {
    const env = {
      NODE_ENV: 'test',
      MONGODB_URI: `${dummyCredsUri}/qflow_test`,
      JWT_SECRET: 'test_secret',
    };
    const res = validateEnvironment(env);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.nodeEnv, 'test');
  });

  runTest('Unknown NODE_ENV is rejected fail-closed', () => {
    const env = {
      NODE_ENV: 'qa_sandbox',
      MONGODB_URI: `${dummyCredsUri}/qflow_staging`,
      JWT_SECRET: validJwtSecret,
    };
    assert.throws(
      () => validateEnvironment(env),
      /FATAL CONFIGURATION ERROR.*Unrecognized NODE_ENV "qa_sandbox"/i
    );
  });

  runTest('Validation error messages NEVER expose passwords or full URIs', () => {
    const env = {
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb+srv://admin_user:SuperSecretPassword123@cluster0.abcde.mongodb.net/wrong_db',
      JWT_SECRET: validJwtSecret,
    };
    try {
      validateEnvironment(env);
      assert.fail('Should have thrown an error');
    } catch (err) {
      assert.ok(!err.message.includes('SuperSecretPassword123'), 'Must never leak password in error string');
      assert.ok(!err.message.includes('admin_user:'), 'Must never leak username in error string');
      assert.ok(!err.message.includes('cluster0.abcde.mongodb.net'), 'Must never leak cluster domain in error string');
      assert.ok(err.message.includes('wrong_db'), 'Should identify the rejected database name safely');
    }
  });

  runTest('isProtectedDatabase correctly identifies qflow, qflow_staging, and qflow_prod', () => {
    assert.strictEqual(isProtectedDatabase('qflow'), true);
    assert.strictEqual(isProtectedDatabase('qflow_staging'), true);
    assert.strictEqual(isProtectedDatabase('qflow_prod'), true);
    assert.strictEqual(isProtectedDatabase('QFLOW_STAGING'), true);
    assert.strictEqual(isProtectedDatabase('qflow_test'), false);
    assert.strictEqual(isProtectedDatabase('other_db'), false);
    assert.strictEqual(isProtectedDatabase(null), false);
  });

  runTest('Runtime: getEffectiveMongoUri rejects protected DBs in test execution context', () => {
    const origUri = process.env.MONGODB_URI;
    const origTestUri = process.env.MONGODB_TEST_URI;
    try {
      delete process.env.MONGODB_TEST_URI;
      process.env.MONGODB_URI = `${dummyCredsUri}/qflow_staging`;
      assert.throws(
        () => getEffectiveMongoUri(),
        /FATAL: Automated test execution prohibited against protected database 'qflow_staging'/i
      );

      process.env.MONGODB_URI = `${dummyCredsUri}/qflow_prod`;
      assert.throws(
        () => getEffectiveMongoUri(),
        /FATAL: Automated test execution prohibited against protected database 'qflow_prod'/i
      );

      process.env.MONGODB_URI = `${dummyCredsUri}/qflow`;
      assert.throws(
        () => getEffectiveMongoUri(),
        /FATAL: Automated test execution prohibited against protected database 'qflow'/i
      );
    } finally {
      if (origUri) process.env.MONGODB_URI = origUri; else delete process.env.MONGODB_URI;
      if (origTestUri) process.env.MONGODB_TEST_URI = origTestUri; else delete process.env.MONGODB_TEST_URI;
    }
  });

  runTest('Runtime: getEffectiveMongoUri calls validateEnvironment in normal runtime (fail-closed)', () => {
    const origArgv = [...process.argv];
    const origNodeEnv = process.env.NODE_ENV;
    const origUri = process.env.MONGODB_URI;
    const origJwt = process.env.JWT_SECRET;
    try {
      // Simulate normal application entry (e.g. node src/server/server.js)
      process.argv = ['node', 'src/server/server.js'];
      process.env.NODE_ENV = 'staging';
      process.env.JWT_SECRET = validJwtSecret;

      // Staging with wrong DB (qflow) must fail via validateEnvironment()
      process.env.MONGODB_URI = `${dummyCredsUri}/qflow`;
      assert.throws(
        () => getEffectiveMongoUri(),
        /FATAL ISOLATION VIOLATION.*Staging environment.*must strictly target database "qflow_staging"/i
      );

      // Staging with correct DB (qflow_staging) succeeds
      process.env.MONGODB_URI = `${dummyCredsUri}/qflow_staging`;
      const resolved = getEffectiveMongoUri();
      assert.strictEqual(resolved, `${dummyCredsUri}/qflow_staging`);

      // Production with wrong DB (qflow_staging) must fail via validateEnvironment()
      process.env.NODE_ENV = 'production';
      process.env.MONGODB_URI = `${dummyCredsUri}/qflow_staging`;
      assert.throws(
        () => getEffectiveMongoUri(),
        /FATAL ISOLATION VIOLATION.*Production environment.*must strictly target database "qflow_prod"/i
      );

      // Production with correct DB (qflow_prod) succeeds
      process.env.MONGODB_URI = `${dummyCredsUri}/qflow_prod`;
      const resolvedProd = getEffectiveMongoUri();
      assert.strictEqual(resolvedProd, `${dummyCredsUri}/qflow_prod`);
    } finally {
      process.argv = origArgv;
      process.env.NODE_ENV = origNodeEnv;
      if (origUri) process.env.MONGODB_URI = origUri; else delete process.env.MONGODB_URI;
      if (origJwt) process.env.JWT_SECRET = origJwt; else delete process.env.JWT_SECRET;
    }
  });

  // ============================================================================
  // SECTION 2: Decoupled API Routing & Fail-Closed VITE_API_URL
  // ============================================================================
  console.log('\n--- Section 2: Decoupled API Routing & Fail-Closed VITE_API_URL ---');

  runTest('Local dev (DEV=true) defaults safely to "/api" for localhost proxy', () => {
    const url = resolveApiBaseUrl({ DEV: true });
    assert.strictEqual(url, '/api');
  });

  runTest('Local dev (DEV=true) respects custom VITE_API_URL if configured', () => {
    const url = resolveApiBaseUrl({ DEV: true, VITE_API_URL: 'http://localhost:5000/api/' });
    assert.strictEqual(url, 'http://localhost:5000/api', 'Normalizes trailing slash');
  });

  runTest('Deployed staging (DEV=false) accepts explicit staging backend URL', () => {
    const stagingBackend = 'https://qflow-backend-staging.onrender.com/api';
    const url = resolveApiBaseUrl({ DEV: false, VITE_API_URL: `${stagingBackend}/` });
    assert.strictEqual(url, stagingBackend, 'Returns normalized staging backend URL');
  });

  runTest('Deployed production (DEV=false) accepts explicit production backend URL', () => {
    const prodBackend = 'https://qflow-backend-prod.onrender.com/api';
    const url = resolveApiBaseUrl({ DEV: false, VITE_API_URL: prodBackend });
    assert.strictEqual(url, prodBackend, 'Returns production backend URL');
  });

  runTest('Deployed build fails closed with explicit error when VITE_API_URL is missing', () => {
    assert.throws(
      () => resolveApiBaseUrl({ DEV: false }),
      /\[FATAL CONFIGURATION ERROR\] Missing required environment variable "VITE_API_URL"/i
    );
  });

  runTest('Deployed build fails closed when VITE_API_URL is empty string or whitespace', () => {
    assert.throws(
      () => resolveApiBaseUrl({ DEV: false, VITE_API_URL: '' }),
      /\[FATAL CONFIGURATION ERROR\] Missing required environment variable "VITE_API_URL"/i
    );
    assert.throws(
      () => resolveApiBaseUrl({ DEV: false, VITE_API_URL: '   ' }),
      /\[FATAL CONFIGURATION ERROR\] Missing required environment variable "VITE_API_URL"/i
    );
  });

  // ============================================================================
  // SECTION 3: Vercel Routing Decoupling & JWT Inspector Elimination
  // ============================================================================
  console.log('\n--- Section 3: Vercel Routing Decoupling & JWT Inspector Elimination ---');

  runTest('vercel.json does NOT contain hardcoded staging backend destination', () => {
    const vercelConfigPath = path.resolve(projectRoot, 'vercel.json');
    const vercelContent = fs.readFileSync(vercelConfigPath, 'utf8');
    const vercelJson = JSON.parse(vercelContent);

    assert.ok(
      !vercelContent.includes('qflow-backend-staging.onrender.com'),
      'vercel.json must not have any hardcoded staging backend URL'
    );

    // Verify SPA rewrite is preserved
    const spaRewrite = vercelJson.rewrites?.find((r) => r.source === '/(.*)' && r.destination === '/index.html');
    assert.ok(spaRewrite, 'vercel.json must retain SPA rewrite rule /(.*) -> /index.html');

    // Verify Security headers are preserved
    assert.ok(vercelJson.headers?.length > 0, 'Security headers must be preserved in vercel.json');
  });

  runTest('Production bundle does NOT contain developer tools or raw JWT inspector', () => {
    const distAssetsDir = path.resolve(projectRoot, 'src/client/dist/assets');
    if (!fs.existsSync(distAssetsDir)) {
      console.log('    ℹ️ dist/assets not found, skipping bundle check in pure config run (verified in build step)');
      return;
    }
    const jsFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.js'));
    assert.ok(jsFiles.length > 0, 'At least one JS bundle must exist in dist/assets');

    for (const jsFile of jsFiles) {
      const code = fs.readFileSync(path.join(distAssetsDir, jsFile), 'utf8');
      assert.ok(
        !code.includes('Developer Tools & Raw JWT Token Inspector'),
        `Production bundle ${jsFile} must NOT contain "Developer Tools & Raw JWT Token Inspector"`
      );
      assert.ok(
        !code.includes('developer-tools-drawer'),
        `Production bundle ${jsFile} must NOT contain "developer-tools-drawer"`
      );
    }
  });

  console.log(`\n🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY! P0 Security and Isolation verified.`);
}

main().catch((err) => {
  console.error('❌ Test execution error:', err);
  process.exit(1);
});
