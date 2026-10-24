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
} from '../models/index.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  getDoctorAvailability,
  createAppointment,
  getMyAppointments,
  getAppointmentById,
  cancelAppointment,
} from '../controllers/appointmentController.js';
import { discoverDoctors, getDoctorById } from '../controllers/doctorController.js';
import { generateToken } from '../utils/jwt.js';

process.env.JWT_SECRET = 'test-jwt-secret-qflow-phase4-patient-journey-12345';
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

// Executes an Express controller through protect + authorize('PATIENT')
async function runWithAuth(req, res, handler, requiredRole = 'PATIENT') {
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

  if (requiredRole) {
    let authNext = false;
    const authMiddleware = authorize(requiredRole);
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

// Helper to calculate future date string (YYYY-MM-DD) on a given day of the week
function getFutureDateOnDay(targetDayName) {
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const targetDayIdx = dayNames.indexOf(targetDayName.toUpperCase());
  if (targetDayIdx === -1) throw new Error(`Invalid day name: ${targetDayName}`);

  const d = new Date();
  // Start from tomorrow
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== targetDayIdx) {
    d.setDate(d.getDate() + 1);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function runTestSuite() {
  console.log('======================================================================');
  console.log('STARTING PHASE 4 COMPLETE PATIENT WORKFLOW TEST SUITE');
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
    const uri = replSet.getUri('qflow_patient_workflow_test');
    await mongoose.connect(uri);
    console.log('✓ Connected to isolated ephemeral in-memory MongoDB replica set.\n');

    // 1. Seed Clinic, Specialty & Admin
    const adminUser = await User.create({
      fullName: 'Super Admin',
      email: 'admin.phase4@test.com',
      password: 'Password123!',
      role: 'ADMIN',
      isActive: true,
    });

    const clinic = await Clinic.create({
      name: 'Sunrise Healthcare Clinic',
      code: 'SHC-P4',
      address: { street: '100 Medical Blvd', city: 'Bengaluru', state: 'Karnataka', pincode: '560002' },
      location: { type: 'Point', coordinates: [77.58, 12.98] },
      phone: '9876543220',
      email: 'clinic.phase4@test.com',
      adminId: adminUser._id,
      isActive: true,
    });

    const specialty = await Specialty.create({
      name: 'Pediatrics',
      code: 'PED-P4',
      description: 'Children healthcare',
      isActive: true,
    });

    // 2. Seed Doctor 1 (Configured with Monday & Thursday Schedule)
    const docUser1 = await User.create({
      fullName: 'Dr. Evelyn Reed',
      email: 'evelyn.p4@test.com',
      password: 'Password123!',
      role: 'DOCTOR',
      isActive: true,
    });
    const doctor1 = await Doctor.create({
      userId: docUser1._id,
      clinicId: clinic._id,
      specialtyId: specialty._id,
      fullName: 'Dr. Evelyn Reed',
      gender: 'FEMALE',
      qualifications: ['MBBS', 'MD Pediatrics'],
      experienceYears: 10,
      consultationFee: 600,
      averageConsultationDurationMinutes: 15,
      isActive: true,
    });

    await DoctorSchedule.create({
      doctorId: doctor1._id,
      clinicId: clinic._id,
      weeklyHours: [
        {
          dayOfWeek: 'MONDAY',
          isWorkingDay: true,
          shifts: [{ startTime: '09:00', endTime: '12:00' }],
          breaks: [{ startTime: '10:30', endTime: '10:45', label: 'Tea Break' }],
        },
        { dayOfWeek: 'TUESDAY', isWorkingDay: false, shifts: [] },
        { dayOfWeek: 'WEDNESDAY', isWorkingDay: false, shifts: [] },
        {
          dayOfWeek: 'THURSDAY',
          isWorkingDay: true,
          shifts: [{ startTime: '14:00', endTime: '17:00' }],
          breaks: [],
        },
        { dayOfWeek: 'FRIDAY', isWorkingDay: false, shifts: [] },
        { dayOfWeek: 'SATURDAY', isWorkingDay: false, shifts: [] },
        { dayOfWeek: 'SUNDAY', isWorkingDay: false, shifts: [] },
      ],
      isActive: true,
    });

    // 3. Seed Doctor 2 (Unscheduled Provider)
    const docUser2 = await User.create({
      fullName: 'Dr. Unscheduled Doc',
      email: 'unsched.p4@test.com',
      password: 'Password123!',
      role: 'DOCTOR',
      isActive: true,
    });
    const doctor2 = await Doctor.create({
      userId: docUser2._id,
      clinicId: clinic._id,
      specialtyId: specialty._id,
      fullName: 'Dr. Unscheduled Doc',
      gender: 'MALE',
      qualifications: ['MBBS'],
      experienceYears: 3,
      consultationFee: 400,
      averageConsultationDurationMinutes: 15,
      isActive: true,
    });

    // 4. Seed Patient 1 and Patient 2
    const patUser1 = await User.create({
      fullName: 'Alice Patient',
      email: 'alice.p4@test.com',
      password: 'Password123!',
      role: 'PATIENT',
      isActive: true,
    });
    const patient1 = await Patient.create({
      userId: patUser1._id,
      fullName: 'Alice Patient',
      phone: '9888800001',
      dateOfBirth: new Date('1994-05-15'),
      gender: 'FEMALE',
      location: { coordinates: [77.58, 12.98] },
    });
    const tokenPatient1 = generateToken({ id: patUser1._id, role: 'PATIENT' });

    const patUser2 = await User.create({
      fullName: 'Bob Patient',
      email: 'bob.p4@test.com',
      password: 'Password123!',
      role: 'PATIENT',
      isActive: true,
    });
    const patient2 = await Patient.create({
      userId: patUser2._id,
      fullName: 'Bob Patient',
      phone: '9888800002',
      dateOfBirth: new Date('1992-08-20'),
      gender: 'MALE',
      location: { coordinates: [77.58, 12.98] },
    });
    const tokenPatient2 = generateToken({ id: patUser2._id, role: 'PATIENT' });

    // 5. Seed Staff User
    const staffUser = await User.create({
      fullName: 'Staff User',
      email: 'staff.p4@test.com',
      password: 'Password123!',
      role: 'STAFF',
      isActive: true,
    });
    await Staff.create({
      userId: staffUser._id,
      clinicId: clinic._id,
      fullName: 'Staff User',
      role: 'RECEPTIONIST',
    });
    const tokenStaff = generateToken({ id: staffUser._id, role: 'STAFF' });

    // Dates for testing
    const futureMonday = getFutureDateOnDay('MONDAY');
    const futureTuesday = getFutureDateOnDay('TUESDAY');

    // ====================================================================
    // TEST GROUP 1: DOCTOR DISCOVERY & AVAILABILITY
    // ====================================================================
    console.log('--- 1. DISCOVERY & AVAILABILITY JOURNEY ---');

    await test('Patient can discover eligible doctors and view working days', async () => {
      const req = { query: {} };
      const res = createMockRes();
      await discoverDoctors(req, res, () => {});
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.doctors.length >= 2);

      const d1 = res.body.doctors.find((d) => d._id.toString() === doctor1._id.toString());
      assert.ok(d1);
      assert.strictEqual(d1.hasSchedule, true);
      assert.deepStrictEqual(d1.workingDays, ['MONDAY', 'THURSDAY']);

      const d2 = res.body.doctors.find((d) => d._id.toString() === doctor2._id.toString());
      assert.ok(d2);
      assert.strictEqual(d2.hasSchedule, false);
      assert.deepStrictEqual(d2.workingDays, []);
    });

    await test('Fetching availability on working day returns slots with breaks excluded', async () => {
      const req = {
        params: { id: doctor1._id.toString() },
        query: { date: futureMonday },
      };
      const res = createMockRes();
      await getDoctorAvailability(req, res, () => {});
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.dayOfWeek, 'MONDAY');
      assert.ok(res.body.availableSlots.length > 0);

      // Verify that 10:30-10:45 tea break is NOT present in slots
      const teaBreakSlot = res.body.availableSlots.find(
        (s) => s.startTime === '10:30' && s.endTime === '10:45'
      );
      assert.strictEqual(teaBreakSlot, undefined, 'Break slot must be excluded from availability');

      // Verify valid slot 09:00 - 09:15 is present
      const firstSlot = res.body.availableSlots.find(
        (s) => s.startTime === '09:00' && s.endTime === '09:15'
      );
      assert.ok(firstSlot, 'First slot 09:00 - 09:15 must be available');
    });

    await test('Fetching availability on off-duty day returns 200 with clear message', async () => {
      const req = {
        params: { id: doctor1._id.toString() },
        query: { date: futureTuesday },
      };
      const res = createMockRes();
      await getDoctorAvailability(req, res, () => {});
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.availableSlots.length, 0);
      assert.strictEqual(res.body.message, 'Doctor does not work on this day');
    });

    await test('Fetching availability for unscheduled doctor returns 200 with not configured message', async () => {
      const req = {
        params: { id: doctor2._id.toString() },
        query: { date: futureMonday },
      };
      const res = createMockRes();
      await getDoctorAvailability(req, res, () => {});
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.availableSlots.length, 0);
      assert.strictEqual(res.body.message, 'Doctor schedule is not configured');
    });

    await test('Querying availability for past date is rejected with 400', async () => {
      const req = {
        params: { id: doctor1._id.toString() },
        query: { date: '2020-01-01' },
      };
      const res = createMockRes();
      await getDoctorAvailability(req, res, () => {});
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /past dates is not permitted/i);
    });

    // ====================================================================
    // TEST GROUP 2: BOOKING LIFECYCLE & VALIDATION
    // ====================================================================
    console.log('\n--- 2. BOOKING LIFECYCLE & VALIDATION ---');

    await test('Unauthenticated booking attempt is rejected with 401', async () => {
      const req = {
        headers: {},
        body: {
          doctorId: doctor1._id.toString(),
          appointmentDate: futureMonday,
          timeSlot: { startTime: '09:00', endTime: '09:15' },
        },
      };
      const res = createMockRes();
      await runWithAuth(req, res, createAppointment, 'PATIENT');
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
    });

    await test('Staff role is rejected with 403 when attempting patient booking', async () => {
      const req = {
        headers: { authorization: `Bearer ${tokenStaff}` },
        body: {
          doctorId: doctor1._id.toString(),
          appointmentDate: futureMonday,
          timeSlot: { startTime: '09:00', endTime: '09:15' },
        },
      };
      const res = createMockRes();
      await runWithAuth(req, res, createAppointment, 'PATIENT');
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
    });

    await test('Booking for past date is rejected with 400', async () => {
      const req = {
        headers: { authorization: `Bearer ${tokenPatient1}` },
        body: {
          doctorId: doctor1._id.toString(),
          appointmentDate: '2021-05-10',
          timeSlot: { startTime: '09:00', endTime: '09:15' },
        },
      };
      const res = createMockRes();
      await runWithAuth(req, res, createAppointment, 'PATIENT');
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /past dates is not permitted/i);
    });

    await test('Booking on off-duty day is rejected with 400', async () => {
      const req = {
        headers: { authorization: `Bearer ${tokenPatient1}` },
        body: {
          doctorId: doctor1._id.toString(),
          appointmentDate: futureTuesday,
          timeSlot: { startTime: '09:00', endTime: '09:15' },
        },
      };
      const res = createMockRes();
      await runWithAuth(req, res, createAppointment, 'PATIENT');
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /does not work on this day/i);
    });

    await test('Booking slot inside break time is rejected with 400', async () => {
      const req = {
        headers: { authorization: `Bearer ${tokenPatient1}` },
        body: {
          doctorId: doctor1._id.toString(),
          appointmentDate: futureMonday,
          timeSlot: { startTime: '10:30', endTime: '10:45' },
        },
      };
      const res = createMockRes();
      await runWithAuth(req, res, createAppointment, 'PATIENT');
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /falls in a break/i);
    });

    let bookedAppointmentId = null;

    await test('Patient 1 successfully books valid slot (09:00 - 09:15)', async () => {
      const req = {
        headers: { authorization: `Bearer ${tokenPatient1}` },
        body: {
          doctorId: doctor1._id.toString(),
          appointmentDate: futureMonday,
          timeSlot: { startTime: '09:00', endTime: '09:15' },
        },
      };
      const res = createMockRes();
      await runWithAuth(req, res, createAppointment, 'PATIENT');
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.appointment.status, 'BOOKED');
      assert.strictEqual(res.body.appointment.doctorName, 'Dr. Evelyn Reed');
      assert.strictEqual(res.body.appointment.clinicName, 'Sunrise Healthcare Clinic');

      bookedAppointmentId = res.body.appointment._id.toString();

      // Verify availability now reflects slot as booked
      const availReq = {
        params: { id: doctor1._id.toString() },
        query: { date: futureMonday },
      };
      const availRes = createMockRes();
      await getDoctorAvailability(availReq, availRes, () => {});
      const hasSlot = availRes.body.availableSlots.some((s) => s.startTime === '09:00');
      assert.strictEqual(hasSlot, false, 'Booked slot must no longer be available');
    });

    // ====================================================================
    // TEST GROUP 3: DUPLICATE & CONFLICT PROTECTION
    // ====================================================================
    console.log('\n--- 3. DUPLICATE & CONFLICT PROTECTION ---');

    await test('Another patient (Patient 2) booking the same slot is rejected with 409 Conflict', async () => {
      const req = {
        headers: { authorization: `Bearer ${tokenPatient2}` },
        body: {
          doctorId: doctor1._id.toString(),
          appointmentDate: futureMonday,
          timeSlot: { startTime: '09:00', endTime: '09:15' },
        },
      };
      const res = createMockRes();
      await runWithAuth(req, res, createAppointment, 'PATIENT');
      assert.strictEqual(res.statusCode, 409);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /already booked/i);
    });

    await test('Patient 1 booking a duplicate appointment at the same date and time is rejected with 409', async () => {
      const req = {
        headers: { authorization: `Bearer ${tokenPatient1}` },
        body: {
          doctorId: doctor1._id.toString(),
          appointmentDate: futureMonday,
          timeSlot: { startTime: '09:00', endTime: '09:15' },
        },
      };
      const res = createMockRes();
      await runWithAuth(req, res, createAppointment, 'PATIENT');
      assert.strictEqual(res.statusCode, 409);
      assert.strictEqual(res.body.success, false);
    });

    // ====================================================================
    // TEST GROUP 4: CANCELLATION, AUTHORIZATION & SLOT REOPENING
    // ====================================================================
    console.log('\n--- 4. CANCELLATION, AUTHORIZATION & SLOT REOPENING ---');

    await test('Patient 2 is rejected with 403 when trying to cancel Patient 1 appointment', async () => {
      const req = {
        headers: { authorization: `Bearer ${tokenPatient2}` },
        params: { id: bookedAppointmentId },
        body: { cancellationReason: 'Malicious cancellation attempt' },
      };
      const res = createMockRes();
      await runWithAuth(req, res, cancelAppointment, null);
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /Unauthorized to cancel this appointment/i);

      // Verify status is still BOOKED
      const appt = await Appointment.findById(bookedAppointmentId);
      assert.strictEqual(appt.status, 'BOOKED');
    });

    await test('Patient 1 cancels their own appointment successfully and records timestamp', async () => {
      const req = {
        headers: { authorization: `Bearer ${tokenPatient1}` },
        params: { id: bookedAppointmentId },
        body: { cancellationReason: 'Change of schedule' },
      };
      const res = createMockRes();
      await runWithAuth(req, res, cancelAppointment, null);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.appointment.status, 'CANCELLED');

      const appt = await Appointment.findById(bookedAppointmentId);
      assert.strictEqual(appt.status, 'CANCELLED');
      assert.ok(appt.cancelledAt instanceof Date, 'cancelledAt date must be recorded');
      assert.strictEqual(appt.cancellationReason, 'Change of schedule');
    });

    await test('Cancelled slot (09:00 - 09:15) is reopened in doctor availability', async () => {
      const req = {
        params: { id: doctor1._id.toString() },
        query: { date: futureMonday },
      };
      const res = createMockRes();
      await getDoctorAvailability(req, res, () => {});
      assert.strictEqual(res.statusCode, 200);
      const slot = res.body.availableSlots.find(
        (s) => s.startTime === '09:00' && s.endTime === '09:15'
      );
      assert.ok(slot, 'Cancelled slot must be reopened and available again');
    });

    await test('Patient 2 can now successfully rebook the reopened slot', async () => {
      const req = {
        headers: { authorization: `Bearer ${tokenPatient2}` },
        body: {
          doctorId: doctor1._id.toString(),
          appointmentDate: futureMonday,
          timeSlot: { startTime: '09:00', endTime: '09:15' },
        },
      };
      const res = createMockRes();
      await runWithAuth(req, res, createAppointment, 'PATIENT');
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.appointment.status, 'BOOKED');
      assert.notStrictEqual(res.body.appointment._id.toString(), bookedAppointmentId);
    });

    // ====================================================================
    // TEST GROUP 5: PATIENT APPOINTMENTS LIST & ACCESS PRIVACY
    // ====================================================================
    console.log('\n--- 5. PATIENT APPOINTMENTS PRIVACY & GET-BY-ID ---');

    await test('Patient 1 retrieves only their own appointments via getMyAppointments', async () => {
      const req = {
        headers: { authorization: `Bearer ${tokenPatient1}` },
        query: {},
      };
      const res = createMockRes();
      await runWithAuth(req, res, getMyAppointments, 'PATIENT');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      // Patient 1 has 1 cancelled appointment
      assert.strictEqual(res.body.appointments.length, 1);
      assert.strictEqual(res.body.appointments[0].status, 'CANCELLED');
    });

    await test('Patient 2 retrieves only their own appointments via getMyAppointments', async () => {
      const req = {
        headers: { authorization: `Bearer ${tokenPatient2}` },
        query: {},
      };
      const res = createMockRes();
      await runWithAuth(req, res, getMyAppointments, 'PATIENT');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      // Patient 2 has 1 active booked appointment
      assert.strictEqual(res.body.appointments.length, 1);
      assert.strictEqual(res.body.appointments[0].status, 'BOOKED');
    });

    await test('Patient 1 cannot inspect Patient 2 appointment via getAppointmentById (403)', async () => {
      // Find Patient 2's appointment
      const p2Appt = await Appointment.findOne({ patientId: patient2._id, status: 'BOOKED' });
      assert.ok(p2Appt);

      const req = {
        headers: { authorization: `Bearer ${tokenPatient1}` },
        params: { id: p2Appt._id.toString() },
      };
      const res = createMockRes();
      await runWithAuth(req, res, getAppointmentById, null);
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /Unauthorized to view this appointment/i);
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
  console.error('Unhandled test suite failure:', err);
  process.exit(1);
});
