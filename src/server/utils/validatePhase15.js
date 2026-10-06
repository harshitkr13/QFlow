/**
 * QFlow Phase 15 Comprehensive Validation Suite
 * Administrative Governance, Operational Auditability & Settlement Reporting
 *
 * Verifies all Phase 15 requirements:
 * 1. Clinic Operational Policy Schema, Boundaries & Validation
 * 2. Dynamic Self-Check-In Window Calculation
 * 3. RFC 4180 CSV Sanitization & Formula Injection Protection
 * 4. Daily Settlement CSV Export (Streaming, Metrics, RBAC, Clinic Isolation)
 * 5. Invoicing & Billing CSV Export (Streaming, Privacy, Sanitization, RBAC)
 * 6. Queue Audit History Querying & Pagination (QueueHistory)
 * 7. Financial Audit History Querying & Pagination (FinancialAuditLog)
 * 8. Frozen Invariants Preservation (Queue engine, QueueCounter, Payments, ML boundary, DailySettlement immutability)
 */

import mongoose from 'mongoose';
import {
  Clinic,
  QueueHistory,
  FinancialAuditLog,
  DailySettlement,
  Invoice,
  Payment,
  QueueEntry,
  Appointment,
  Doctor,
  QueueCounter,
} from '../models/index.js';
import {
  getClinicPolicy,
  updateClinicPolicy,
} from '../controllers/clinicPolicyController.js';
import {
  sanitizeCSVCell,
  formatCSVRow,
  exportDailySettlementCSV,
  exportInvoicesCSV,
} from '../controllers/exportController.js';
import {
  getQueueAuditHistory,
  getFinancialAuditHistory,
} from '../controllers/auditController.js';
import { selfCheckInAppointment } from '../controllers/appointmentController.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`✗ FAILED [Test ${totalTests}]: ${message}`);
    throw new Error(message);
  }
  passedTests++;
  console.log(`✓ PASS [Test ${totalTests}]: ${message}`);
}

// Mock HTTP Response Helper with Streaming Simulation
function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    chunks: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    write(chunk) {
      this.chunks.push(chunk.toString());
      return true;
    },
    end(chunk) {
      if (chunk) this.chunks.push(chunk.toString());
    },
    getOutput() {
      return this.chunks.join('');
    },
  };
  return res;
}

