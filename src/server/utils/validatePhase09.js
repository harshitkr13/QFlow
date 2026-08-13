import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { connectDB } from '../config/db.js';
import { User, Clinic, Specialty, Doctor, Patient, Appointment, QueueCounter, QueueEntry, QueueHistory } from '../models/index.js';
import { getPatientLiveQueue } from '../controllers/appointmentController.js';
import { runAuthValidation } from './validateAuth.js';
import { runPhase04Validation } from './validatePhase04.js';
import { runPhase05Validation } from './validatePhase05.js';
import { runPhase06Validation } from './validatePhase06.js';
import { runPhase07Validation } from './validatePhase07.js';
import { runPhase08Tests } from './validatePhase08.js';

const getFormattedDateIST = (dateObj = new Date()) => {
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  return new Intl.DateTimeFormat('en-CA', options).format(dateObj);
};

export const runValidation = async () => {
  console.log('\n==================================================');
  console.log('STARTING PHASE 09 PATIENT LIVE QUEUE VALIDATION');
  console.log('==================================================\n');

  await connectDB();

  let testUserA = null;
  let testPatientA = null;
  let testUserB = null;
  let testPatientB = null;
  let testClinic = null;
  let testSpecialty = null;
  let testDoctor = null;
  let tokenA = null;
  let tokenB = null;

  let createdQueueEntries = [];
  let createdAppointments = [];
  let createdCounters = [];

  try {
    const todayIST = getFormattedDateIST();

    // Create Admin User
    const testAdminUser = await User.create({
      fullName: 'Phase 09 Admin',
      email: `p9admin_${Date.now()}@test.com`,
      password: 'Password123!',
      role: 'ADMIN',
      isActive: true,
    });

    // 1. Setup Test Entities
    testClinic = await Clinic.create({
      name: `P09 Test Clinic ${Date.now()}`,
      code: `P9-CLN-${Date.now()}`,
      address: { street: '123 Live St', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
      location: { type: 'Point', coordinates: [72.8777, 19.076] },
      phone: '9876543210',
      email: `p09clinic_${Date.now()}@qflow.com`,
      adminId: testAdminUser._id,
      isActive: true,
    });

    testSpecialty = await Specialty.create({
      name: `P09 Specialty ${Date.now()}`,
      code: `P09_${Date.now()}`,
    });

    const docUser = await User.create({
      fullName: `Dr P09 User ${Date.now()}`,
      email: `drp09_${Date.now()}@qflow.com`,
      password: 'Password123!',
      role: 'DOCTOR',
      isActive: true,
    });

    testDoctor = await Doctor.create({
      userId: docUser._id,
      clinicId: testClinic._id,
      specialtyId: testSpecialty._id,
      fullName: 'Dr. Phase09 Tester',
      gender: 'MALE',
      qualifications: ['MBBS', 'MD'],
      experienceYears: 10,
      consultationFee: 500,
      averageConsultationDurationMinutes: 15,
      operationalStatus: 'AVAILABLE',
      isQueuePaused: false,
    });

    // Patient A
    testUserA = await User.create({
      fullName: 'P09 Patient A',
      email: `p09patA_${Date.now()}@qflow.com`,
      password: 'Password123!',
      role: 'PATIENT',
      isActive: true,
    });

    testPatientA = await Patient.create({
      userId: testUserA._id,
      fullName: 'Patient Alpha',
      gender: 'MALE',
      dateOfBirth: new Date('1995-01-01'),
      phone: `999${Math.floor(1000000 + Math.random() * 9000000)}`,
    });

    tokenA = jwt.sign(
      { id: testUserA._id, role: 'PATIENT', patientId: testPatientA._id },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '1h' }
    );

    // Patient B
    testUserB = await User.create({
      fullName: 'P09 Patient B',
      email: `p09patB_${Date.now()}@qflow.com`,
      password: 'Password123!',
      role: 'PATIENT',
      isActive: true,
    });

    testPatientB = await Patient.create({
      userId: testUserB._id,
      fullName: 'Patient Beta',
      gender: 'FEMALE',
      dateOfBirth: new Date('1992-05-05'),
      phone: `999${Math.floor(1000000 + Math.random() * 9000000)}`,
    });

    tokenB = jwt.sign(
      { id: testUserB._id, role: 'PATIENT', patientId: testPatientB._id },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '1h' }
    );

    // Helper mock req/res
    const makeReq = (user, query = {}) => ({
      user,
      query,
    });

    const makeRes = () => {
      const res = {};
      res.statusCode = 200;
      res.status = function (code) {
        res.statusCode = code;
        return res;
      };
      res.json = function (payload) {
        res.body = payload;
        return res;
      };
      return res;
    };

    // ----------------------------------------------------
    // TEST 1: Patient with no queue entry
    // ----------------------------------------------------
    let req = makeReq({ _id: testUserA._id, id: testUserA._id, role: 'PATIENT' });
    let res = makeRes();
    await getPatientLiveQueue(req, res, (err) => { throw err; });

    if (!res.body.success || res.body.hasActiveEntry !== false) {
      throw new Error('Test 1 Failed: Patient with no queue entry should return hasActiveEntry: false');
    }
    console.log('✓ TEST 1 PASS: Patient with no queue entry handled gracefully');

    // ----------------------------------------------------
    // TEST 2: Patient A with active WAITING queue entry
    // ----------------------------------------------------
    const qeA = await QueueEntry.create({
      clinicId: testClinic._id,
      doctorId: testDoctor._id,
      patientId: testPatientA._id,
      queueDate: todayIST,
      tokenNumber: 10,
      source: 'ONLINE',
      priority: 'NORMAL',
      priorityWeight: 1,
      status: 'WAITING',
      effectiveSlotMinutes: 600,
      joinedAt: new Date(),
    });
    createdQueueEntries.push(qeA);

    req = makeReq({ _id: testUserA._id, id: testUserA._id, role: 'PATIENT' });
    res = makeRes();
    await getPatientLiveQueue(req, res, (err) => { throw err; });

    if (!res.body.success || !res.body.hasActiveEntry || res.body.queue.tokenNumber !== 10) {
      throw new Error('Test 2 Failed: Active WAITING queue entry snapshot invalid');
    }
    if (res.body.queue.queuePosition !== 1 || res.body.queue.peopleAhead !== 0) {
      throw new Error(`Test 2 Failed: Position expected 1/0, got ${res.body.queue.queuePosition}/${res.body.queue.peopleAhead}`);
    }
    console.log('✓ TEST 2 PASS: Active WAITING queue entry snapshot accurate');

    // ----------------------------------------------------
    // TEST 3: HYBRID Ordering & Queue Position Calculation
    // ----------------------------------------------------
    // Create Patient B entry with higher priority (URGENT) -> should be placed ahead of A
    const qeB = await QueueEntry.create({
      clinicId: testClinic._id,
      doctorId: testDoctor._id,
      patientId: testPatientB._id,
      queueDate: todayIST,
      tokenNumber: 11,
      source: 'WALK_IN',
      priority: 'URGENT',
      priorityWeight: 0,
      status: 'WAITING',
      effectiveSlotMinutes: 620,
      joinedAt: new Date(),
    });
    createdQueueEntries.push(qeB);

    // Patient B (URGENT) should be #1
    req = makeReq({ _id: testUserB._id, id: testUserB._id, role: 'PATIENT' });
    res = makeRes();
    await getPatientLiveQueue(req, res, (err) => { throw err; });

    if (res.body.queue.queuePosition !== 1 || res.body.queue.peopleAhead !== 0) {
      throw new Error(`Test 3 Failed: Patient B (URGENT) expected position 1, got ${res.body.queue.queuePosition}`);
    }

    // Patient A (NORMAL) should now be #2 with 1 person ahead
    req = makeReq({ _id: testUserA._id, id: testUserA._id, role: 'PATIENT' });
    res = makeRes();
    await getPatientLiveQueue(req, res, (err) => { throw err; });

    if (res.body.queue.queuePosition !== 2 || res.body.queue.peopleAhead !== 1) {
      throw new Error(`Test 3 Failed: Patient A expected position 2/ahead 1, got ${res.body.queue.queuePosition}/${res.body.queue.peopleAhead}`);
    }
    if (res.body.queue.estimatedWaitMinutes !== 15) {
      throw new Error(`Test 3 Failed: Expected 15m wait (1 ahead * 15m), got ${res.body.queue.estimatedWaitMinutes}`);
    }
    console.log('✓ TEST 3 PASS: HYBRID position & people ahead calculation accurate');

    // ----------------------------------------------------
    // TEST 4: Serving Token & CALLED state
    // ----------------------------------------------------
    qeB.status = 'CALLED';
    qeB.calledAt = new Date();
    await qeB.save();

    req = makeReq({ _id: testUserB._id, id: testUserB._id, role: 'PATIENT' });
    res = makeRes();
    await getPatientLiveQueue(req, res, (err) => { throw err; });

    if (res.body.queue.status !== 'CALLED' || res.body.queue.currentServingToken !== 11 || res.body.queue.servingState !== 'CALLED') {
      throw new Error('Test 4 Failed: Serving state or CALLED token incorrect');
    }
    if (res.body.queue.queuePosition !== 0 || res.body.queue.peopleAhead !== 0) {
      throw new Error('Test 4 Failed: CALLED patient position should be 0/0');
    }
    console.log('✓ TEST 4 PASS: CALLED status and serving token resolution accurate');

    // ----------------------------------------------------
    // TEST 5: IN_CONSULTATION state
    // ----------------------------------------------------
    qeB.status = 'IN_CONSULTATION';
    qeB.consultationStartedAt = new Date();
    await qeB.save();

    req = makeReq({ _id: testUserA._id, id: testUserA._id, role: 'PATIENT' });
    res = makeRes();
    await getPatientLiveQueue(req, res, (err) => { throw err; });

    if (res.body.queue.currentServingToken !== 11 || res.body.queue.servingState !== 'IN_CONSULTATION') {
      throw new Error('Test 5 Failed: Active IN_CONSULTATION serving token resolution failed');
    }
    console.log('✓ TEST 5 PASS: IN_CONSULTATION state & serving token accurate');

    // ----------------------------------------------------
    // TEST 6: Queue Pause State
    // ----------------------------------------------------
    testDoctor.isQueuePaused = true;
    testDoctor.queuePauseReason = 'Emergency surgery';
    testDoctor.queuePausedDate = todayIST;
    await testDoctor.save();

    req = makeReq({ _id: testUserA._id, id: testUserA._id, role: 'PATIENT' });
    res = makeRes();
    await getPatientLiveQueue(req, res, (err) => { throw err; });

    if (!res.body.queue.isQueuePaused || res.body.queue.queuePauseReason !== 'Emergency surgery') {
      throw new Error('Test 6 Failed: Queue pause state not reflected in live queue snapshot');
    }
    console.log('✓ TEST 6 PASS: Queue pause state correctly exposed to patient');

    // ----------------------------------------------------
    // TEST 7: Privacy Boundary Check (No Forbidden Fields)
    // ----------------------------------------------------
    const bodyStr = JSON.stringify(res.body);
    const forbiddenPatterns = [
      'Patient Beta',
      testPatientB.phone,
      'Password123!',
      'QueueHistory',
    ];
    for (const pattern of forbiddenPatterns) {
      if (bodyStr.includes(pattern)) {
        throw new Error(`Test 7 Failed: Forbidden data '${pattern}' leaked in patient response!`);
      }
    }
    console.log('✓ TEST 7 PASS: Privacy boundary strictly enforced (Zero cross-patient leakage)');

    // ----------------------------------------------------
    // TEST 8: Read-Only Invariant (No DB Modifications)
    // ----------------------------------------------------
    const entriesCountBefore = await QueueEntry.countDocuments();
    const historyCountBefore = await QueueHistory.countDocuments();
    const counterCountBefore = await QueueCounter.countDocuments();

    req = makeReq({ _id: testUserA._id, id: testUserA._id, role: 'PATIENT' });
    res = makeRes();
    await getPatientLiveQueue(req, res, (err) => { throw err; });

    const entriesCountAfter = await QueueEntry.countDocuments();
    const historyCountAfter = await QueueHistory.countDocuments();
    const counterCountAfter = await QueueCounter.countDocuments();

    if (entriesCountBefore !== entriesCountAfter || historyCountBefore !== historyCountAfter || counterCountBefore !== counterCountAfter) {
      throw new Error('Test 8 Failed: Live queue endpoint mutated database state!');
    }
    console.log('✓ TEST 8 PASS: Read-only invariant preserved (No state or history mutation)');

    // Reset Doctor pause
    testDoctor.isQueuePaused = false;
    await testDoctor.save();

    console.log('\n==================================================');
    console.log('PHASE 09 CORE TESTS 100% PASSED');
    console.log('==================================================\n');

    // ----------------------------------------------------
    // REGRESSION SUITE EXECUTION (Phases 03 - 08)
    // ----------------------------------------------------
    console.log('--- RUNNING PHASE 03 REGRESSION ---');
    await runAuthValidation();

    console.log('--- RUNNING PHASE 04 REGRESSION ---');
    await runPhase04Validation();

    console.log('--- RUNNING PHASE 05 REGRESSION ---');
    await runPhase05Validation();

    console.log('--- RUNNING PHASE 06 REGRESSION ---');
    await runPhase06Validation();

    console.log('--- RUNNING PHASE 07 REGRESSION ---');
    await runPhase07Validation();

    console.log('--- RUNNING PHASE 08 REGRESSION ---');
    await runPhase08Tests();

    console.log('\n==================================================');
    console.log('ALL PHASE 03–09 VALIDATION & REGRESSION SUITES PASSED');
    console.log('==================================================\n');
  } catch (error) {
    console.error('\n❌ PHASE 09 VALIDATION FAILED:', error.message);
    throw error;
  } finally {
    // Cleanup Phase 09 test data if DB connection is active
    if (mongoose.connection.readyState === 1) {
      for (const qe of createdQueueEntries) {
        await QueueEntry.deleteOne({ _id: qe._id }).catch(() => {});
      }
      for (const appt of createdAppointments) {
        await Appointment.deleteOne({ _id: appt._id }).catch(() => {});
      }
      for (const cnt of createdCounters) {
        await QueueCounter.deleteOne({ _id: cnt._id }).catch(() => {});
      }
      if (testPatientA) await Patient.deleteOne({ _id: testPatientA._id }).catch(() => {});
      if (testUserA) await User.deleteOne({ _id: testUserA._id }).catch(() => {});
      if (testPatientB) await Patient.deleteOne({ _id: testPatientB._id }).catch(() => {});
      if (testUserB) await User.deleteOne({ _id: testUserB._id }).catch(() => {});
      if (testDoctor) {
        await User.deleteOne({ _id: testDoctor.userId }).catch(() => {});
        await Doctor.deleteOne({ _id: testDoctor._id }).catch(() => {});
      }
      if (testClinic) await Clinic.deleteOne({ _id: testClinic._id }).catch(() => {});
      if (testSpecialty) await Specialty.deleteOne({ _id: testSpecialty._id }).catch(() => {});
    }
  }
};

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].includes('validatePhase09.js')) {
  runValidation()
    .then(() => {
      console.log('Phase 09 validation completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Phase 09 validation failed with error:', err);
      process.exit(1);
    });
}
