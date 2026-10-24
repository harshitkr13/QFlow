import assert from 'assert';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Clinic, Doctor, DoctorSchedule, Specialty, User, Staff, Patient } from '../models/index.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { updateScheduleAdmin } from '../controllers/scheduleController.js';
import { getDoctors } from '../controllers/doctorController.js';
import { generateToken } from '../utils/jwt.js';

process.env.JWT_SECRET = 'test-jwt-secret-qflow-phase2-secure-random-12345';
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

async function runThroughAuthAndHandler(req, res, handler) {
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

  let authNext = false;
  const adminAuth = authorize('ADMIN');
  adminAuth(req, res, () => {
    authNext = true;
  });

  if (halted || !authNext) return;

  await handler(req, res, (err) => {
    if (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
}

async function runTestSuite() {
  console.log('======================================================================');
  console.log('STARTING PHASE 2 ADMIN DOCTOR SCHEDULE MANAGEMENT TEST SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ FAIL: ${name}`);
      console.error(`  Error: ${err.message}`);
      failed++;
    }
  }

  let replSet;

  try {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    const uri = replSet.getUri('qflow_admin_schedules_test');
    await mongoose.connect(uri);
    console.log('✓ Connected to ephemeral in-memory MongoDB replica set.\n');

    // 1. Seed Base Test Records
    const adminUser = await User.create({
      fullName: 'Super Admin',
      email: 'admin.phase2@test.com',
      password: 'Password123!',
      role: 'ADMIN',
      isActive: true,
    });
    const adminToken = generateToken({ id: adminUser._id, role: 'ADMIN' });

    const patientUser = await User.create({
      fullName: 'John Patient',
      email: 'patient.phase2@test.com',
      password: 'Password123!',
      role: 'PATIENT',
      isActive: true,
    });
    await Patient.create({
      userId: patientUser._id,
      fullName: 'John Patient',
      phone: '9876543210',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'MALE',
      location: { coordinates: [77.59, 12.97] },
    });
    const patientToken = generateToken({ id: patientUser._id, role: 'PATIENT' });

    const clinic = await Clinic.create({
      name: 'Central Ortho Clinic',
      code: 'COC-P2',
      address: { street: '12 Medical Way', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
      location: { type: 'Point', coordinates: [77.59, 12.97] },
      phone: '9876543211',
      email: 'clinic.phase2@test.com',
      adminId: adminUser._id,
      isActive: true,
    });

    const staffUser = await User.create({
      fullName: 'Staff Member',
      email: 'staff.phase2@test.com',
      password: 'Password123!',
      role: 'STAFF',
      isActive: true,
    });
    await Staff.create({
      userId: staffUser._id,
      clinicId: clinic._id,
      fullName: 'Staff Member',
      role: 'RECEPTIONIST',
    });
    const staffToken = generateToken({ id: staffUser._id, role: 'STAFF' });

    const specialty = await Specialty.create({
      name: 'Orthopedics',
      code: 'ORTHO-P2',
      description: 'Bone and joint care',
      isActive: true,
    });

    const doctorUser = await User.create({
      fullName: 'Dr. Arthur Pendelton',
      email: 'doc.phase2@test.com',
      password: 'Password123!',
      role: 'DOCTOR',
      isActive: true,
    });

    const doctor = await Doctor.create({
      userId: doctorUser._id,
      clinicId: clinic._id,
      specialtyId: specialty._id,
      fullName: 'Dr. Arthur Pendelton',
      gender: 'MALE',
      qualifications: ['MBBS', 'MS Orthopedics'],
      experienceYears: 12,
      consultationFee: 750,
      averageConsultationDurationMinutes: 15,
      isActive: true,
    });

    // --- TEST GROUP 1: AUTHENTICATION & AUTHORIZATION GUARDS ---
    console.log('--- 1. AUTHENTICATION & RBAC AUTHORIZATION ---');

    await test('Unauthenticated requests to admin schedule update are rejected with 401', async () => {
      const req = {
        headers: {},
        params: { id: doctor._id.toString() },
        body: { weeklyHours: [] },
      };
      const res = createMockRes();
      await runThroughAuthAndHandler(req, res, updateScheduleAdmin);
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /no authentication token provided/i);
    });

    await test('PATIENT role is rejected with 403 Forbidden', async () => {
      const req = {
        headers: { authorization: `Bearer ${patientToken}` },
        params: { id: doctor._id.toString() },
        body: { weeklyHours: [] },
      };
      const res = createMockRes();
      await runThroughAuthAndHandler(req, res, updateScheduleAdmin);
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /not authorized to access this resource/i);
    });

    await test('STAFF role is rejected with 403 Forbidden', async () => {
      const req = {
        headers: { authorization: `Bearer ${staffToken}` },
        params: { id: doctor._id.toString() },
        body: { weeklyHours: [] },
      };
      const res = createMockRes();
      await runThroughAuthAndHandler(req, res, updateScheduleAdmin);
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /not authorized to access this resource/i);
    });

    // --- TEST GROUP 2: INPUT VALIDATION & BUSINESS RULES ---
    console.log('\n--- 2. INPUT VALIDATION & BUSINESS RULES ---');

    await test('Returns 404 if doctor ID does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const req = {
        headers: { authorization: `Bearer ${adminToken}` },
        params: { id: fakeId.toString() },
        body: { weeklyHours: [] },
      };
      const res = createMockRes();
      await runThroughAuthAndHandler(req, res, updateScheduleAdmin);
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Doctor not found');
    });

    await test('Rejects empty or non-array weeklyHours with 400', async () => {
      const req = {
        headers: { authorization: `Bearer ${adminToken}` },
        params: { id: doctor._id.toString() },
        body: { weeklyHours: 'not-an-array' },
      };
      const res = createMockRes();
      await runThroughAuthAndHandler(req, res, updateScheduleAdmin);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /weeklyHours must be a non-empty array/i);
    });

    await test('Rejects working day without shifts with 400', async () => {
      const req = {
        headers: { authorization: `Bearer ${adminToken}` },
        params: { id: doctor._id.toString() },
        body: {
          weeklyHours: [
            { dayOfWeek: 'MONDAY', isWorkingDay: true, shifts: [] },
          ],
        },
      };
      const res = createMockRes();
      await runThroughAuthAndHandler(req, res, updateScheduleAdmin);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /Working day MONDAY must have at least one shift/i);
    });

    await test('Rejects invalid time format (not HH:mm) with 400', async () => {
      const req = {
        headers: { authorization: `Bearer ${adminToken}` },
        params: { id: doctor._id.toString() },
        body: {
          weeklyHours: [
            {
              dayOfWeek: 'MONDAY',
              isWorkingDay: true,
              shifts: [{ startTime: '9am', endTime: '13:00' }],
            },
          ],
        },
      };
      const res = createMockRes();
      await runThroughAuthAndHandler(req, res, updateScheduleAdmin);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /Expected HH:mm/i);
    });

    await test('Rejects inverted shift times (startTime >= endTime) with 400', async () => {
      const req = {
        headers: { authorization: `Bearer ${adminToken}` },
        params: { id: doctor._id.toString() },
        body: {
          weeklyHours: [
            {
              dayOfWeek: 'MONDAY',
              isWorkingDay: true,
              shifts: [{ startTime: '14:00', endTime: '11:00' }],
            },
          ],
        },
      };
      const res = createMockRes();
      await runThroughAuthAndHandler(req, res, updateScheduleAdmin);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /must be strictly earlier than end time/i);
    });

    await test('Rejects overlapping shifts on the same day with 400', async () => {
      const req = {
        headers: { authorization: `Bearer ${adminToken}` },
        params: { id: doctor._id.toString() },
        body: {
          weeklyHours: [
            {
              dayOfWeek: 'MONDAY',
              isWorkingDay: true,
              shifts: [
                { startTime: '09:00', endTime: '13:00' },
                { startTime: '12:00', endTime: '16:00' },
              ],
            },
          ],
        },
      };
      const res = createMockRes();
      await runThroughAuthAndHandler(req, res, updateScheduleAdmin);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /Overlapping shifts detected on MONDAY/i);
    });

    await test('Rejects break interval that falls outside of working shift hours with 400', async () => {
      const req = {
        headers: { authorization: `Bearer ${adminToken}` },
        params: { id: doctor._id.toString() },
        body: {
          weeklyHours: [
            {
              dayOfWeek: 'MONDAY',
              isWorkingDay: true,
              shifts: [{ startTime: '09:00', endTime: '13:00' }],
              breaks: [{ startTime: '13:30', endTime: '14:00', label: 'Late Tea' }],
            },
          ],
        },
      };
      const res = createMockRes();
      await runThroughAuthAndHandler(req, res, updateScheduleAdmin);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /must be within working shift hours/i);
    });

    await test('Rejects invalid averageConsultationDurationMinutes (< 1 or NaN) with 400', async () => {
      const validWeeklyHours = [
        {
          dayOfWeek: 'MONDAY',
          isWorkingDay: true,
          shifts: [{ startTime: '09:00', endTime: '13:00' }],
        },
      ];
      const req = {
        headers: { authorization: `Bearer ${adminToken}` },
        params: { id: doctor._id.toString() },
        body: {
          weeklyHours: validWeeklyHours,
          averageConsultationDurationMinutes: 0,
        },
      };
      const res = createMockRes();
      await runThroughAuthAndHandler(req, res, updateScheduleAdmin);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /averageConsultationDurationMinutes must be a positive integer/i);
    });

    // --- TEST GROUP 3: SUCCESSFUL SCHEDULE & DURATION CONFIGURATION ---
    console.log('\n--- 3. SUCCESSFUL SCHEDULE & CONSULTATION DURATION UPDATES ---');

    await test('Admin successfully configures 7-day schedule with multiple shifts and duration in one request', async () => {
      const weeklyHours = [
        {
          dayOfWeek: 'MONDAY',
          isWorkingDay: true,
          shifts: [
            { startTime: '09:00', endTime: '13:00' },
            { startTime: '16:00', endTime: '20:00' },
          ],
          breaks: [{ startTime: '11:00', endTime: '11:30', label: 'Coffee Break' }],
        },
        {
          dayOfWeek: 'TUESDAY',
          isWorkingDay: true,
          shifts: [{ startTime: '10:00', endTime: '15:00' }],
        },
        { dayOfWeek: 'WEDNESDAY', isWorkingDay: false, shifts: [] },
        {
          dayOfWeek: 'THURSDAY',
          isWorkingDay: true,
          shifts: [{ startTime: '09:00', endTime: '13:00' }],
        },
        {
          dayOfWeek: 'FRIDAY',
          isWorkingDay: true,
          shifts: [{ startTime: '14:00', endTime: '18:00' }],
        },
        { dayOfWeek: 'SATURDAY', isWorkingDay: false, shifts: [] },
        { dayOfWeek: 'SUNDAY', isWorkingDay: false, shifts: [] },
      ];

      const req = {
        headers: { authorization: `Bearer ${adminToken}` },
        params: { id: doctor._id.toString() },
        body: {
          weeklyHours,
          averageConsultationDurationMinutes: 25,
        },
      };
      const res = createMockRes();
      await runThroughAuthAndHandler(req, res, updateScheduleAdmin);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.doctor.averageConsultationDurationMinutes, 25);

      // Verify persistent schedule record in database
      const savedSchedule = await DoctorSchedule.findOne({ doctorId: doctor._id, isActive: true });
      assert.ok(savedSchedule, 'DoctorSchedule record must exist in DB');
      assert.strictEqual(savedSchedule.weeklyHours.length, 7);

      const mon = savedSchedule.weeklyHours.find((d) => d.dayOfWeek === 'MONDAY');
      assert.strictEqual(mon.isWorkingDay, true);
      assert.strictEqual(mon.shifts.length, 2);
      assert.strictEqual(mon.breaks.length, 1);
      assert.strictEqual(mon.breaks[0].label, 'Coffee Break');

      // Verify persistent doctor duration update in DB
      const updatedDoctor = await Doctor.findById(doctor._id);
      assert.strictEqual(updatedDoctor.averageConsultationDurationMinutes, 25);
    });

    await test('Supports completely off-duty schedule (all days isWorkingDay: false)', async () => {
      const allOffDuty = [
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
        'SUNDAY',
      ].map((day) => ({
        dayOfWeek: day,
        isWorkingDay: false,
        shifts: [],
        breaks: [],
      }));

      const req = {
        headers: { authorization: `Bearer ${adminToken}` },
        params: { id: doctor._id.toString() },
        body: { weeklyHours: allOffDuty },
      };
      const res = createMockRes();
      await runThroughAuthAndHandler(req, res, updateScheduleAdmin);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);

      const savedSchedule = await DoctorSchedule.findOne({ doctorId: doctor._id, isActive: true });
      assert.ok(savedSchedule.weeklyHours.every((d) => !d.isWorkingDay));
    });

    // --- TEST GROUP 4: ROSTER & ADMIN DISCOVERY INTEGRATION ---
    console.log('\n--- 4. ROSTER & ADMIN DISCOVERY INTEGRATION ---');

    await test('getDoctors controller properly populates hasSchedule, workingDays, and full schedule', async () => {
      // Re-enable Monday and Friday
      const activeSchedule = [
        {
          dayOfWeek: 'MONDAY',
          isWorkingDay: true,
          shifts: [{ startTime: '09:00', endTime: '13:00' }],
        },
        {
          dayOfWeek: 'FRIDAY',
          isWorkingDay: true,
          shifts: [{ startTime: '10:00', endTime: '14:00' }],
        },
      ];
      await DoctorSchedule.updateOne(
        { doctorId: doctor._id },
        { weeklyHours: activeSchedule }
      );

      // Create a second doctor with NO schedule
      const doctorUser2 = await User.create({
        fullName: 'Dr. Sarah Unscheduled',
        email: 'sarah.phase2@test.com',
        password: 'Password123!',
        role: 'DOCTOR',
        isActive: true,
      });
      const doctor2 = await Doctor.create({
        userId: doctorUser2._id,
        clinicId: clinic._id,
        specialtyId: specialty._id,
        fullName: 'Dr. Sarah Unscheduled',
        gender: 'FEMALE',
        qualifications: ['MBBS', 'MD'],
        experienceYears: 5,
        consultationFee: 500,
        averageConsultationDurationMinutes: 15,
        isActive: true,
      });

      const req = { query: {} };
      const res = createMockRes();
      await getDoctors(req, res, () => {});

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);

      const doc1Result = res.body.doctors.find((d) => d._id.toString() === doctor._id.toString());
      assert.ok(doc1Result);
      assert.strictEqual(doc1Result.hasSchedule, true);
      assert.deepStrictEqual(doc1Result.workingDays, ['MONDAY', 'FRIDAY']);
      assert.ok(Array.isArray(doc1Result.schedule));

      const doc2Result = res.body.doctors.find((d) => d._id.toString() === doctor2._id.toString());
      assert.ok(doc2Result);
      assert.strictEqual(doc2Result.hasSchedule, false);
      assert.deepStrictEqual(doc2Result.workingDays, []);
      assert.deepStrictEqual(doc2Result.schedule, []);
    });

  } finally {
    if (mongoose.connection?.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (replSet) {
      await replSet.stop();
    }
  }

  console.log('\n======================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