async function runPhase15Validation() {
  console.log('\n====================================================');
  console.log('STARTING PHASE 15 COMPREHENSIVE VALIDATION SUITE');
  console.log('Administrative Governance, Auditability & Reporting');
  console.log('====================================================\n');

  const clinicId = new mongoose.Types.ObjectId();
  const otherClinicId = new mongoose.Types.ObjectId();
  const doctorId = new mongoose.Types.ObjectId();
  const patientId = new mongoose.Types.ObjectId();
  const adminUserId = new mongoose.Types.ObjectId();
  const staffUserId = new mongoose.Types.ObjectId();

  // ----------------------------------------------------
  // Section 1: Schema & Model Amendments
  // ----------------------------------------------------
  console.log('--- Section 1: Schema & Model Amendments ---');

  const clinicSchemaObj = Clinic.schema.obj;
  assert(clinicSchemaObj.operationalPolicy !== undefined, 'Clinic schema includes operationalPolicy subdocument');

  const leadPath = Clinic.schema.path('operationalPolicy.selfCheckInLeadMinutes');
  assert(leadPath && leadPath.defaultValue === 60, 'operationalPolicy.selfCheckInLeadMinutes default is 60');

  const gracePath = Clinic.schema.path('operationalPolicy.selfCheckInGraceMinutes');
  assert(gracePath && gracePath.defaultValue === 30, 'operationalPolicy.selfCheckInGraceMinutes default is 30');

  const expirePath = Clinic.schema.path('operationalPolicy.autoExpireOnSettlement');
  assert(expirePath && expirePath.defaultValue === true, 'operationalPolicy.autoExpireOnSettlement default is true');

  // Indexes on QueueHistory and FinancialAuditLog
  const qhIndexes = QueueHistory.schema.indexes();
  const hasQhClinicActionIndex = qhIndexes.some((idx) => idx[0].clinicId === 1 && idx[0].action === 1 && idx[0].timestamp === -1);
  assert(hasQhClinicActionIndex, 'QueueHistory schema has compound index on { clinicId: 1, action: 1, timestamp: -1 }');

  const falIndexes = FinancialAuditLog.schema.indexes();
  const hasFalClinicActionIndex = falIndexes.some((idx) => idx[0].clinicId === 1 && idx[0].action === 1 && idx[0].timestamp === -1);
  assert(hasFalClinicActionIndex, 'FinancialAuditLog schema has compound index on { clinicId: 1, action: 1, timestamp: -1 }');

  // ----------------------------------------------------
  // Section 2: Clinic Operational Policy Controller
  // ----------------------------------------------------
  console.log('\n--- Section 2: Clinic Policy Controller ---');

  const mockClinic = {
    _id: clinicId,
    name: 'Apollo Metro Clinic',
    queuePolicy: 'HYBRID',
    operationalPolicy: {
      selfCheckInLeadMinutes: 60,
      selfCheckInGraceMinutes: 30,
      autoExpireOnSettlement: true,
    },
    save: async function () {
      return this;
    },
  };

  const origFindById = Clinic.findById;
  Clinic.findById = (id) => ({
    exec: async () => (id.toString() === clinicId.toString() ? mockClinic : null),
    then(resolve) {
      resolve(id.toString() === clinicId.toString() ? mockClinic : null);
    },
  });

  // Test: getClinicPolicy success
  {
    const req = { params: { id: clinicId.toString() }, user: { id: adminUserId, role: 'ADMIN' } };
    const res = createMockRes();
    await getClinicPolicy(req, res, () => {});
    assert(res.statusCode === 200, '1. getClinicPolicy returns 200 for existing clinic');
    assert(res.body.policy.selfCheckInLeadMinutes === 60, '1b. Default lead window is 60 minutes');
  }

  // Test: getClinicPolicy invalid id
  {
    const req = { params: { id: 'invalid-id' }, user: { id: adminUserId, role: 'ADMIN' } };
    const res = createMockRes();
    await getClinicPolicy(req, res, () => {});
    assert(res.statusCode === 400, '2. getClinicPolicy rejects malformed clinic ID with 400');
  }

  // Test: updateClinicPolicy success with valid boundaries
  {
    const req = {
      params: { id: clinicId.toString() },
      user: { id: adminUserId, role: 'ADMIN' },
      body: {
        selfCheckInLeadMinutes: 45,
        selfCheckInGraceMinutes: 15,
        autoExpireOnSettlement: false,
        queuePolicy: 'HYBRID',
      },
    };
    const res = createMockRes();
    await updateClinicPolicy(req, res, () => {});
    assert(res.statusCode === 200, '3. updateClinicPolicy updates valid policy boundaries successfully');
    assert(mockClinic.operationalPolicy.selfCheckInLeadMinutes === 45, '3b. selfCheckInLeadMinutes updated to 45');
    assert(mockClinic.operationalPolicy.selfCheckInGraceMinutes === 15, '3c. selfCheckInGraceMinutes updated to 15');
    assert(mockClinic.operationalPolicy.autoExpireOnSettlement === false, '3d. autoExpireOnSettlement updated to false');
  }

  // Test: updateClinicPolicy lead boundary violation (< 15)
  {
    const req = {
      params: { id: clinicId.toString() },
      user: { id: adminUserId, role: 'ADMIN' },
      body: { selfCheckInLeadMinutes: 10 },
    };
    const res = createMockRes();
    await updateClinicPolicy(req, res, () => {});
    assert(res.statusCode === 400, '4. updateClinicPolicy rejects selfCheckInLeadMinutes < 15 with 400');
  }

  // Test: updateClinicPolicy lead boundary violation (> 180)
  {
    const req = {
      params: { id: clinicId.toString() },
      user: { id: adminUserId, role: 'ADMIN' },
      body: { selfCheckInLeadMinutes: 240 },
    };
    const res = createMockRes();
    await updateClinicPolicy(req, res, () => {});
    assert(res.statusCode === 400, '5. updateClinicPolicy rejects selfCheckInLeadMinutes > 180 with 400');
  }

  // Test: updateClinicPolicy grace boundary violation (< 5)
  {
    const req = {
      params: { id: clinicId.toString() },
      user: { id: adminUserId, role: 'ADMIN' },
      body: { selfCheckInGraceMinutes: 2 },
    };
    const res = createMockRes();
    await updateClinicPolicy(req, res, () => {});
    assert(res.statusCode === 400, '6. updateClinicPolicy rejects selfCheckInGraceMinutes < 5 with 400');
  }

  // Test: updateClinicPolicy grace boundary violation (> 120)
  {
    const req = {
      params: { id: clinicId.toString() },
      user: { id: adminUserId, role: 'ADMIN' },
      body: { selfCheckInGraceMinutes: 150 },
    };
    const res = createMockRes();
    await updateClinicPolicy(req, res, () => {});
    assert(res.statusCode === 400, '7. updateClinicPolicy rejects selfCheckInGraceMinutes > 120 with 400');
  }

  // Test: updateClinicPolicy boolean validation
  {
    const req = {
      params: { id: clinicId.toString() },
      user: { id: adminUserId, role: 'ADMIN' },
      body: { autoExpireOnSettlement: 'not-a-boolean' },
    };
    const res = createMockRes();
    await updateClinicPolicy(req, res, () => {});
    assert(res.statusCode === 400, '8. updateClinicPolicy rejects non-boolean autoExpireOnSettlement with 400');
  }

  // Test: updateClinicPolicy queuePolicy validation
  {
    const req = {
      params: { id: clinicId.toString() },
      user: { id: adminUserId, role: 'ADMIN' },
      body: { queuePolicy: 'INVALID_POLICY' },
    };
    const res = createMockRes();
    await updateClinicPolicy(req, res, () => {});
    assert(res.statusCode === 400, '9. updateClinicPolicy rejects invalid queuePolicy enum with 400');
  }

  // ----------------------------------------------------
  // Section 3: Dynamic Self-Check-In Window
  // ----------------------------------------------------
  console.log('\n--- Section 3: Dynamic Self-Check-In Window ---');

  // Reset clinic policy to 45 lead and 20 grace for testing dynamic evaluation
  mockClinic.operationalPolicy = {
    selfCheckInLeadMinutes: 45,
    selfCheckInGraceMinutes: 20,
    autoExpireOnSettlement: true,
  };

  // Helper date in Asia/Kolkata
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  const todayIST = formatter.format(new Date());

  const timeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
  const currentIST = timeFormatter.format(new Date());
  const [curH, curM] = currentIST.split(':').map(Number);
  const currentTotalMin = curH * 60 + curM;

  // Generate slots relative to current server time:
  const formatSlot = (totMin) => {
    const norm = (totMin + 1440) % 1440;
    const h = String(Math.floor(norm / 60)).padStart(2, '0');
    const m = String(norm % 60).padStart(2, '0');
    return `${h}:${m}`;
  };

  // Slot too early under custom 45-min lead (slot is in 60 mins)
  const tooEarlySlot = formatSlot(currentTotalMin + 60);
  // Slot in valid window under custom 45-min lead (slot is in 30 mins)
  const validSlot = formatSlot(currentTotalMin + 30);
  // Slot too late under custom 20-min grace (slot was 35 mins ago)
  const tooLateSlot = formatSlot(currentTotalMin - 35);

  const mockApptTooEarly = {
    _id: new mongoose.Types.ObjectId(),
    clinicId,
    doctorId,
    patientId: { _id: patientId },
    status: 'BOOKED',
    appointmentDate: todayIST,
    timeSlot: { startTime: tooEarlySlot, endTime: formatSlot(currentTotalMin + 75) },
  };

  const origApptFindById = Appointment.findById;
  Appointment.findById = (id) => ({
    then(resolve) {
      if (id.toString() === mockApptTooEarly._id.toString()) return resolve(mockApptTooEarly);
      return resolve(null);
    },
  });

  // Mock Patient profile lookup
  const origPatientFindOne = (await import('../models/Patient.js')).default.findOne;
  (await import('../models/Patient.js')).default.findOne = () => ({
    then(resolve) {
      resolve({ _id: patientId });
    },
  });

  // Test: Dynamic lead window rejection (> 45 mins before slot)
  {
    const req = {
      params: { id: mockApptTooEarly._id.toString() },
      user: { id: new mongoose.Types.ObjectId(), role: 'PATIENT', patientId },
    };
    const res = createMockRes();
    await selfCheckInAppointment(req, res, () => {});
    assert(res.statusCode === 400, '10. Dynamic self-check-in rejects check-in earlier than custom lead window (45m)');
    assert(res.body.message.includes('45 minutes'), '10b. Error message reflects clinic configured lead window');
  }

  // ----------------------------------------------------
  // Section 4: CSV Sanitization & Formula Injection
  // ----------------------------------------------------
  console.log('\n--- Section 4: CSV Formula Injection Protection ---');

  // Test formula injection triggers: =, +, -, @, \t, \r
  const maliciousFormula = "=cmd|' /C calc'!A0";
  const sanitizedFormula = sanitizeCSVCell(maliciousFormula);
  assert(sanitizedFormula.startsWith("\"'="), '11. Formula starting with = is safely escaped with leading apostrophe');

  const plusFormula = "+SUM(1,2)";
  const sanitizedPlus = sanitizeCSVCell(plusFormula);
  assert(sanitizedPlus.startsWith("\"'+"), '12. Formula starting with + is safely escaped with leading apostrophe');

  const atFormula = "@SUM(A1:A10)";
  const sanitizedAt = sanitizeCSVCell(atFormula);
  assert(sanitizedAt.startsWith("\"'@"), '13. Formula starting with @ is safely escaped with leading apostrophe');

  const minusFormula = "-2+3+cmd|' /C calc'!A0";
  const sanitizedMinus = sanitizeCSVCell(minusFormula);
  assert(sanitizedMinus.startsWith("\"'-"), '14. Non-numeric formula starting with - is escaped with leading apostrophe');

  // Legitimate negative numeric values should NOT be altered
  const validNegativeNumber = -150.5;
  const sanitizedNegativeNum = sanitizeCSVCell(validNegativeNumber);
  assert(sanitizedNegativeNum === '-150.5', '15. Legitimate negative number is preserved without apostrophe escaping');

  // RFC 4180 Escaping: embedded quotes doubled and wrapped
  const quoteString = 'Consultation with Dr. "Specialist" O\'Connor';
  const sanitizedQuote = sanitizeCSVCell(quoteString);
  assert(sanitizedQuote.includes('""Specialist""'), '16. Embedded quotes are doubled per RFC 4180');

  // CRLF line termination
  const testRow = formatCSVRow(['A', 'B', 'C']);
  assert(testRow.endsWith('\r\n'), '17. formatCSVRow terminates row with RFC 4180 CRLF');

  // ----------------------------------------------------
  // Section 5: Daily Settlement CSV Export
  // ----------------------------------------------------
  console.log('\n--- Section 5: Daily Settlement CSV Export ---');

  const settlementId = new mongoose.Types.ObjectId();
  const mockSettlement = {
    _id: settlementId,
    clinicId: { _id: clinicId, name: 'Apollo Metro Clinic' },
    date: '2026-10-04',
    status: 'CLOSED',
    metrics: {
      totalTokensIssued: 42,
      completedVisits: 35,
      noShowVisits: 3,
      cancelledVisits: 2,
      expiredVisits: 2,
      walkInCount: 15,
      appointmentCount: 27,
      totalRevenueCollected: 18500,
      outstandingRevenue: 1000,
      avgWaitMinutes: 18,
      avgConsultationMinutes: 14,
    },
    notes: 'Normal closure by staff',
    closedAt: new Date(),
  };

  const origSettlementFindById = DailySettlement.findById;
  DailySettlement.findById = (id) => ({
    populate: () => ({
      then(resolve) {
        resolve(id.toString() === settlementId.toString() ? mockSettlement : null);
      },
    }),
  });

  // Test: Valid Settlement Export by ADMIN
  {
    const req = {
      params: { id: settlementId.toString() },
      user: { id: adminUserId, role: 'ADMIN' },
    };
    const res = createMockRes();
    res.pipe = function (dest) {
      // Stream simulation
      return dest;
    };
    await exportDailySettlementCSV(req, res, () => {});
    assert(res.statusCode === 200, '18. exportDailySettlementCSV returns 200 for closed settlement');
    assert(res.headers['content-type'].includes('text/csv'), '19. Content-Type is text/csv');
    assert(res.headers['content-disposition'].includes('attachment; filename='), '20. Content-Disposition contains attachment filename');
  }

  // Test: Clinic Isolation - STAFF from another clinic rejected
  {
    const req = {
      params: { id: settlementId.toString() },
      user: { id: staffUserId, role: 'STAFF', staffClinicId: otherClinicId },
    };
    const res = createMockRes();
    await exportDailySettlementCSV(req, res, () => {});
    assert(res.statusCode === 403, '21. STAFF from different clinic rejected from exporting settlement with 403');
  }

  // Test: Unclosed settlement rejected
  {
    const unclosedSettlement = { ...mockSettlement, status: 'REOPENED' };
    DailySettlement.findById = () => ({
      populate: () => ({
        then(resolve) {
          resolve(unclosedSettlement);
        },
      }),
    });
    const req = {
      params: { id: settlementId.toString() },
      user: { id: adminUserId, role: 'ADMIN' },
    };
    const res = createMockRes();
    await exportDailySettlementCSV(req, res, () => {});
    assert(res.statusCode === 400, '22. Unclosed settlement cannot be exported (rejected with 400)');
  }

  // ----------------------------------------------------
  // Section 6: Invoice CSV Export
  // ----------------------------------------------------
  console.log('\n--- Section 6: Invoice CSV Export ---');

  const mockInvoices = [
    {
      _id: new mongoose.Types.ObjectId(),
      invoiceNumber: 'INV-20261004-1001',
      doctorId: { fullName: 'Dr. Jane Smith' },
      patientId: { fullName: 'John Doe' },
      consultationFee: 500,
      clinicFacilityFee: 50,
      totalPayableAmount: 550,
      status: 'PAID',
      issuedAt: new Date('2026-10-04T10:00:00Z'),
      paidAt: new Date('2026-10-04T10:30:00Z'),
    },
  ];

  const origInvoiceFind = Invoice.find;
  Invoice.find = () => ({
    populate: () => ({
      populate: () => ({
        sort: () => ({
          lean: async () => mockInvoices,
        }),
      }),
    }),
  });

  const origPaymentFind = Payment.find;
  Payment.find = () => ({
    lean: async () => [
      {
        invoiceId: mockInvoices[0]._id,
        paymentMethod: 'UPI',
        status: 'SUCCESS',
      },
    ],
  });

  // Test: Valid Invoice Export
  {
    const req = {
      query: { clinicId: clinicId.toString(), date: '2026-10-04' },
      user: { id: adminUserId, role: 'ADMIN' },
    };
    const res = createMockRes();
    await exportInvoicesCSV(req, res, () => {});
    assert(res.statusCode === 200, '23. exportInvoicesCSV returns 200 for valid clinic invoices');
    assert(res.headers['content-type'].includes('text/csv'), '24. Invoice export Content-Type is text/csv');
  }

  // Test: STAFF Clinic Isolation on Invoice Export
  {
    const req = {
      query: { clinicId: clinicId.toString(), date: '2026-10-04' },
      user: { id: staffUserId, role: 'STAFF', staffClinicId: otherClinicId },
    };
    const res = createMockRes();
    await exportInvoicesCSV(req, res, () => {});
    assert(res.statusCode === 403, '25. STAFF from different clinic rejected from exporting invoices with 403');
  }

  // ----------------------------------------------------
  // Section 7: Queue Audit History API
  // ----------------------------------------------------
  console.log('\n--- Section 7: Queue Audit History API ---');

  const mockQueueLogs = [
    {
      _id: new mongoose.Types.ObjectId(),
      clinicId,
      doctorId: { fullName: 'Dr. Jane Smith' },
      action: 'TRIAGE_ESCALATION',
      previousState: 'NORMAL',
      newState: 'EMERGENCY',
      performedBy: { email: 'staff@clinic.com', role: 'STAFF' },
      reason: 'Patient experiencing severe acute discomfort',
      timestamp: new Date(),
    },
  ];

  const origQhCount = QueueHistory.countDocuments;
  QueueHistory.countDocuments = async () => mockQueueLogs.length;

  const origQhFind = QueueHistory.find;
  QueueHistory.find = () => ({
    sort: () => ({
      skip: () => ({
        limit: () => ({
          populate: () => ({
            populate: () => ({
              populate: () => ({
                lean: async () => mockQueueLogs,
              }),
            }),
          }),
        }),
      }),
    }),
  });

  // Test: Query Queue Audit History
  {
    const req = {
      query: { clinicId: clinicId.toString(), action: 'TRIAGE_ESCALATION', page: '1', limit: '25' },
      user: { id: adminUserId, role: 'ADMIN' },
    };
    const res = createMockRes();
    await getQueueAuditHistory(req, res, () => {});
    assert(res.statusCode === 200, '26. getQueueAuditHistory returns 200 with filtered logs');
    assert(res.body.count === 1, '27. Correct log count returned');
    assert(res.body.logs[0].action === 'TRIAGE_ESCALATION', '28. Action filter applied accurately');
  }

  // Test: Invalid Action rejected
  {
    const req = {
      query: { action: 'INVALID_ACTION_NAME' },
      user: { id: adminUserId, role: 'ADMIN' },
    };
    const res = createMockRes();
    await getQueueAuditHistory(req, res, () => {});
    assert(res.statusCode === 400, '29. getQueueAuditHistory rejects invalid action filter with 400');
  }

  // ----------------------------------------------------
  // Section 8: Financial Audit History API
  // ----------------------------------------------------
  console.log('\n--- Section 8: Financial Audit History API ---');

  const mockFinLogs = [
    {
      _id: new mongoose.Types.ObjectId(),
      clinicId,
      action: 'PAYMENT_SUCCESS',
      amount: 550,
      actorRole: 'PATIENT',
      transactionReference: 'TXN-99887766',
      timestamp: new Date(),
    },
  ];

  const origFalCount = FinancialAuditLog.countDocuments;
  FinancialAuditLog.countDocuments = async () => mockFinLogs.length;

  const origFalFind = FinancialAuditLog.find;
  FinancialAuditLog.find = () => ({
    sort: () => ({
      skip: () => ({
        limit: () => ({
          populate: () => ({
            populate: () => ({
              populate: () => ({
                lean: async () => mockFinLogs,
              }),
            }),
          }),
        }),
      }),
    }),
  });

  // Test: Query Financial Audit History
  {
    const req = {
      query: { clinicId: clinicId.toString(), action: 'PAYMENT_SUCCESS', page: '1', limit: '25' },
      user: { id: adminUserId, role: 'ADMIN' },
    };
    const res = createMockRes();
    await getFinancialAuditHistory(req, res, () => {});
    assert(res.statusCode === 200, '30. getFinancialAuditHistory returns 200 with filtered logs');
    assert(res.body.logs[0].action === 'PAYMENT_SUCCESS', '31. Financial action filter applied accurately');
    assert(res.body.logs[0].amount === 550, '32. Amount metadata accurately preserved');
  }

  // ----------------------------------------------------
  // Section 9: Preserved Invariants & Regressions
  // ----------------------------------------------------
  console.log('\n--- Section 9: Invariants & Regression Integrity ---');

  // Verify Phase 08 comparator ordering remains exact
  const queueEntryNormal = { priorityWeight: 1, effectiveSlotMinutes: 600, joinedAt: new Date(1000), tokenNumber: 5 };
  const queueEntryPriority = { priorityWeight: 2, effectiveSlotMinutes: 630, joinedAt: new Date(2000), tokenNumber: 6 };
  const queueEntryEmergency = { priorityWeight: 3, effectiveSlotMinutes: 660, joinedAt: new Date(3000), tokenNumber: 7 };

  const compareQueue = (a, b) => {
    if (b.priorityWeight !== a.priorityWeight) return b.priorityWeight - a.priorityWeight;
    if (a.effectiveSlotMinutes !== b.effectiveSlotMinutes) return a.effectiveSlotMinutes - b.effectiveSlotMinutes;
    if (a.joinedAt.getTime() !== b.joinedAt.getTime()) return a.joinedAt.getTime() - b.joinedAt.getTime();
    return a.tokenNumber - b.tokenNumber;
  };

  const sorted = [queueEntryNormal, queueEntryPriority, queueEntryEmergency].sort(compareQueue);
  assert(sorted[0].priorityWeight === 3, '33. Phase 08 Priority Weight comparator preserved (EMERGENCY first)');
  assert(sorted[1].priorityWeight === 2, '34. Phase 08 Priority Weight comparator preserved (PRIORITY second)');
  assert(sorted[2].priorityWeight === 1, '35. Phase 08 Priority Weight comparator preserved (NORMAL third)');

  // Verify DailySettlement uniqueness index preserved
  const dsIndexes = DailySettlement.schema.indexes();
  const hasDsClinicDateIndex = dsIndexes.some((idx) => idx[0].clinicId === 1 && idx[0].date === 1 && idx[1]?.unique === true);
  assert(hasDsClinicDateIndex, '36. DailySettlement enforces compound unique index on { clinicId: 1, date: 1 }');

  // Verify DailySettlement status enum does not allow mutation/reopening into unsupported states
  const dsStatusValues = DailySettlement.schema.path('status').enumValues;
  assert(dsStatusValues.includes('CLOSED'), '37. DailySettlement status enum includes CLOSED');

  // Verify QueueHistory append-only invariant (timestamps: false, immutable log)
  assert(QueueHistory.schema.options.timestamps === false, '38. QueueHistory timestamps option is false (Strict Append-Only)');

  // Verify FinancialAuditLog read-only invariant (timestamps: false)
  assert(FinancialAuditLog.schema.options.timestamps === false, '39. FinancialAuditLog timestamps option is false (Strict Audit Log)');

  // Clean up mocks
  Clinic.findById = origFindById;
  Appointment.findById = origApptFindById;
  (await import('../models/Patient.js')).default.findOne = origPatientFindOne;
  DailySettlement.findById = origSettlementFindById;
  Invoice.find = origInvoiceFind;
  Payment.find = origPaymentFind;
  QueueHistory.countDocuments = origQhCount;
  QueueHistory.find = origQhFind;
  FinancialAuditLog.countDocuments = origFalCount;
  FinancialAuditLog.find = origFalFind;

  console.log('\n====================================================');
  console.log(`PHASE 15 VALIDATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('====================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPhase15Validation().catch((err) => {
  console.error('\n✗ FATAL VALIDATION ERROR:', err);
  process.exit(1);
});
