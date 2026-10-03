import { securityHeaders, createRateLimiter } from '../middleware/securityMiddleware.js';
import { getHealthStatus } from '../controllers/healthController.js';

async function runPhase13Validation() {
  console.log('\n==================================================');
  console.log('STARTING PHASE 13 SERVER HARDENING & READINESS SUITE');
  console.log('==================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (!condition) {
      console.error(`✗ FAILED: ${message}`);
      throw new Error(message);
    }
    passedTests++;
    console.log(`✓ PASS: ${message}`);
  }

  // --------------------------------------------------
  // TEST 1: Security Headers Verification
  // --------------------------------------------------
  const mockHeaders = {};
  const mockRes = {
    setHeader: (k, v) => { mockHeaders[k.toLowerCase()] = v; }
  };
  let nextCalled = false;
  securityHeaders({}, mockRes, () => { nextCalled = true; });

  assert(nextCalled, 'securityHeaders calls next()');
  assert(mockHeaders['x-frame-options'] === 'DENY', 'X-Frame-Options set to DENY');
  assert(mockHeaders['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options set to nosniff');
  assert(mockHeaders['x-xss-protection'] === '1; mode=block', 'X-XSS-Protection set to 1; mode=block');

  // --------------------------------------------------
  // TEST 2: Rate Limiter Middleware Verification
  // --------------------------------------------------
  const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 3 });
  const mockReq = { headers: {}, socket: { remoteAddress: '192.168.1.100' } };
  let lastStatus = 200;
  let lastBody = null;
  const testRes = {
    setHeader: () => {},
    status: (s) => { lastStatus = s; return testRes; },
    json: (b) => { lastBody = b; }
  };

  for (let i = 1; i <= 4; i++) {
    limiter(mockReq, testRes, () => {});
  }

  assert(lastStatus === 429, 'Rate limiter triggers HTTP 429 when maxRequests exceeded');
  assert(lastBody && lastBody.success === false, 'Rate limiter response contains success: false');
  assert(typeof lastBody.retryAfterSeconds === 'number', 'Rate limiter returns retryAfterSeconds');

  // --------------------------------------------------
  // TEST 3: Health Probe Controller Metrics
  // --------------------------------------------------
  let healthStatus = 0;
  let healthBody = null;
  const mockHealthRes = {
    status: (s) => { healthStatus = s; return mockHealthRes; },
    json: (b) => { healthBody = b; }
  };

  await getHealthStatus({}, mockHealthRes);

  assert(healthStatus === 200 || healthStatus === 503, 'Health probe returns valid HTTP status (200 or 503)');
  assert(healthBody && typeof healthBody.uptimeSeconds === 'number', 'Health probe includes uptimeSeconds');
  assert(healthBody && healthBody.memory && typeof healthBody.memory.rssMb === 'number', 'Health probe includes memory.rssMb');
  assert(healthBody && healthBody.database && typeof healthBody.database.status === 'string', 'Health probe includes database.status');

  console.log('\n==================================================');
  console.log(`PHASE 13 VALIDATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('==================================================\n');
}

runPhase13Validation().catch((err) => {
  console.error('Phase 13 Validation Failed:', err.message);
  process.exit(1);
});
