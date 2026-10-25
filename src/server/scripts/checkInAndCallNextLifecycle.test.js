import assert from 'assert';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import {
  Clinic,
  Doctor,
  DoctorSchedule,
  Specialty,
  User,
  Patient,
  Appointment,
  Staff,
  QueueEntry,
  QueueCounter,
  QueueHistory,
} from '../models/index.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { checkInAppointment } from '../controllers/appointmentController.js';
import {
  getTodayQueue,
  callNextPatient,
  startConsultation,
  completeConsultation,
  registerWalkIn,
} from '../controllers/staffQueueController.js';
import { generateToken } from '../utils/jwt.js';

process.env.JWT_SECRET = 'test-jwt-secret-qflow-checkin-callnext-lifecycle-99999';
process.env.NODE_ENV = 'development';

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    setHeader(key, val) {
      this.headers[key] = val;
    },
  };
  return res;
}

async function runWithAuth(req, res, handler, requiredRoles = ['STAFF', 'ADMIN']) {
  let halted = false;
  const origJson = res.json.bind(res);
  res.json = (data) => {
    halted = true;
    return origJson(data);
  };

  let protectNext = false;
  await protect(req, res, () => {
    protectNext = true;
  });

  if (halted || !protectNext) return;

  if (requiredRoles && requiredRoles.length > 0) {
    let authNext = false;
    const authMiddleware = authorize(...requiredRoles);
    authMiddleware(req, res, () => {
      authNext = true;
    });

    if (halted || !authNext) return;
  }

  await handler(req, res, (err) => {
    if (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
}

function getFormattedDateIST(dateObj = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(dateObj);
}

function getFormattedTimeIST(dateObj = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(dateObj);
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(totalMins) {
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function main() {
  console.log('🚀 Starting Check-In and Call-Next Queue State Lifecycle Regression Test...');

  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });

  const uri = replSet.getUri('qflow_test_checkin_lifecycle');
  await mongoose.connect(uri);
  console.log('✅ Connected to isolated MongoMemoryReplSet.');

  try {
    const todayIST = getFormattedDateIST();
    const currentTimeIST = getFormattedTimeIST();
    const currentMin = timeToMinutes(currentTimeIST);
    const slotStartMin = currentMin; // Exact current minute ensures within 60-min window
    const slotEndMin = slotStartMin + 15;
    const slotStartTime = minutesToTime(slotStartMin);
    const slotEndTime = minutesToTime(slotEndMin);

    // 1. Setup Core Fixtures
    const adminUser = await User.create({
      fullName: 'Super Administrator',
      email: 'admin.staging@qflow.test',
      phone: '9876500000',
      password: 'HashedPassword123!',
      role: 'ADMIN',
      isActive: true,
    });

    const clinic = await Clinic.create({
      name: 'Staging Demo Health Centre',
      code: 'STAGE-01',
      adminId: adminUser._id,
      address: {
        street: 'Plot 42, Sector 12',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      phone: '9876543210',
      email: 'clinic.staging@qflow.test',
      isActive: true,
      queuePolicy: 'HYBRID',
    });

    const specialty = await Specialty.create({
      name: 'General Medicine',
      code: 'GENMED',
      description: 'Primary medical care and general health consultations',
      isActive: true,
    });

    const doctorUser = await User.create({
      fullName: 'Dr. Staging Demo Doctor',
      email: 'doctor.staging@qflow.test',
      phone: '9876500001',
      password: 'HashedPassword123!',
      role: 'DOCTOR',
      isActive: true,
    });

    const doctor = await Doctor.create({
      userId: doctorUser._id,
      clinicId: clinic._id,
      specialtyId: specialty._id,
      fullName: 'Dr. Staging Demo Doctor',
      gender: 'MALE',
      consultationFee: 500,
      experienceYears: 10,
      qualifications: ['MBBS', 'MD'],
      averageConsultationDurationMinutes: 15,
      isAvailable: true,
      operationalStatus: 'AVAILABLE',
      isQueuePaused: false,
    });

    const staffUser = await User.create({
      fullName: 'Reception Desk Staff',
      email: 'staff.staging@qflow.test',
      phone: '9876500002',
      password: 'HashedPassword123!',
      role: 'STAFF',
      isActive: true,
    });

    const staff = await Staff.create({
      userId: staffUser._id,
      clinicId: clinic._id,
      fullName: 'Reception Desk Staff',
      phone: '9876500002',
      role: 'RECEPTIONIST',
      isActive: true,
    });

    const patientUser = await User.create({
      fullName: 'Test Patient One',
      email: 'patient1.staging@qflow.test',
      phone: '9876500003',
      password: 'HashedPassword123!',
      role: 'PATIENT',
      isActive: true,
    });

    const patient = await Patient.create({
      userId: patientUser._id,
      fullName: 'Test Patient One',
      phone: '9876500003',
      gender: 'MALE',
      dateOfBirth: new Date('1990-01-01'),
    });

    const staffToken = generateToken({ id: staffUser._id, role: 'STAFF' });
    const doctorToken = generateToken({ id: doctorUser._id, role: 'DOCTOR' });

    // 2. Create Booked Appointment for todayIST
    const appointment = await Appointment.create({
      patientId: patient._id,
      doctorId: doctor._id,
      clinicId: clinic._id,
      specialtyId: specialty._id,
      appointmentDate: todayIST,
      timeSlot: {
        startTime: slotStartTime,
        endTime: slotEndTime,
      },
      status: 'BOOKED',
      consultationFee: 500,
    });

    console.log(`✅ Fixtures created. Appointment booked for ${todayIST} at ${slotStartTime}-${slotEndTime}`);

    // Ensure all MongoDB collections and indexes are built before starting transaction
    await Promise.all([
      QueueEntry.init(),
      QueueCounter.init(),
      QueueHistory.init(),
      Appointment.init(),
    ]);

    // =========================================================================
    // STEP 1: Physical Check-In at Reception Desk
    // =========================================================================
    console.log('\n--- Step 1: Physical Check-In at Reception ---');
    const checkInReq = {
      user: { _id: staffUser._id, role: 'STAFF', staffClinicId: clinic._id },
      headers: { authorization: `Bearer ${staffToken}` },
      params: { id: appointment._id.toString() },
    };
    const checkInRes = createMockRes();
    await runWithAuth(checkInReq, checkInRes, checkInAppointment, ['STAFF', 'ADMIN']);

    assert.strictEqual(checkInRes.statusCode, 200, `Expected 200 from checkInAppointment, got ${checkInRes.statusCode}: ${JSON.stringify(checkInRes.body)}`);
    assert.strictEqual(checkInRes.body.success, true);
    assert.strictEqual(checkInRes.body.queueEntry.tokenNumber, 1);
    assert.strictEqual(checkInRes.body.queueEntry.status, 'WAITING');
    assert.strictEqual(checkInRes.body.queueEntry.source, 'ONLINE');
    assert.strictEqual(checkInRes.body.queueEntry.doctorId.toString(), doctor._id.toString());
    assert.strictEqual(checkInRes.body.queueEntry.priority, 'NORMAL');

    const updatedApptDb = await Appointment.findById(appointment._id);
    assert.strictEqual(updatedApptDb.status, 'CHECKED_IN');
    console.log('✅ Check-In succeeded: Appointment is CHECKED_IN, Queue Token #1 allocated with status WAITING.');

    // =========================================================================
    // STEP 2: Query Live Queue as Staff (Waiting State)
    // =========================================================================
    console.log('\n--- Step 2: Query Live Queue as Staff (Waiting State) ---');
    // Test 2A: Query without doctorId parameter
    const queueReqNoDoc = {
      user: { _id: staffUser._id, role: 'STAFF', staffClinicId: clinic._id },
      headers: { authorization: `Bearer ${staffToken}` },
      query: {},
    };
    const queueResNoDoc = createMockRes();
    await runWithAuth(queueReqNoDoc, queueResNoDoc, getTodayQueue, ['STAFF', 'ADMIN', 'DOCTOR']);

    assert.strictEqual(queueResNoDoc.statusCode, 200);
    assert.ok(Array.isArray(queueResNoDoc.body.queue), 'res.body.queue MUST be an array (for frontend contract)');
    assert.ok(Array.isArray(queueResNoDoc.body.queueEntries), 'res.body.queueEntries MUST be an array');
    assert.strictEqual(queueResNoDoc.body.queue.length, 1, 'queue array must have 1 entry');
    assert.strictEqual(queueResNoDoc.body.queueEntries.length, 1, 'queueEntries array must have 1 entry');
    assert.strictEqual(queueResNoDoc.body.waitingEntries.length, 1, 'waitingEntries must have 1 entry');
    assert.strictEqual(queueResNoDoc.body.activeEntries.length, 0, 'activeEntries must have 0 entries');
    assert.strictEqual(queueResNoDoc.body.queue[0].tokenNumber, 1);
    assert.strictEqual(queueResNoDoc.body.queue[0].status, 'WAITING');
    assert.strictEqual(queueResNoDoc.body.queue[0].patientId.fullName, 'Test Patient One');
    console.log('✅ getTodayQueue (no doctorId) returns queue: [ Token #1 (WAITING) ], waitingEntries: 1, activeEntries: 0.');

    // Test 2B: Query with doctorId parameter
    const queueReqWithDoc = {
      user: { _id: staffUser._id, role: 'STAFF', staffClinicId: clinic._id },
      headers: { authorization: `Bearer ${staffToken}` },
      query: { doctorId: doctor._id.toString() },
    };
    const queueResWithDoc = createMockRes();
    await runWithAuth(queueReqWithDoc, queueResWithDoc, getTodayQueue, ['STAFF', 'ADMIN', 'DOCTOR']);

    assert.strictEqual(queueResWithDoc.statusCode, 200);
    assert.strictEqual(queueResWithDoc.body.queue.length, 1);
    assert.strictEqual(queueResWithDoc.body.waitingEntries.length, 1);
    assert.ok(queueResWithDoc.body.doctorQueueStatus !== undefined, 'doctorQueueStatus must be defined');
    assert.ok(queueResWithDoc.body.doctorStatus !== undefined, 'doctorStatus must be defined');
    assert.strictEqual(queueResWithDoc.body.doctorStatus.isQueuePaused, false);
    console.log('✅ getTodayQueue (with doctorId) returns queue: 1, waitingEntries: 1, doctorStatus verified.');

    // =========================================================================
    // STEP 3: Call Next Patient (WAITING -> CALLED)
    // =========================================================================
    console.log('\n--- Step 3: Call Next Patient ---');
    const callNextReq = {
      user: { _id: staffUser._id, role: 'STAFF', staffClinicId: clinic._id },
      headers: { authorization: `Bearer ${staffToken}` },
      body: { doctorId: doctor._id.toString() },
    };
    const callNextRes = createMockRes();
    await runWithAuth(callNextReq, callNextRes, callNextPatient, ['STAFF', 'ADMIN', 'DOCTOR']);

    assert.strictEqual(callNextRes.statusCode, 200, `callNext failed: ${JSON.stringify(callNextRes.body)}`);
    assert.strictEqual(callNextRes.body.success, true);
    assert.strictEqual(callNextRes.body.queueEntry.tokenNumber, 1);
    assert.strictEqual(callNextRes.body.queueEntry.status, 'CALLED');
    console.log('✅ callNextPatient transitioned Token #1 to status CALLED.');

    // =========================================================================
    // STEP 4: Query Live Queue as Staff (Active Called State)
    // =========================================================================
    console.log('\n--- Step 4: Query Live Queue as Staff (After Call Next) ---');
    const queueResCalled = createMockRes();
    await runWithAuth(queueReqWithDoc, queueResCalled, getTodayQueue, ['STAFF', 'ADMIN', 'DOCTOR']);

    assert.strictEqual(queueResCalled.statusCode, 200);
    assert.strictEqual(queueResCalled.body.queue.length, 1, 'Total queue items must be 1');
    assert.strictEqual(queueResCalled.body.waitingEntries.length, 0, 'waitingEntries must now be 0');
    assert.strictEqual(queueResCalled.body.activeEntries.length, 1, 'activeEntries must now be 1');
    assert.strictEqual(queueResCalled.body.activeEntries[0].tokenNumber, 1);
    assert.strictEqual(queueResCalled.body.activeEntries[0].status, 'CALLED');

    // Simulate frontend metric cards derivation
    const queueData = queueResCalled.body.queue;
    const waitingCards = queueResCalled.body.waitingEntries.length;
    const activeCards = queueResCalled.body.activeEntries.length;
    const totalToday = queueData.length;

    assert.strictEqual(waitingCards, 0, 'Frontend KPI Waiting: 0');
    assert.strictEqual(activeCards, 1, 'Frontend KPI Serving / Called: 1');
    assert.strictEqual(totalToday, 1, 'Frontend KPI Total Today: 1');
    console.log(`✅ Live Queue KPI metrics verified: Waiting = ${waitingCards}, Serving/Called = ${activeCards}, Total Today = ${totalToday}. Bug is verified fixed!`);

    // =========================================================================
    // STEP 5: Doctor Cockpit Flow (getTodayQueue as DOCTOR)
    // =========================================================================
    console.log('\n--- Step 5: Doctor Cockpit Flow (getTodayQueue as DOCTOR) ---');
    const docQueueReq = {
      user: { _id: doctorUser._id, role: 'DOCTOR' },
      headers: { authorization: `Bearer ${doctorToken}` },
      query: {},
    };
    const docQueueRes = createMockRes();
    await runWithAuth(docQueueReq, docQueueRes, getTodayQueue, ['STAFF', 'ADMIN', 'DOCTOR']);

    assert.strictEqual(docQueueRes.statusCode, 200);
    assert.strictEqual(docQueueRes.body.queue.length, 1);
    assert.strictEqual(docQueueRes.body.activeEntries.length, 1);
    assert.strictEqual(docQueueRes.body.activeEntries[0].tokenNumber, 1);
    assert.strictEqual(docQueueRes.body.activeEntries[0].status, 'CALLED');

    // Test Doctor Cockpit frontend filter:
    const myDoctorId = doctor._id.toString();
    const myQueue = docQueueRes.body.queue.filter(
      (q) => (q.doctorId?._id || q.doctorId)?.toString() === myDoctorId
    );
    assert.strictEqual(myQueue.length, 1, 'Doctor cockpit queue filter matches populated doctorId');
    const doctorActivePatient = myQueue.find((q) => q.status === 'IN_CONSULTATION' || q.status === 'CALLED');
    assert.ok(doctorActivePatient, 'Doctor cockpit identifies active called patient');
    assert.strictEqual(doctorActivePatient.tokenNumber, 1);
    console.log('✅ Doctor Cockpit queue view successfully finds active called patient.');

    // =========================================================================
    // STEP 6: Start Consultation (CALLED -> IN_CONSULTATION)
    // =========================================================================
    console.log('\n--- Step 6: Start Consultation ---');
    const queueEntryId = queueResCalled.body.activeEntries[0]._id.toString();
    const startReq = {
      user: { _id: staffUser._id, role: 'STAFF', staffClinicId: clinic._id },
      headers: { authorization: `Bearer ${staffToken}` },
      params: { id: queueEntryId },
    };
    const startRes = createMockRes();
    await runWithAuth(startReq, startRes, startConsultation, ['STAFF', 'ADMIN', 'DOCTOR']);

    assert.strictEqual(startRes.statusCode, 200);
    assert.strictEqual(startRes.body.queueEntry.status, 'IN_CONSULTATION');

    const queueResInConsult = createMockRes();
    await runWithAuth(queueReqWithDoc, queueResInConsult, getTodayQueue, ['STAFF', 'ADMIN', 'DOCTOR']);
    assert.strictEqual(queueResInConsult.body.activeEntries.length, 1);
    assert.strictEqual(queueResInConsult.body.activeEntries[0].status, 'IN_CONSULTATION');
    console.log('✅ Consultation started: activeEntries has Token #1 with status IN_CONSULTATION.');

    // =========================================================================
    // STEP 7: Complete Consultation (IN_CONSULTATION -> COMPLETED)
    // =========================================================================
    console.log('\n--- Step 7: Complete Consultation ---');
    const completeReq = {
      user: { _id: staffUser._id, role: 'STAFF', staffClinicId: clinic._id },
      headers: { authorization: `Bearer ${staffToken}` },
      params: { id: queueEntryId },
    };
    const completeRes = createMockRes();
    await runWithAuth(completeReq, completeRes, completeConsultation, ['STAFF', 'ADMIN', 'DOCTOR']);

    assert.strictEqual(completeRes.statusCode, 200);
    assert.strictEqual(completeRes.body.queueEntry.status, 'COMPLETED');

    const queueResCompleted = createMockRes();
    await runWithAuth(queueReqWithDoc, queueResCompleted, getTodayQueue, ['STAFF', 'ADMIN', 'DOCTOR']);
    assert.strictEqual(queueResCompleted.body.waitingEntries.length, 0);
    assert.strictEqual(queueResCompleted.body.activeEntries.length, 0);
    assert.strictEqual(queueResCompleted.body.terminalEntries.length, 1);
    assert.strictEqual(queueResCompleted.body.terminalEntries[0].tokenNumber, 1);
    assert.strictEqual(queueResCompleted.body.terminalEntries[0].status, 'COMPLETED');
    console.log('✅ Consultation completed: Token #1 is in terminalEntries, activeEntries: 0.');

    // =========================================================================
    // STEP 8: Walk-In Registration & Call Next
    // =========================================================================
    console.log('\n--- Step 8: Walk-In Patient Registration & Call Next ---');
    const walkInPatient = await Patient.create({
      userId: null,
      fullName: 'Walk-In Patient Two',
      phone: '9876500004',
      gender: 'FEMALE',
    });

    const walkInReq = {
      user: { _id: staffUser._id, role: 'STAFF', staffClinicId: clinic._id },
      headers: { authorization: `Bearer ${staffToken}` },
      body: {
        patientId: walkInPatient._id.toString(),
        doctorId: doctor._id.toString(),
        priority: 'NORMAL',
      },
    };
    const walkInRes = createMockRes();
    await runWithAuth(walkInReq, walkInRes, registerWalkIn, ['STAFF', 'ADMIN', 'DOCTOR']);

    assert.strictEqual(walkInRes.statusCode, 201);
    assert.strictEqual(walkInRes.body.queueEntry.tokenNumber, 2);
    assert.strictEqual(walkInRes.body.queueEntry.status, 'WAITING');
    assert.strictEqual(walkInRes.body.queueEntry.source, 'WALK_IN');

    // Query queue after walk-in registration
    const queueResWalkIn = createMockRes();
    await runWithAuth(queueReqWithDoc, queueResWalkIn, getTodayQueue, ['STAFF', 'ADMIN', 'DOCTOR']);
    assert.strictEqual(queueResWalkIn.body.waitingEntries.length, 1);
    assert.strictEqual(queueResWalkIn.body.waitingEntries[0].tokenNumber, 2);
    assert.strictEqual(queueResWalkIn.body.terminalEntries.length, 1);
    assert.strictEqual(queueResWalkIn.body.queue.length, 2);

    // Call Next for Token #2
    const callNextRes2 = createMockRes();
    await runWithAuth(callNextReq, callNextRes2, callNextPatient, ['STAFF', 'ADMIN', 'DOCTOR']);
    assert.strictEqual(callNextRes2.statusCode, 200);
    assert.strictEqual(callNextRes2.body.queueEntry.tokenNumber, 2);
    assert.strictEqual(callNextRes2.body.queueEntry.status, 'CALLED');

    const queueResWalkInCalled = createMockRes();
    await runWithAuth(queueReqWithDoc, queueResWalkInCalled, getTodayQueue, ['STAFF', 'ADMIN', 'DOCTOR']);
    assert.strictEqual(queueResWalkInCalled.body.waitingEntries.length, 0);
    assert.strictEqual(queueResWalkInCalled.body.activeEntries.length, 1);
    assert.strictEqual(queueResWalkInCalled.body.activeEntries[0].tokenNumber, 2);
    assert.strictEqual(queueResWalkInCalled.body.terminalEntries.length, 1);
    assert.strictEqual(queueResWalkInCalled.body.queue.length, 2);
    console.log('✅ Walk-In Token #2 successfully registered and called. Total queue: 2 (1 Active, 1 Terminal).');

    console.log('\n🎉 ALL 8 CHECK-IN AND CALL-NEXT LIFECYCLE TESTS PASSED PERFECTLY!\n');
  } finally {
    await mongoose.disconnect();
    await replSet.stop();
    console.log('🔒 Disconnected and stopped in-memory replica set.');
  }
}

main().catch((err) => {
  console.error('❌ Check-In and Call-Next Lifecycle Test Failed:', err);
  process.exit(1);
});
