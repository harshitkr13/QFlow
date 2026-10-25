import assert from 'assert';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import {
  Clinic,
  Doctor,
  Specialty,
  User,
  Patient,
  QueueEntry,
} from '../models/index.js';
import { getPublicQueueDisplay } from '../controllers/publicQueueController.js';

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

function getFormattedDateIST(dateObj = new Date()) {
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  return new Intl.DateTimeFormat('en-CA', options).format(dateObj);
}

async function main() {
  console.log('🚀 Starting Public Queue Display Synchronization Test Suite...');

  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });

  const uri = replSet.getUri('qflow_test_public_queue');
  await mongoose.connect(uri);
  console.log('✅ Connected to isolated MongoMemoryReplSet.');

  try {
    await Promise.all([
      Clinic.init(),
      Doctor.init(),
      Specialty.init(),
      User.init(),
      Patient.init(),
      QueueEntry.init(),
    ]);

    const todayIST = getFormattedDateIST();

    // 1. Setup Fixtures
    const adminUser = await User.create({
      fullName: 'Clinic Admin',
      email: 'admin.public@qflow.test',
      phone: '9000000001',
      password: 'HashedPassword123!',
      role: 'ADMIN',
      isActive: true,
    });

    const clinicA = await Clinic.create({
      name: '[STAGING DEMO] Apex Community Clinic',
      code: 'APEX-01',
      adminId: adminUser._id,
      address: {
        street: '123 Medical Center Way',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      phone: '9876543210',
      email: 'apex@qflow.test',
      isActive: true,
      queuePolicy: 'HYBRID',
    });

    const clinicB = await Clinic.create({
      name: 'Metro Health Satellite',
      code: 'METRO-02',
      adminId: adminUser._id,
      address: {
        street: '456 Satellite Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560025',
      },
      location: { type: 'Point', coordinates: [77.6000, 12.9800] },
      phone: '9876543211',
      email: 'metro@qflow.test',
      isActive: true,
      queuePolicy: 'HYBRID',
    });

    const specialty = await Specialty.create({
      name: 'General Medicine',
      code: 'GENMED',
      description: 'Primary care',
      isActive: true,
    });

    const docUserA = await User.create({
      fullName: 'Dr. Alex Demo',
      email: 'alex.demo@qflow.test',
      phone: '9000000002',
      password: 'HashedPassword123!',
      role: 'DOCTOR',
      isActive: true,
    });

    const doctorA = await Doctor.create({
      userId: docUserA._id,
      clinicId: clinicA._id,
      specialtyId: specialty._id,
      fullName: 'Dr. Alex Demo',
      gender: 'MALE',
      consultationFee: 500,
      experienceYears: 10,
      qualifications: ['MBBS', 'MD'],
      averageConsultationDurationMinutes: 15,
      isAvailable: true,
      operationalStatus: 'AVAILABLE',
      isQueuePaused: false,
    });

    const patientUser1 = await User.create({
      fullName: 'Confidential Patient Alpha',
      email: 'alpha@qflow.test',
      phone: '9111111111',
      password: 'HashedPassword123!',
      role: 'PATIENT',
      isActive: true,
    });

    const patient1 = await Patient.create({
      userId: patientUser1._id,
      fullName: 'Confidential Patient Alpha',
      phone: '9111111111',
      gender: 'MALE',
      dateOfBirth: new Date('1985-05-15'),
    });

    const patientUser2 = await User.create({
      fullName: 'Confidential Patient Beta',
      email: 'beta@qflow.test',
      phone: '9222222222',
      password: 'HashedPassword123!',
      role: 'PATIENT',
      isActive: true,
    });

    const patient2 = await Patient.create({
      userId: patientUser2._id,
      fullName: 'Confidential Patient Beta',
      phone: '9222222222',
      gender: 'FEMALE',
      dateOfBirth: new Date('1992-08-20'),
    });

    console.log('✅ Fixtures created successfully.\n');

    // =========================================================================
    // SCENARIO 1: Empty Clinic Queue (Shows #IDLE and 0 Waiting)
    // =========================================================================
    console.log('--- Scenario 1: Empty Clinic Queue ---');
    {
      const req = { query: { clinicId: clinicA._id.toString() } };
      const res = createMockRes();
      await getPublicQueueDisplay(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.clinicName, '[STAGING DEMO] Apex Community Clinic');
      // Verify both root and display.nested contract
      assert.strictEqual(res.body.currentServingToken, null);
      assert.strictEqual(res.body.display.currentServingToken, null);
      assert.strictEqual(res.body.servingState, 'IDLE');
      assert.strictEqual(res.body.display.servingState, 'IDLE');
      assert.strictEqual(res.body.totalWaiting, 0);
      assert.strictEqual(res.body.display.totalWaitingCount, 0);
      assert.deepStrictEqual(res.body.display.nextWaitingTokens, []);
      console.log('✅ Empty queue returns currentServingToken: null, servingState: IDLE, totalWaiting: 0.');
    }

    // =========================================================================
    // SCENARIO 2: CALLED Entry (The Live Staging Scenario)
    // =========================================================================
    console.log('\n--- Scenario 2: Active CALLED Token #1 ---');
    const calledEntry = await QueueEntry.create({
      clinicId: clinicA._id,
      doctorId: doctorA._id,
      patientId: patient1._id,
      queueDate: todayIST,
      tokenNumber: 1,
      source: 'ONLINE',
      priority: 'NORMAL',
      effectiveSlotMinutes: 540,
      status: 'CALLED',
      calledAt: new Date(),
    });

    {
      const req = { query: { clinicId: clinicA._id.toString() } };
      const res = createMockRes();
      await getPublicQueueDisplay(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      // Both root and display contract must expose token #1
      assert.strictEqual(res.body.currentServingToken, 1, 'Root currentServingToken must be 1');
      assert.strictEqual(res.body.display.currentServingToken, 1, 'display.currentServingToken must be 1');
      assert.strictEqual(res.body.servingState, 'CALLED');
      assert.strictEqual(res.body.display.servingState, 'CALLED');
      assert.strictEqual(res.body.calledToken, 1);
      assert.strictEqual(res.body.display.calledToken, 1);
      assert.strictEqual(res.body.totalWaiting, 0);
      assert.strictEqual(res.body.display.totalWaitingCount, 0);

      // Verify privacy preservation: NO PII in response
      const jsonStr = JSON.stringify(res.body);
      assert(!jsonStr.includes('Confidential Patient Alpha'), 'Response MUST NOT contain patient full name');
      assert(!jsonStr.includes('9111111111'), 'Response MUST NOT contain patient phone number');
      assert(!jsonStr.includes(patient1._id.toString()), 'Response MUST NOT contain patient ID');

      console.log('✅ Active CALLED Token #1 identified: currentServingToken: 1, servingState: CALLED. Zero PII leaked.');
    }

    // =========================================================================
    // SCENARIO 3: WAITING Entry in Queue alongside CALLED Entry
    // =========================================================================
    console.log('\n--- Scenario 3: WAITING Entry alongside CALLED Entry ---');
    const waitingEntry = await QueueEntry.create({
      clinicId: clinicA._id,
      doctorId: doctorA._id,
      patientId: patient2._id,
      queueDate: todayIST,
      tokenNumber: 2,
      source: 'WALK_IN',
      priority: 'NORMAL',
      effectiveSlotMinutes: 555,
      status: 'WAITING',
      joinedAt: new Date(),
    });

    {
      const req = { query: { clinicId: clinicA._id.toString() } };
      const res = createMockRes();
      await getPublicQueueDisplay(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.currentServingToken, 1, 'Serving token remains 1');
      assert.strictEqual(res.body.servingState, 'CALLED');
      assert.strictEqual(res.body.totalWaiting, 1, 'Root totalWaiting must be 1');
      assert.strictEqual(res.body.display.totalWaitingCount, 1, 'display.totalWaitingCount must be 1');
      assert.deepStrictEqual(res.body.display.nextWaitingTokens, [2], 'nextWaitingTokens must list [2]');

      const jsonStr = JSON.stringify(res.body);
      assert(!jsonStr.includes('Confidential Patient Beta'), 'Response MUST NOT contain patient full name');
      assert(!jsonStr.includes('9222222222'), 'Response MUST NOT contain patient phone number');

      console.log('✅ WAITING Entry accounted for: totalWaiting: 1, nextWaitingTokens: [2]. Zero PII leaked.');
    }

    // =========================================================================
    // SCENARIO 4: IN_CONSULTATION Entry Transition
    // =========================================================================
    console.log('\n--- Scenario 4: IN_CONSULTATION Entry Transition ---');
    calledEntry.status = 'IN_CONSULTATION';
    calledEntry.consultationStartedAt = new Date();
    await calledEntry.save();

    {
      const req = { query: { clinicId: clinicA._id.toString() } };
      const res = createMockRes();
      await getPublicQueueDisplay(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.currentServingToken, 1, 'Serving token is 1 during consultation');
      assert.strictEqual(res.body.display.currentServingToken, 1);
      assert.strictEqual(res.body.servingState, 'IN_CONSULTATION');
      assert.strictEqual(res.body.display.servingState, 'IN_CONSULTATION');
      assert.strictEqual(res.body.calledToken, null, 'calledToken is null when in consultation');
      assert.strictEqual(res.body.totalWaiting, 1);
      console.log('✅ IN_CONSULTATION preserves serving token 1 with servingState: IN_CONSULTATION.');
    }

    // =========================================================================
    // SCENARIO 5: Clinic Scoping (Clinic Isolation)
    // =========================================================================
    console.log('\n--- Scenario 5: Strict Clinic Scoping ---');
    {
      // Query Clinic B (which has no entries)
      const reqB = { query: { clinicId: clinicB._id.toString() } };
      const resB = createMockRes();
      await getPublicQueueDisplay(reqB, resB);

      assert.strictEqual(resB.statusCode, 200);
      assert.strictEqual(resB.body.clinicName, 'Metro Health Satellite');
      assert.strictEqual(resB.body.currentServingToken, null, 'Clinic B must not see Clinic A active token');
      assert.strictEqual(resB.body.servingState, 'IDLE');
      assert.strictEqual(resB.body.totalWaiting, 0, 'Clinic B must not see Clinic A waiting tokens');
      console.log('✅ Clinic B strictly isolated: currentServingToken: null, totalWaiting: 0.');
    }

    // =========================================================================
    // SCENARIO 6: Invalid / Malformed Clinic ID Handling
    // =========================================================================
    console.log('\n--- Scenario 6: Validation Guardrails ---');
    {
      const reqInvalid = { query: { clinicId: 'invalid-id-format' } };
      const resInvalid = createMockRes();
      await getPublicQueueDisplay(reqInvalid, resInvalid);
      assert.strictEqual(resInvalid.statusCode, 400);

      const reqMissing = { query: {} };
      const resMissing = createMockRes();
      await getPublicQueueDisplay(reqMissing, resMissing);
      assert.strictEqual(resMissing.statusCode, 400);

      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const reqNonExistent = { query: { clinicId: nonExistentId } };
      const resNonExistent = createMockRes();
      await getPublicQueueDisplay(reqNonExistent, resNonExistent);
      assert.strictEqual(resNonExistent.statusCode, 404);
      console.log('✅ Validation guardrails reject missing, invalid, and nonexistent clinic IDs.');
    }

    console.log('\n🎉 ALL PUBLIC QUEUE DISPLAY TEST SCENARIOS PASSED PERFECTLY!\n');
  } finally {
    await mongoose.disconnect();
    await replSet.stop();
    console.log('🔒 Disconnected and stopped in-memory replica set.');
  }
}

main().catch((err) => {
  console.error('❌ Public Queue Display Test Failed:', err);
  process.exit(1);
});
