import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

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

console.log('====================================================');
console.log('QFLOW MASTER REGRESSION TEST ORCHESTRATOR');
console.log('Executing Phases 03 through 15 Validation Suites');
console.log('====================================================\n');

const results = [];
let allPassed = true;

for (const suite of validationSuites) {
  console.log(`\n----------------------------------------------------`);
  console.log(`RUNNING: ${suite.name}`);
  console.log(`Script:  ${suite.script}`);
  console.log(`----------------------------------------------------`);

  const startTime = Date.now();
  const proc = spawnSync('node', [suite.script], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true,
  });
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  const passed = proc.status === 0;
  if (!passed) {
    allPassed = false;
  }

  results.push({
    name: suite.name,
    passed,
    exitCode: proc.status,
    durationSec,
  });

  console.log(`--> ${suite.name}: ${passed ? 'PASSED' : 'FAILED'} (${durationSec}s, Exit Code: ${proc.status})`);
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
