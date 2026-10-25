import assert from 'assert';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import {
  Clinic,
  Doctor,
  Specialty,
  User,
  Staff,
  Patient,
  QueueEntry,
  QueueCounter,
  Notification,
} from '../models/index.js';
import { formatDoctorName as serverFormatDoctorName } from '../utils/doctorUtils.js';
import { formatDoctorName as clientFormatDoctorName } from '../../client/src/utils/doctorUtils.js';
import { loginUser, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { getTodayQueue, callNextPatient } from '../controllers/staffQueueController.js';

process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'test_jwt_staging_secret_key_1234567890';

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
  console.log('🚀 Starting Staging UI Display Fixes Automated Test Suite...');

  // --------------------------------------------------------------------------
  // TEST 1: Doctor Name Formatter Logic (Server & Client)
  // --------------------------------------------------------------------------
  console.log('\n[TEST 1] Verifying formatDoctorName on Server and Client...');
  const testCases = [
    { input: 'Dr. Alex Demo', expected: 'Dr. Alex Demo' },
    { input: 'Dr. Dr. Alex Demo', expected: 'Dr. Alex Demo' },
    { input: 'Dr. Dr. Dr. Alex Demo', expected: 'Dr. Alex Demo' },
    { input: 'Alex Demo', expected: 'Dr. Alex Demo' },
    { input: 'Dr Alex Demo', expected: 'Dr. Alex Demo' },
    { input: 'Doctor Alex Demo', expected: 'Dr. Alex Demo' },
    { input: '  Dr.   Alex Demo  ', expected: 'Dr. Alex Demo' },
    { input: 'Drew Carey', expected: 'Dr. Drew Carey' },
    { input: 'Drake Bell', expected: 'Dr. Drake Bell' },
    { input: 'Dr. Drew', expected: 'Dr. Drew' },
    { input: "Dr. Sarah O'Connor", expected: "Dr. Sarah O'Connor" },
    { input: 'Dr.', expected: 'Doctor' },
    { input: 'Doctor', expected: 'Doctor' },
    { input: 'Dr', expected: 'Doctor' },
    { input: '', expected: 'Doctor' },
    { input: null, expected: 'Doctor' },
    { input: undefined, expected: 'Doctor' },
  ];

  for (const tc of testCases) {
    const serverOut = serverFormatDoctorName(tc.input);
    const clientOut = clientFormatDoctorName(tc.input);
    assert.strictEqual(
      serverOut,
      tc.expected,
      `Server formatDoctorName("${tc.input}") failed. Expected "${tc.expected}", got "${serverOut}"`
    );
    assert.strictEqual(
      clientOut,
      tc.expected,
      `Client formatDoctorName("${tc.input}") failed. Expected "${tc.expected}", got "${clientOut}"`
    );
  }
  console.log('✅ PASS: All 17 doctor name formatting edge cases verified across Server and Client.');

  // --------------------------------------------------------------------------
  // SETUP: Spin up isolated in-memory replica set
  // --------------------------------------------------------------------------
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });

  const uri = replSet.getUri('qflow_test_staging_ui_fixes');
  await mongoose.connect(uri);
  console.log('✅ Connected to isolated MongoMemoryReplSet.');

  try {
    await Promise.all([
      Clinic.init(),
      Doctor.init(),
      Specialty.init(),
      User.init(),
      Staff.init(),
      Patient.init(),
      QueueEntry.init(),
      QueueCounter.init(),
      Notification.init(),
    ]);

    // Seed test admin user for clinic
    const adminUser = await User.create({
      email: 'admin.staging@qflow.test',
      password: await bcrypt.hash('AdminPass123!', 10),
      role: 'ADMIN',
      isActive: true,
    });

    // Seed test clinic
    const clinic = await Clinic.create({
      name: '[STAGING DEMO] Apex Community Clinic',
      code: 'APEX-COMM',
      adminId: adminUser._id,
      address: {
        street: '123 Healthcare Blvd',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
      location: {
        type: 'Point',
        coordinates: [72.8777, 19.0760],
      },
      phone: '+91 22 2456 7890',
      isActive: true,
    });

    // Seed test staff user & staff profile
    const staffPasswordHash = await bcrypt.hash('StaffPass123!', 10);
    const staffUser = await User.create({
      email: 'staff.staging@qflow.test',
      password: staffPasswordHash,
      role: 'STAFF',
      isActive: true,
    });

    const staffProfile = await Staff.create({
      userId: staffUser._id,
      clinicId: clinic._id,
      fullName: 'Staging Staff Receptionist',
      phone: '+91 98200 11223',
    });

    // Seed doctor & specialty
    const specialty = await Specialty.create({
      name: 'General Physician',
      code: 'GEN-PHYS',
      isActive: true,
    });

    const doctorUser = await User.create({
      email: 'dr.alex.demo@qflow.test',
      password: staffPasswordHash,
      role: 'DOCTOR',
      isActive: true,
    });

    const doctor = await Doctor.create({
      userId: doctorUser._id,
      clinicId: clinic._id,
      specialtyId: specialty._id,
      fullName: 'Dr. Alex Demo',
      gender: 'MALE',
      qualifications: ['MBBS', 'MD'],
      experienceYears: 10,
      consultationFee: 500,
      averageConsultationDurationMinutes: 15,
      isActive: true,
    });

    // Seed patient
    const patientUser = await User.create({
      email: 'patient.staging@qflow.test',
      password: staffPasswordHash,
      role: 'PATIENT',
      isActive: true,
    });

    const patient = await Patient.create({
      userId: patientUser._id,
      fullName: 'Jane Staging Patient',
      phone: '+91 98111 22334',
      gender: 'FEMALE',
    });

    // --------------------------------------------------------------------------
    // TEST 2: POST /api/auth/login returns populated clinic and staff fullName
    // --------------------------------------------------------------------------
    console.log('\n[TEST 2] Testing POST /api/auth/login for STAFF...');
    const loginReq = {
      body: {
        email: 'staff.staging@qflow.test',
        password: 'StaffPass123!',
      },
    };
    const loginRes = createMockRes();
    await loginUser(loginReq, loginRes, (err) => { if (err) throw err; });

    assert.strictEqual(loginRes.statusCode, 200);
    assert.strictEqual(loginRes.body.success, true);
    assert.ok(loginRes.body.token, 'Token must be returned');
    assert.strictEqual(loginRes.body.user.role, 'STAFF');
    assert.strictEqual(loginRes.body.user.fullName, 'Staging Staff Receptionist', 'User fullName must match staff profile');
    assert.ok(loginRes.body.user.clinic, 'User clinic object must be present');
    assert.strictEqual(
      loginRes.body.user.clinic.name,
      '[STAGING DEMO] Apex Community Clinic',
      'User clinic name must match assigned clinic'
    );
    assert.strictEqual(
      loginRes.body.user.profile.clinicId.name,
      '[STAGING DEMO] Apex Community Clinic',
      'User profile clinicId must be populated with clinic name'
    );
    console.log('✅ PASS: Staff login returns populated clinic and fullName.');

    const staffToken = loginRes.body.token;

    // --------------------------------------------------------------------------
    // TEST 3: GET /api/auth/me returns populated clinic details and fullName
    // --------------------------------------------------------------------------
    console.log('\n[TEST 3] Testing GET /api/auth/me with staff token...');
    const meReq = {
      headers: {
        authorization: `Bearer ${staffToken}`,
      },
    };
    const meRes = createMockRes();

    // Pass through protect middleware
    await protect(meReq, meRes, () => {});
    assert.ok(meReq.user, 'req.user must be attached by protect middleware');
    assert.ok(meReq.user.staffClinicId, 'req.user.staffClinicId must be present');
    assert.ok(
      meReq.user.staffClinicId instanceof mongoose.Types.ObjectId,
      'staffClinicId must be an instance of ObjectId for .equals()'
    );

    // Call getMe controller
    await getMe(meReq, meRes, (err) => { if (err) throw err; });

    assert.strictEqual(meRes.statusCode, 200);
    assert.strictEqual(meRes.body.user.role, 'STAFF');
    assert.strictEqual(meRes.body.user.fullName, 'Staging Staff Receptionist');
    assert.ok(meRes.body.user.clinic, 'Clinic object must be returned in getMe');
    assert.strictEqual(
      meRes.body.user.clinic.name,
      '[STAGING DEMO] Apex Community Clinic',
      'Clinic name must match in getMe'
    );
    console.log('✅ PASS: GET /api/auth/me returns populated clinic and staff fullName.');

    // --------------------------------------------------------------------------
    // TEST 4: GET /api/staff/queue/today returns clinic details in response
    // --------------------------------------------------------------------------
    console.log('\n[TEST 4] Testing GET /api/staff/queue/today includes clinic metadata...');
    const queueReq = {
      user: meReq.user,
      query: {
        doctorId: doctor._id.toString(),
      },
    };
    const queueRes = createMockRes();
    await getTodayQueue(queueReq, queueRes, (err) => { if (err) throw err; });

    assert.strictEqual(queueRes.statusCode, 200);
    assert.ok(queueRes.body.clinic, 'Response must include clinic metadata');
    assert.strictEqual(
      queueRes.body.clinic.name,
      '[STAGING DEMO] Apex Community Clinic',
      'Clinic name must match in staff queue response'
    );
    console.log('✅ PASS: GET /api/staff/queue/today includes clinic metadata.');

    // --------------------------------------------------------------------------
    // TEST 5: Call Next Patient notification formats doctor title with NO duplicates
    // --------------------------------------------------------------------------
    console.log('\n[TEST 5] Testing Call Next Patient notification formatting...');
    const today = getFormattedDateIST();

    // Create a waiting queue entry
    const entry = await QueueEntry.create({
      clinicId: clinic._id,
      doctorId: doctor._id,
      patientId: patient._id,
      queueDate: today,
      tokenNumber: 1,
      status: 'WAITING',
      priority: 'NORMAL',
      priorityWeight: 1,
      source: 'WALK_IN',
    });

    const callReq = {
      user: meReq.user,
      body: {
        doctorId: doctor._id.toString(),
      },
    };
    const callRes = createMockRes();
    await callNextPatient(callReq, callRes, (err) => { if (err) throw err; });

    assert.strictEqual(callRes.statusCode, 200);
    assert.strictEqual(callRes.body.queueEntry.status, 'CALLED');

    // Inspect the notification generated for the patient
    const notif = await Notification.findOne({ queueEntryId: entry._id });
    assert.ok(notif, 'Notification must be created for called patient');
    console.log(`  Notification message: "${notif.message}"`);
    assert.ok(
      !notif.message.includes('Dr. Dr.'),
      'Notification must NOT contain duplicate "Dr. Dr."'
    );
    assert.ok(
      notif.message.includes('Dr. Alex Demo'),
      'Notification must contain properly formatted doctor name "Dr. Alex Demo"'
    );
    console.log('✅ PASS: Call Next notification formats doctor name without duplicate title.');

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! Both UI issues verified fixed.');
  } finally {
    await mongoose.disconnect();
    await replSet.stop();
    console.log('✅ Isolated MongoMemoryReplSet stopped cleanly.');
  }
}

main().catch((err) => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
