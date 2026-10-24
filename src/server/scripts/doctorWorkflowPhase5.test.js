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
  getDoctorAppointments,
  getAppointmentById,
  cancelAppointment,
} from '../controllers/appointmentController.js';
import {
  getDoctorSchedule,
  getDoctorScheduleSelf,
  updateScheduleSelf,
} from '../controllers/scheduleController.js';
import { getDoctorById } from '../controllers/doctorController.js';
import { generateToken } from '../utils/jwt.js';

process.env.JWT_SECRET = 'test-jwt-secret-qflow-phase5-doctor-workflow-99999';
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

// Executes an Express controller through protect + authorize(role)
async function runWithAuth(req, res, handler, requiredRole = 'DOCTOR') {
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

// Helper to get formatted date string in Asia/Kolkata
function getTodayIST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function getOffsetDate(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

async function runTestSuite() {
  console.log('======================================================================');
  console.log('  QFlow — Phase 5: Complete Doctor Workflow Test Suite');
  console.log('  Verifying Doctor Authentication, Appointments, Isolation, and Schedules');
  console.log('======================================================================\n');

  let replSet;
  let testCount = 0;
  let passedCount = 0;

  function recordPass(testName) {
    testCount++;
    passedCount++;
    console.log(`  [PASS ${testCount}] ${testName}`);
  }

  function recordFail(testName, err) {
    testCount++;
    console.error(`  [FAIL ${testCount}] ${testName}`);
    console.error(`     Error: ${err.message}`);
  }

  try {
    console.log('1. Starting isolated in-memory MongoMemoryReplSet...');
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    const uri = replSet.getUri();
    await mongoose.connect(uri);
    console.log('   Connected to in-memory MongoDB replica set successfully.\n');

    // ------------------------------------------------------------------
    // Seed Fixtures: Clinics, Specialties, Doctors, Users, Patients
    // ------------------------------------------------------------------
    console.log('2. Provisioning Test Data Fixtures...');

    const adminUser = await User.create({
      fullName: 'Clinic Admin User',
      email: 'admin.fixture@qflow.test',
      phone: '9000000000',
      role: 'ADMIN',
      password: 'password123',
      isActive: true,
    });

    const clinicA = await Clinic.create({
      name: 'QFlow Apollo Heart Center',
      code: 'APO-01',
      address: { street: '100 Medical Boulevard', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
      phone: '9876543210',
      email: 'apollo@qflow.test',
      adminId: adminUser._id,
      isActive: true,
      location: { type: 'Point', coordinates: [80.25, 13.05] },
    });

    const clinicB = await Clinic.create({
      name: 'QFlow Fortis Care Clinic',
      code: 'FOR-01',
      address: { street: '50 Health Avenue', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
      phone: '9876543211',
      email: 'fortis@qflow.test',
      adminId: adminUser._id,
      isActive: true,
      location: { type: 'Point', coordinates: [77.59, 12.97] },
    });

    const cardioSpecialty = await Specialty.create({
      name: 'Cardiology',
      code: 'CARD-01',
      description: 'Cardiac and vascular care',
      isActive: true,
    });

    const neuroSpecialty = await Specialty.create({
      name: 'Neurology',
      code: 'NEUR-01',
      description: 'Neurological care',
      isActive: true,
    });

    // Doctor A: Dr. Rajesh Sharma (Cardiology @ Clinic A)
    const doctorUserA = await User.create({
      fullName: 'Dr. Rajesh Sharma',
      email: 'dr.sharma@qflow.test',
      phone: '9111111111',
      role: 'DOCTOR',
      password: 'password123',
      isActive: true,
    });
    const doctorA = await Doctor.create({
      userId: doctorUserA._id,
      clinicId: clinicA._id,
      specialtyId: cardioSpecialty._id,
      fullName: 'Rajesh Sharma',
      gender: 'MALE',
      qualifications: ['MBBS', 'MD - Cardiology'],
      experienceYears: 14,
      consultationFee: 750,
      averageConsultationDurationMinutes: 15,
      isActive: true,
    });

    // Doctor B: Dr. Priya Patel (Neurology @ Clinic B)
    const doctorUserB = await User.create({
      fullName: 'Dr. Priya Patel',
      email: 'dr.patel@qflow.test',
      phone: '9222222222',
      role: 'DOCTOR',
      password: 'password123',
      isActive: true,
    });
    const doctorB = await Doctor.create({
      userId: doctorUserB._id,
      clinicId: clinicB._id,
      specialtyId: neuroSpecialty._id,
      fullName: 'Priya Patel',
      gender: 'FEMALE',
      qualifications: ['MBBS', 'DM - Neurology'],
      experienceYears: 10,
      consultationFee: 900,
      averageConsultationDurationMinutes: 20,
      isActive: true,
    });

    // Patient User
    const patientUser = await User.create({
      fullName: 'Ananya Rao',
      email: 'ananya@qflow.test',
      phone: '9333333333',
      role: 'PATIENT',
      password: 'password123',
      isActive: true,
    });
    const patient = await Patient.create({
      userId: patientUser._id,
      fullName: 'Ananya Rao',
      phone: '9333333333',
      gender: 'FEMALE',
      dateOfBirth: new Date('1992-06-15'),
      location: { type: 'Point', coordinates: [80.24, 13.04] },
    });

    // Staff User
    const staffUser = await User.create({
      fullName: 'Receptionist Suman',
      email: 'suman@qflow.test',
      phone: '9444444444',
      role: 'STAFF',
      password: 'password123',
      isActive: true,
    });
    await Staff.create({
      userId: staffUser._id,
      clinicId: clinicA._id,
      fullName: 'Receptionist Suman',
      phone: '9444444444',
      role: 'RECEPTIONIST',
      isActive: true,
    });

    // Schedules
    await DoctorSchedule.create({
      doctorId: doctorA._id,
      clinicId: clinicA._id,
      weeklyHours: [
        {
          dayOfWeek: 'MONDAY',
          isWorkingDay: true,
          shifts: [{ startTime: '09:00', endTime: '13:00' }],
          breaks: [],
        },
        {
          dayOfWeek: 'TUESDAY',
          isWorkingDay: true,
          shifts: [{ startTime: '09:00', endTime: '13:00' }],
          breaks: [],
        },
        {
          dayOfWeek: 'WEDNESDAY',
          isWorkingDay: true,
          shifts: [{ startTime: '09:00', endTime: '13:00' }],
          breaks: [],
        },
        {
          dayOfWeek: 'THURSDAY',
          isWorkingDay: true,
          shifts: [{ startTime: '09:00', endTime: '13:00' }],
          breaks: [],
        },
        {
          dayOfWeek: 'FRIDAY',
          isWorkingDay: true,
          shifts: [{ startTime: '09:00', endTime: '13:00' }],
          breaks: [],
        },
        {
          dayOfWeek: 'SATURDAY',
          isWorkingDay: false,
          shifts: [],
          breaks: [],
        },
        {
          dayOfWeek: 'SUNDAY',
          isWorkingDay: false,
          shifts: [],
          breaks: [],
        },
      ],
      isActive: true,
    });

    const tokenDoctorA = generateToken({ id: doctorUserA._id, role: 'DOCTOR' });
    const tokenDoctorB = generateToken({ id: doctorUserB._id, role: 'DOCTOR' });
    const tokenPatient = generateToken({ id: patientUser._id, role: 'PATIENT' });
    const tokenStaff = generateToken({ id: staffUser._id, role: 'STAFF' });

    const todayStr = getTodayIST();
    const upcomingStr = getOffsetDate(5);
    const pastStr = getOffsetDate(-3);

    // Appointments for Doctor A
    const apptA1_Today = await Appointment.create({
      patientId: patient._id,
      doctorId: doctorA._id,
      clinicId: clinicA._id,
      specialtyId: cardioSpecialty._id,
      appointmentDate: todayStr,
      timeSlot: { startTime: '09:00', endTime: '09:15' },
      status: 'BOOKED',
    });

    const apptA2_Upcoming = await Appointment.create({
      patientId: patient._id,
      doctorId: doctorA._id,
      clinicId: clinicA._id,
      specialtyId: cardioSpecialty._id,
      appointmentDate: upcomingStr,
      timeSlot: { startTime: '10:00', endTime: '10:15' },
      status: 'BOOKED',
    });

    const apptA3_Past = await Appointment.create({
      patientId: patient._id,
      doctorId: doctorA._id,
      clinicId: clinicA._id,
      specialtyId: cardioSpecialty._id,
      appointmentDate: pastStr,
      timeSlot: { startTime: '11:00', endTime: '11:15' },
      status: 'COMPLETED',
    });

    // Appointments for Doctor B
    const apptB1_Today = await Appointment.create({
      patientId: patient._id,
      doctorId: doctorB._id,
      clinicId: clinicB._id,
      specialtyId: neuroSpecialty._id,
      appointmentDate: todayStr,
      timeSlot: { startTime: '10:00', endTime: '10:20' },
      status: 'BOOKED',
    });

    const apptB2_Upcoming = await Appointment.create({
      patientId: patient._id,
      doctorId: doctorB._id,
      clinicId: clinicB._id,
      specialtyId: neuroSpecialty._id,
      appointmentDate: upcomingStr,
      timeSlot: { startTime: '11:00', endTime: '11:20' },
      status: 'BOOKED',
    });

    console.log('   Data fixtures successfully created.\n');

    // ------------------------------------------------------------------
    // TEST SECTION 1: Doctor Authentication & Role Authorization
    // ------------------------------------------------------------------
    console.log('3. Running Section 1: Doctor Authentication & Role Authorization...');

    // Test 1: Unauthenticated request to GET /api/doctors/me/appointments fails (401)
    try {
      const req = { headers: {} };
      const res = createMockRes();
      await runWithAuth(req, res, getDoctorAppointments, 'DOCTOR');
      assert.strictEqual(res.statusCode, 401, 'Should reject with 401');
      assert.match(res.body.message, /no authentication token/i);
      recordPass('Unauthenticated request to doctor appointments is rejected with 401');
    } catch (err) {
      recordFail('Unauthenticated request to doctor appointments is rejected with 401', err);
    }

    // Test 2: PATIENT token cannot access GET /api/doctors/me/appointments (403)
    try {
      const req = { headers: { authorization: `Bearer ${tokenPatient}` } };
      const res = createMockRes();
      await runWithAuth(req, res, getDoctorAppointments, 'DOCTOR');
      assert.strictEqual(res.statusCode, 403, 'Should reject with 403');
      assert.match(res.body.message, /not authorized to access this resource/i);
      recordPass('PATIENT role is forbidden from accessing doctor appointments (403)');
    } catch (err) {
      recordFail('PATIENT role is forbidden from accessing doctor appointments (403)', err);
    }

    // Test 3: STAFF token cannot access GET /api/doctors/me/appointments (403)
    try {
      const req = { headers: { authorization: `Bearer ${tokenStaff}` } };
      const res = createMockRes();
      await runWithAuth(req, res, getDoctorAppointments, 'DOCTOR');
      assert.strictEqual(res.statusCode, 403, 'Should reject with 403');
      assert.match(res.body.message, /not authorized to access this resource/i);
      recordPass('STAFF role is forbidden from accessing doctor appointments (403)');
    } catch (err) {
      recordFail('STAFF role is forbidden from accessing doctor appointments (403)', err);
    }

    // Test 4: PATIENT token cannot access PUT /api/doctors/me/schedule (403)
    try {
      const req = {
        headers: { authorization: `Bearer ${tokenPatient}` },
        body: { weeklyHours: [] },
      };
      const res = createMockRes();
      await runWithAuth(req, res, updateScheduleSelf, 'DOCTOR');
      assert.strictEqual(res.statusCode, 403, 'Should reject with 403');
      recordPass('PATIENT role is forbidden from updating doctor schedule (403)');
    } catch (err) {
      recordFail('PATIENT role is forbidden from updating doctor schedule (403)', err);
    }

    // Test 5: Authenticated DOCTOR token succeeds on GET /api/doctors/me/appointments (200)
    try {
      const req = {
        headers: { authorization: `Bearer ${tokenDoctorA}` },
        query: {},
      };
      const res = createMockRes();
      await runWithAuth(req, res, getDoctorAppointments, 'DOCTOR');
      assert.strictEqual(res.statusCode, 200, 'Should respond with 200');
      assert.strictEqual(res.body.success, true);
      recordPass('DOCTOR role successfully accesses own appointments endpoint (200)');
    } catch (err) {
      recordFail('DOCTOR role successfully accesses own appointments endpoint (200)', err);
    }

    // ------------------------------------------------------------------
    // TEST SECTION 2: Doctor Own-Appointment Data Isolation
    // ------------------------------------------------------------------
    console.log('\n4. Running Section 2: Own-Appointment Data Isolation...');

    // Test 6: Doctor A receives ONLY their own appointments (3 total)
    try {
      const req = {
        headers: { authorization: `Bearer ${tokenDoctorA}` },
        query: {},
      };
      const res = createMockRes();
      await runWithAuth(req, res, getDoctorAppointments, 'DOCTOR');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.count, 3, 'Doctor A should have exactly 3 appointments');
      const allBelongToDoctorA = res.body.appointments.every(
        (a) => a.doctorId.toString() === doctorA._id.toString()
      );
      assert.strictEqual(allBelongToDoctorA, true, "All appointments must belong to Doctor A's doctorId");
      recordPass("Doctor A query returns strictly Doctor A's 3 appointments (0 of Doctor B's)");
    } catch (err) {
      recordFail("Doctor A query returns strictly Doctor A's 3 appointments (0 of Doctor B's)", err);
    }

    // Test 7: Doctor B receives ONLY their own appointments (2 total)
    try {
      const req = {
        headers: { authorization: `Bearer ${tokenDoctorB}` },
        query: {},
      };
      const res = createMockRes();
      await runWithAuth(req, res, getDoctorAppointments, 'DOCTOR');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.count, 2, 'Doctor B should have exactly 2 appointments');
      const allBelongToDoctorB = res.body.appointments.every(
        (a) => a.doctorId.toString() === doctorB._id.toString()
      );
      assert.strictEqual(allBelongToDoctorB, true, "All appointments must belong to Doctor B's doctorId");
      recordPass("Doctor B query returns strictly Doctor B's 2 appointments (0 of Doctor A's)");
    } catch (err) {
      recordFail("Doctor B query returns strictly Doctor B's 2 appointments (0 of Doctor A's)", err);
    }

    // Test 8: Patient information and clinic context are properly populated
    try {
      const req = {
        headers: { authorization: `Bearer ${tokenDoctorA}` },
        query: {},
      };
      const res = createMockRes();
      await runWithAuth(req, res, getDoctorAppointments, 'DOCTOR');
      const first = res.body.appointments[0];
      assert.ok(first.patientId, 'patientId should be populated');
      assert.strictEqual(first.patientId.fullName, 'Ananya Rao');
      assert.strictEqual(first.patientId.gender, 'FEMALE');
      assert.ok(first.patientId.phone, 'Patient phone must be populated for clinical contact');
      assert.ok(first.patientId.dateOfBirth, 'Patient dateOfBirth must be populated for age calculation');
      assert.ok(first.clinicId, 'clinicId should be populated');
      assert.strictEqual(first.clinicId.name, 'QFlow Apollo Heart Center');
      recordPass('Doctor appointments view populates patient details (name, phone, gender, DOB) & clinic');
    } catch (err) {
      recordFail('Doctor appointments view populates patient details (name, phone, gender, DOB) & clinic', err);
    }

    // ------------------------------------------------------------------
    // TEST SECTION 3: Appointment Scoping (Today, Upcoming, Past, Exact Date)
    // ------------------------------------------------------------------
    console.log('\n5. Running Section 3: Appointment Scoping & Filters...');

    // Test 9: scope=today returns only today's appointments for Doctor A
    try {
      const req = {
        headers: { authorization: `Bearer ${tokenDoctorA}` },
        query: { scope: 'today' },
      };
      const res = createMockRes();
      await runWithAuth(req, res, getDoctorAppointments, 'DOCTOR');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.count, 1, "Should return 1 appointment for today's scope");
      assert.strictEqual(res.body.appointments[0]._id.toString(), apptA1_Today._id.toString());
      assert.strictEqual(res.body.appointments[0].appointmentDate, todayStr);
      recordPass('scope=today correctly filters appointments for current calendar date in Asia/Kolkata');
    } catch (err) {
      recordFail('scope=today correctly filters appointments for current calendar date in Asia/Kolkata', err);
    }

    // Test 10: scope=upcoming returns today + future appointments (>= today)
    try {
      const req = {
        headers: { authorization: `Bearer ${tokenDoctorA}` },
        query: { scope: 'upcoming' },
      };
      const res = createMockRes();
      await runWithAuth(req, res, getDoctorAppointments, 'DOCTOR');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.count, 2, 'Should return 2 appointments (today and upcoming)');
      const dates = res.body.appointments.map((a) => a.appointmentDate);
      assert.ok(dates.includes(todayStr), 'Must include today');
      assert.ok(dates.includes(upcomingStr), 'Must include future date');
      recordPass('scope=upcoming correctly filters upcoming appointments (>= today)');
    } catch (err) {
      recordFail('scope=upcoming correctly filters upcoming appointments (>= today)', err);
    }

    // Test 11: scope=past returns historical appointments (< today) sorted descending
    try {
      const req = {
        headers: { authorization: `Bearer ${tokenDoctorA}` },
        query: { scope: 'past' },
      };
      const res = createMockRes();
      await runWithAuth(req, res, getDoctorAppointments, 'DOCTOR');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.count, 1, 'Should return 1 past appointment');
      assert.strictEqual(res.body.appointments[0]._id.toString(), apptA3_Past._id.toString());
      assert.strictEqual(res.body.appointments[0].appointmentDate, pastStr);
      recordPass('scope=past correctly filters past appointments (< today)');
    } catch (err) {
      recordFail('scope=past correctly filters past appointments (< today)', err);
    }

    // Test 12: explicit date query returns exact matching appointments
    try {
      const req = {
        headers: { authorization: `Bearer ${tokenDoctorA}` },
        query: { date: upcomingStr },
      };
      const res = createMockRes();
      await runWithAuth(req, res, getDoctorAppointments, 'DOCTOR');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.count, 1);
      assert.strictEqual(res.body.appointments[0].appointmentDate, upcomingStr);
      recordPass('date=YYYY-MM-DD parameter returns exact appointments for that date');
    } catch (err) {
      recordFail('date=YYYY-MM-DD parameter returns exact appointments for that date', err);
    }

    // ------------------------------------------------------------------
    // TEST SECTION 4: Cross-Doctor Action Isolation & Cancellation
    // ------------------------------------------------------------------
    console.log('\n6. Running Section 4: Cross-Doctor Action Isolation & Cancellation...');

    // Test 13: Doctor A cannot view Doctor B's appointment via getAppointmentById (403)
    try {
      const req = {
        headers: { authorization: `Bearer ${tokenDoctorA}` },
        params: { id: apptB1_Today._id.toString() },
      };
      const res = createMockRes();
      await runWithAuth(req, res, getAppointmentById, 'DOCTOR');
      assert.strictEqual(res.statusCode, 403, 'Should reject with 403');
      assert.match(res.body.message, /unauthorized to view this appointment/i);
      recordPass("Doctor A is blocked from viewing Doctor B's appointment (403 Forbidden)");
    } catch (err) {
      recordFail("Doctor A is blocked from viewing Doctor B's appointment (403 Forbidden)", err);
    }

    // Test 14: Doctor A can view their own appointment via getAppointmentById (200)
    try {
      const req = {
        headers: { authorization: `Bearer ${tokenDoctorA}` },
        params: { id: apptA1_Today._id.toString() },
      };
      const res = createMockRes();
      await runWithAuth(req, res, getAppointmentById, 'DOCTOR');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.appointment._id.toString(), apptA1_Today._id.toString());
      assert.strictEqual(res.body.appointment.patientId.fullName, 'Ananya Rao');
      recordPass("Doctor A can view their own appointment with full patient details (200 OK)");
    } catch (err) {
      recordFail("Doctor A can view their own appointment with full patient details (200 OK)", err);
    }

    // Test 15: Doctor A cannot cancel Doctor B's appointment (403)
    try {
      const req = {
        headers: { authorization: `Bearer ${tokenDoctorA}` },
        params: { id: apptB1_Today._id.toString() },
        body: { cancellationReason: 'Doctor emergency' },
      };
      const res = createMockRes();
      await runWithAuth(req, res, cancelAppointment, 'DOCTOR');
      assert.strictEqual(res.statusCode, 403, 'Should reject with 403');
      assert.match(res.body.message, /Doctor cannot cancel appointments for other doctors/i);
      recordPass("Doctor A cannot cancel Doctor B's appointment (403 Forbidden)");
    } catch (err) {
      recordFail("Doctor A cannot cancel Doctor B's appointment (403 Forbidden)", err);
    }

    // Test 16: Doctor A cancels their own appointment successfully (200)
    try {
      const req = {
        headers: { authorization: `Bearer ${tokenDoctorA}` },
        params: { id: apptA2_Upcoming._id.toString() },
        body: { cancellationReason: 'Doctor scheduled emergency cardiac surgery' },
      };
      const res = createMockRes();
      await runWithAuth(req, res, cancelAppointment, 'DOCTOR');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.appointment.status, 'CANCELLED');
      assert.strictEqual(res.body.appointment.cancellationReason, 'Doctor scheduled emergency cardiac surgery');
      assert.ok(res.body.appointment.cancelledAt, 'cancelledAt timestamp must be recorded');
      recordPass('Doctor A cancels own appointment with cancellation reason and timestamp (200 OK)');
    } catch (err) {
      recordFail('Doctor A cancels own appointment with cancellation reason and timestamp (200 OK)', err);
    }

    // Test 17: Doctor A cannot cancel an already cancelled appointment (400)
    try {
      const req = {
        headers: { authorization: `Bearer ${tokenDoctorA}` },
        params: { id: apptA2_Upcoming._id.toString() },
        body: { cancellationReason: 'Attempting second cancel' },
      };
      const res = createMockRes();
      await runWithAuth(req, res, cancelAppointment, 'DOCTOR');
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.body.message, /currently in 'CANCELLED' status/i);
      recordPass('Cancellation is rejected if appointment is already CANCELLED (400 Bad Request)');
    } catch (err) {
      recordFail('Cancellation is rejected if appointment is already CANCELLED (400 Bad Request)', err);
    }

    // ------------------------------------------------------------------
    // TEST SECTION 5: Doctor Self-Service Schedule & Duration Management
    // ------------------------------------------------------------------
    console.log('\n7. Running Section 5: Doctor Self-Service Schedule & Duration Management...');

    // Test 18: GET /api/doctors/me/schedule returns doctor's active schedule and duration
    try {
      const req = {
        headers: { authorization: `Bearer ${tokenDoctorA}` },
      };
      const res = createMockRes();
      await runWithAuth(req, res, getDoctorScheduleSelf, 'DOCTOR');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.schedule, 'Should return active schedule');
      assert.strictEqual(res.body.doctor.fullName, 'Rajesh Sharma');
      assert.strictEqual(res.body.doctor.averageConsultationDurationMinutes, 15);
      recordPass('GET /api/doctors/me/schedule returns current schedule and consultation duration');
    } catch (err) {
      recordFail('GET /api/doctors/me/schedule returns current schedule and consultation duration', err);
    }

    // Test 19: Doctor updates own schedule shifts and consultation duration (200)
    try {
      const updatedHours = [
        {
          dayOfWeek: 'MONDAY',
          isWorkingDay: true,
          shifts: [
            { startTime: '09:00', endTime: '13:00' },
            { startTime: '16:00', endTime: '20:00' },
          ],
          breaks: [],
        },
        {
          dayOfWeek: 'TUESDAY',
          isWorkingDay: true,
          shifts: [{ startTime: '09:00', endTime: '13:00' }],
          breaks: [],
        },
        {
          dayOfWeek: 'WEDNESDAY',
          isWorkingDay: true,
          shifts: [{ startTime: '09:00', endTime: '13:00' }],
          breaks: [],
        },
        {
          dayOfWeek: 'THURSDAY',
          isWorkingDay: true,
          shifts: [{ startTime: '09:00', endTime: '13:00' }],
          breaks: [],
        },
        {
          dayOfWeek: 'FRIDAY',
          isWorkingDay: true,
          shifts: [{ startTime: '09:00', endTime: '13:00' }],
          breaks: [],
        },
        {
          dayOfWeek: 'SATURDAY',
          isWorkingDay: true,
          shifts: [{ startTime: '10:00', endTime: '14:00' }],
          breaks: [],
        },
        {
          dayOfWeek: 'SUNDAY',
          isWorkingDay: false,
          shifts: [],
          breaks: [],
        },
      ];

      const req = {
        headers: { authorization: `Bearer ${tokenDoctorA}` },
        body: {
          weeklyHours: updatedHours,
          averageConsultationDurationMinutes: 25,
        },
      };
      const res = createMockRes();
      await runWithAuth(req, res, updateScheduleSelf, 'DOCTOR');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.doctor.averageConsultationDurationMinutes, 25);

      // Verify persistence in database
      const reloadedDoc = await Doctor.findById(doctorA._id);
      assert.strictEqual(reloadedDoc.averageConsultationDurationMinutes, 25);

      const reloadedSchedule = await DoctorSchedule.findOne({ doctorId: doctorA._id, isActive: true });
      const sat = reloadedSchedule.weeklyHours.find((d) => d.dayOfWeek === 'SATURDAY');
      assert.strictEqual(sat.isWorkingDay, true);
      assert.strictEqual(sat.shifts[0].startTime, '10:00');
      recordPass('PUT /api/doctors/me/schedule updates shifts, working days, and duration (200 OK)');
    } catch (err) {
      recordFail('PUT /api/doctors/me/schedule updates shifts, working days, and duration (200 OK)', err);
    }

    // Test 20: Schedule update with invalid shift time (startTime >= endTime) fails (400)
    try {
      const invalidHours = [
        {
          dayOfWeek: 'MONDAY',
          isWorkingDay: true,
          shifts: [{ startTime: '14:00', endTime: '10:00' }], // End time earlier than start time!
          breaks: [],
        },
      ];
      const req = {
        headers: { authorization: `Bearer ${tokenDoctorA}` },
        body: { weeklyHours: invalidHours },
      };
      const res = createMockRes();
      await runWithAuth(req, res, updateScheduleSelf, 'DOCTOR');
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.body.message, /must be strictly earlier than end time/i);
      recordPass('PUT /api/doctors/me/schedule rejects invalid shift time intervals (400 Bad Request)');
    } catch (err) {
      recordFail('PUT /api/doctors/me/schedule rejects invalid shift time intervals (400 Bad Request)', err);
    }

    // Test 21: Schedule update with overlapping shifts fails (400)
    try {
      const overlappingHours = [
        {
          dayOfWeek: 'MONDAY',
          isWorkingDay: true,
          shifts: [
            { startTime: '09:00', endTime: '13:00' },
            { startTime: '12:00', endTime: '16:00' }, // Overlaps with 09:00-13:00
          ],
          breaks: [],
        },
      ];
      const req = {
        headers: { authorization: `Bearer ${tokenDoctorA}` },
        body: { weeklyHours: overlappingHours },
      };
      const res = createMockRes();
      await runWithAuth(req, res, updateScheduleSelf, 'DOCTOR');
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.body.message, /Overlapping shifts detected/i);
      recordPass('PUT /api/doctors/me/schedule rejects overlapping shift intervals (400 Bad Request)');
    } catch (err) {
      recordFail('PUT /api/doctors/me/schedule rejects overlapping shift intervals (400 Bad Request)', err);
    }

    // Test 22: Schedule update with invalid duration (< 1) fails (400)
    try {
      const req = {
        headers: { authorization: `Bearer ${tokenDoctorA}` },
        body: {
          weeklyHours: [
            {
              dayOfWeek: 'MONDAY',
              isWorkingDay: true,
              shifts: [{ startTime: '09:00', endTime: '13:00' }],
            },
          ],
          averageConsultationDurationMinutes: -5,
        },
      };
      const res = createMockRes();
      await runWithAuth(req, res, updateScheduleSelf, 'DOCTOR');
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.body.message, /must be a positive integer/i);
      recordPass('PUT /api/doctors/me/schedule rejects negative or zero consultation duration (400 Bad Request)');
    } catch (err) {
      recordFail('PUT /api/doctors/me/schedule rejects negative or zero consultation duration (400 Bad Request)', err);
    }

    // Test 23: Schedule changes immediately reflect in public getDoctorById & getDoctorSchedule
    try {
      const req = { params: { id: doctorA._id.toString() } };
      const res = createMockRes();
      await getDoctorById(req, res, () => {});
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.doctor.averageConsultationDurationMinutes, 25);
      assert.ok(res.body.doctor.workingDays.includes('SATURDAY'));
      recordPass('Updated doctor schedule & duration are immediately returned by getDoctorById');
    } catch (err) {
      recordFail('Updated doctor schedule & duration are immediately returned by getDoctorById', err);
    }

    // ------------------------------------------------------------------
    // Summary
    // ------------------------------------------------------------------
    console.log('\n======================================================================');
    console.log(`  Phase 5 Doctor Workflow Test Results: ${passedCount}/${testCount} Passed (${Math.round((passedCount / testCount) * 100)}%)`);
    console.log('======================================================================\n');

    if (passedCount !== testCount) {
      process.exit(1);
    }
  } catch (fatalErr) {
    console.error('Fatal error in test suite:', fatalErr);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (replSet) {
      await replSet.stop();
    }
  }
}

runTestSuite();
