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
import {
  getStaffAppointments,
  checkInAppointment,
} from '../controllers/appointmentController.js';
import {
  searchPatients,
  createWalkInPatient,
  registerWalkIn,
  getTodayQueue,
  callNextPatient,
  skipPatient,
  markNoShow,
  rejoinPatient,
  pauseQueue,
  resumeQueue,
  cancelQueueEntry,
  triageQueueEntry,
  transferQueueDoctor,
} from '../controllers/staffQueueController.js';
import {
  getClinics,
  getStaffListAdmin,
} from '../controllers/clinicController.js';
import {
  getDoctorSchedule,
  updateScheduleAdmin,
} from '../controllers/scheduleController.js';
import { generateToken } from '../utils/jwt.js';

process.env.JWT_SECRET = 'test-jwt-secret-qflow-phase6-staff-admin-88888';
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

// Executes an Express controller through protect + authorize(...roles)
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

async function runStaffAdminPhase6Tests() {
  console.log('======================================================================');
  console.log('  QFlow — Phase 6: Complete Staff & Admin Operations Test Suite');
  console.log('  Verifying Reception Operations, Check-In, Walk-In, Queue & Admin');
  console.log('======================================================================\n');

  let replSet;
  try {
    // 1. Strict safety check & in-memory database setup
    console.log('1. Starting isolated in-memory MongoMemoryReplSet...');
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    const uri = replSet.getUri();

    // Enforce safety invariant
    assert(
      uri.includes('127.0.0.1') || uri.includes('localhost'),
      'CRITICAL SAFETY GUARD: Must only connect to ephemeral in-memory replica set.'
    );
    assert(
      !uri.includes('mongodb.net'),
      'CRITICAL SAFETY GUARD: External/Atlas database connection forbidden.'
    );

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      family: 4,
    });
    console.log('   Connected to in-memory MongoDB replica set successfully.\n');

    // 2. Data fixtures provisioning
    console.log('2. Provisioning Test Data Fixtures...');

    // Users
    const adminUser = await User.create({
      fullName: 'Super Administrator',
      email: 'admin@qflow-test.org',
      password: 'Password123!',
      role: 'ADMIN',
      phone: '9000000001',
      isActive: true,
    });

    const staffUserA = await User.create({
      fullName: 'Receptionist Clinic A',
      email: 'staffA@qflow-test.org',
      password: 'Password123!',
      role: 'STAFF',
      phone: '9000000002',
      isActive: true,
    });

    const staffUserB = await User.create({
      fullName: 'Receptionist Clinic B',
      email: 'staffB@qflow-test.org',
      password: 'Password123!',
      role: 'STAFF',
      phone: '9000000003',
      isActive: true,
    });

    const doctorUserA = await User.create({
      fullName: 'Dr. Sarah Connor',
      email: 'sarah.connor@qflow-test.org',
      password: 'Password123!',
      role: 'DOCTOR',
      phone: '9000000004',
      isActive: true,
    });

    const doctorUserB = await User.create({
      fullName: 'Dr. Marcus Wright',
      email: 'marcus.wright@qflow-test.org',
      password: 'Password123!',
      role: 'DOCTOR',
      phone: '9000000005',
      isActive: true,
    });

    const doctorUserC = await User.create({
      fullName: 'Dr. Kyle Reese',
      email: 'kyle.reese@qflow-test.org',
      password: 'Password123!',
      role: 'DOCTOR',
      phone: '9000000006',
      isActive: true,
    });

    const patientUser1 = await User.create({
      fullName: 'John Connor',
      email: 'john.connor@qflow-test.org',
      password: 'Password123!',
      role: 'PATIENT',
      phone: '9000000007',
      isActive: true,
    });

    const patientUser2 = await User.create({
      fullName: 'Kate Brewster',
      email: 'kate.brewster@qflow-test.org',
      password: 'Password123!',
      role: 'PATIENT',
      phone: '9000000008',
      isActive: true,
    });

    // Specialty
    const specialty = await Specialty.create({
      name: 'Cardiology',
      code: 'CARD',
      description: 'Cardiac care',
    });

    // Clinics (Active Clinic A, Active Clinic B, Inactive Clinic C)
    const clinicA = await Clinic.create({
      name: 'Apex Health Center (Clinic A)',
      code: 'APEX-A',
      adminId: adminUser._id,
      address: {
        street: '100 Medical Blvd',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      phone: '08011112222',
      email: 'apex-a@qflow-test.org',
      isActive: true,
      queuePolicy: 'HYBRID',
    });

    const clinicB = await Clinic.create({
      name: 'Metro Care Clinic (Clinic B)',
      code: 'METRO-B',
      adminId: adminUser._id,
      address: {
        street: '200 Downtown Way',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560025',
      },
      location: { type: 'Point', coordinates: [77.6000, 12.9800] },
      phone: '08033334444',
      email: 'metro-b@qflow-test.org',
      isActive: true,
      queuePolicy: 'HYBRID',
    });

    const clinicC = await Clinic.create({
      name: 'Sunrise Clinic (Inactive)',
      code: 'SUN-C',
      adminId: adminUser._id,
      address: {
        street: '300 Sunset Rd',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560099',
      },
      location: { type: 'Point', coordinates: [77.6200, 12.9500] },
      phone: '08055556666',
      email: 'sun-c@qflow-test.org',
      isActive: false,
      queuePolicy: 'FIFO',
    });

    // Staff Records
    const staffRecordA = await Staff.create({
      userId: staffUserA._id,
      clinicId: clinicA._id,
      fullName: 'Receptionist Clinic A',
      phone: '9000000002',
    });

    const staffRecordB = await Staff.create({
      userId: staffUserB._id,
      clinicId: clinicB._id,
      fullName: 'Receptionist Clinic B',
      phone: '9000000003',
    });

    // Doctors (Dr. Sarah in Clinic A, Dr. Marcus in Clinic A [transfer target], Dr. Kyle in Clinic B)
    const doctorA = await Doctor.create({
      userId: doctorUserA._id,
      clinicId: clinicA._id,
      specialtyId: specialty._id,
      fullName: 'Dr. Sarah Connor',
      gender: 'FEMALE',
      qualifications: ['MBBS', 'MD Cardiology'],
      experienceYears: 12,
      consultationFee: 750,
      averageConsultationDurationMinutes: 15,
      isActive: true,
    });

    const doctorMarcus = await Doctor.create({
      userId: doctorUserB._id,
      clinicId: clinicA._id,
      specialtyId: specialty._id,
      fullName: 'Dr. Marcus Wright',
      gender: 'MALE',
      qualifications: ['MBBS', 'DNB'],
      experienceYears: 8,
      consultationFee: 600,
      averageConsultationDurationMinutes: 15,
      isActive: true,
    });

    const doctorB = await Doctor.create({
      userId: doctorUserC._id,
      clinicId: clinicB._id,
      specialtyId: specialty._id,
      fullName: 'Dr. Kyle Reese',
      gender: 'MALE',
      qualifications: ['MBBS', 'MS'],
      experienceYears: 10,
      consultationFee: 800,
      averageConsultationDurationMinutes: 15,
      isActive: true,
    });

    // Schedule for Doctor A
    const allDays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    await DoctorSchedule.create({
      doctorId: doctorA._id,
      clinicId: clinicA._id,
      isActive: true,
      weeklyHours: allDays.map((day) => ({
        dayOfWeek: day,
        isWorkingDay: true,
        shifts: [{ startTime: '08:00', endTime: '20:00' }],
        breaks: [{ startTime: '13:00', endTime: '14:00', label: 'Lunch' }],
      })),
    });

    // Schedule for Doctor Marcus
    await DoctorSchedule.create({
      doctorId: doctorMarcus._id,
      clinicId: clinicA._id,
      isActive: true,
      weeklyHours: allDays.map((day) => ({
        dayOfWeek: day,
        isWorkingDay: true,
        shifts: [{ startTime: '08:00', endTime: '20:00' }],
        breaks: [],
      })),
    });

    // Patient Profiles
    const patient1 = await Patient.create({
      userId: patientUser1._id,
      fullName: 'John Connor',
      phone: '9000000007',
      gender: 'MALE',
      dateOfBirth: '1985-02-28',
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
    });

    const patient2 = await Patient.create({
      userId: patientUser2._id,
      fullName: 'Kate Brewster',
      phone: '9000000008',
      gender: 'FEMALE',
      dateOfBirth: '1988-06-15',
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
    });

    const todayDate = getFormattedDateIST();
    const currentTime = getFormattedTimeIST();
    const [curHour, curMin] = currentTime.split(':').map(Number);
    // Align timeSlot to current hour so arrival check-in window (slotStart - 60 min to slotStart + 60 min) is valid
    const slotStartHour = curHour.toString().padStart(2, '0');
    const slotEndHour = (curHour + 1 > 23 ? 23 : curHour + 1).toString().padStart(2, '0');
    const validSlotTime = { startTime: `${slotStartHour}:00`, endTime: `${slotStartHour}:15` };

    // Appointments:
    // apptA1 in Clinic A (BOOKED, today, valid window)
    const apptA1 = await Appointment.create({
      clinicId: clinicA._id,
      doctorId: doctorA._id,
      patientId: patient1._id,
      specialtyId: specialty._id,
      appointmentDate: todayDate,
      timeSlot: validSlotTime,
      status: 'BOOKED',
    });

    // apptA2 in Clinic A (CANCELLED)
    const apptA2 = await Appointment.create({
      clinicId: clinicA._id,
      doctorId: doctorA._id,
      patientId: patient2._id,
      specialtyId: specialty._id,
      appointmentDate: todayDate,
      timeSlot: { startTime: `${slotStartHour}:15`, endTime: `${slotStartHour}:30` },
      status: 'CANCELLED',
      cancellationReason: 'Patient cancelled early',
    });

    // apptA3 in Clinic A (BOOKED, tomorrow - wrong date)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = getFormattedDateIST(tomorrow);
    const apptA3 = await Appointment.create({
      clinicId: clinicA._id,
      doctorId: doctorA._id,
      patientId: patient1._id,
      specialtyId: specialty._id,
      appointmentDate: tomorrowDate,
      timeSlot: { startTime: '10:00', endTime: '10:15' },
      status: 'BOOKED',
    });

    // apptB1 in Clinic B (BOOKED)
    const apptB1 = await Appointment.create({
      clinicId: clinicB._id,
      doctorId: doctorB._id,
      patientId: patient2._id,
      specialtyId: specialty._id,
      appointmentDate: todayDate,
      timeSlot: validSlotTime,
      status: 'BOOKED',
    });

    // JWT Tokens
    const adminToken = generateToken({ id: adminUser._id, role: adminUser.role });
    const staffTokenA = generateToken({ id: staffUserA._id, role: staffUserA.role });
    const staffTokenB = generateToken({ id: staffUserB._id, role: staffUserB.role });
    const doctorTokenA = generateToken({ id: doctorUserA._id, role: doctorUserA.role });
    const patientToken1 = generateToken({ id: patientUser1._id, role: patientUser1.role });

    console.log('   Data fixtures successfully created.\n');

    // ======================================================================
    // SECTION 1: Staff Authentication & Role Enforcement
    // ======================================================================
    console.log('3. Running Section 1: Staff Authentication & Role Enforcement...');

    // Test 1: Unauthenticated request rejected with 401
    {
      const req = { headers: {} };
      const res = createMockRes();
      await runWithAuth(req, res, getStaffAppointments, ['STAFF', 'ADMIN']);
      assert.strictEqual(res.statusCode, 401, 'Unauthenticated request must return 401');
      console.log('  [PASS 1] Unauthenticated request to staff appointments is rejected with 401');
    }

    // Test 2: PATIENT role rejected with 403
    {
      const req = { headers: { authorization: `Bearer ${patientToken1}` } };
      const res = createMockRes();
      await runWithAuth(req, res, getStaffAppointments, ['STAFF', 'ADMIN']);
      assert.strictEqual(res.statusCode, 403, 'PATIENT role must be rejected with 403');
      console.log('  [PASS 2] PATIENT role is forbidden from staff appointment lookup (403)');
    }

    // Test 3: DOCTOR role rejected with 403
    {
      const req = { headers: { authorization: `Bearer ${doctorTokenA}` } };
      const res = createMockRes();
      await runWithAuth(req, res, getStaffAppointments, ['STAFF', 'ADMIN']);
      assert.strictEqual(res.statusCode, 403, 'DOCTOR role must be rejected with 403');
      console.log('  [PASS 3] DOCTOR role is forbidden from staff appointment lookup (403)');
    }

    // Test 4: STAFF role accepted with 200
    {
      const req = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        query: {},
      };
      const res = createMockRes();
      await runWithAuth(req, res, getStaffAppointments, ['STAFF', 'ADMIN']);
      assert.strictEqual(res.statusCode, 200, 'STAFF role must be accepted with 200');
      assert.strictEqual(res.body.success, true);
      console.log('  [PASS 4] STAFF role successfully accesses staff appointments (200 OK)');
    }

    // ======================================================================
    // SECTION 2: Clinic Context Isolation
    // ======================================================================
    console.log('\n4. Running Section 2: Clinic Context Isolation...');

    // Test 5: Staff A only sees Clinic A appointments, even if query param clinicId is Clinic B
    {
      const req = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        query: { clinicId: clinicB._id.toString() }, // Staff A tries to tamper with query clinicId
      };
      const res = createMockRes();
      await runWithAuth(req, res, getStaffAppointments, ['STAFF', 'ADMIN']);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      const appts = res.body.appointments;
      assert(appts.length > 0, 'Must return Clinic A appointments');
      for (const a of appts) {
        assert.strictEqual(
          a.clinicId._id.toString(),
          clinicA._id.toString(),
          'Appointments returned to Staff A must strictly belong to Clinic A'
        );
      }
      console.log('  [PASS 5] Staff A queries appointments: strictly locked to assigned Clinic A');
    }

    // Test 6: Staff B only sees Clinic B appointments
    {
      const req = {
        headers: { authorization: `Bearer ${staffTokenB}` },
        query: {},
      };
      const res = createMockRes();
      await runWithAuth(req, res, getStaffAppointments, ['STAFF', 'ADMIN']);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      const appts = res.body.appointments;
      assert(appts.length > 0, 'Must return Clinic B appointments');
      for (const a of appts) {
        assert.strictEqual(
          a.clinicId._id.toString(),
          clinicB._id.toString(),
          'Appointments returned to Staff B must strictly belong to Clinic B'
        );
      }
      console.log('  [PASS 6] Staff B queries appointments: strictly locked to assigned Clinic B');
    }

    // Test 7: Staff A attempts to check in Clinic B appointment -> 403 Forbidden
    {
      const req = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        params: { id: apptB1._id.toString() },
      };
      const res = createMockRes();
      await runWithAuth(req, res, checkInAppointment, ['STAFF', 'ADMIN']);
      assert.strictEqual(res.statusCode, 403, 'Cross-clinic check-in must return 403');
      assert.strictEqual(res.body.success, false);
      assert(res.body.message.includes('outside assigned clinic'));
      console.log('  [PASS 7] Cross-clinic check-in attempt by staff is blocked with 403 Forbidden');
    }

    // Test 8: Staff A attempts to call next patient for Doctor B (Clinic B) -> 403 Forbidden
    {
      const req = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        body: { doctorId: doctorB._id.toString() },
      };
      const res = createMockRes();
      await runWithAuth(req, res, callNextPatient, ['STAFF', 'ADMIN', 'DOCTOR']);
      assert.strictEqual(res.statusCode, 403, 'Cross-clinic call next must return 403');
      assert.strictEqual(res.body.success, false);
      console.log('  [PASS 8] Cross-clinic queue operations are blocked with 403 Forbidden');
    }

    // ======================================================================
    // SECTION 3: Appointment Check-In Lifecycle & Concurrency
    // ======================================================================
    console.log('\n5. Running Section 3: Appointment Check-In Lifecycle & Concurrency...');

    // Test 9: Check-in on cancelled appointment is rejected with 400
    {
      const req = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        params: { id: apptA2._id.toString() },
      };
      const res = createMockRes();
      await runWithAuth(req, res, checkInAppointment, ['STAFF', 'ADMIN']);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert(res.body.message.includes('CANCELLED'));
      console.log('  [PASS 9] Check-in on CANCELLED appointment is rejected with 400 Bad Request');
    }

    // Test 10: Check-in on wrong date is rejected with 400
    {
      const req = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        params: { id: apptA3._id.toString() },
      };
      const res = createMockRes();
      await runWithAuth(req, res, checkInAppointment, ['STAFF', 'ADMIN']);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert(res.body.message.includes('scheduled appointment date'));
      console.log('  [PASS 10] Check-in on non-today appointment date is rejected with 400 Bad Request');
    }

    // Test 11: Valid check-in allocates token, updates status to CHECKED_IN, creates QueueEntry and QueueHistory
    let checkedInEntryId;
    {
      const req = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        params: { id: apptA1._id.toString() },
      };
      const res = createMockRes();
      await runWithAuth(req, res, checkInAppointment, ['STAFF', 'ADMIN']);
      assert.strictEqual(res.statusCode, 200, 'Valid check-in must return 200');
      assert.strictEqual(res.body.success, true);
      assert(res.body.queueEntry, 'Response must contain allocated queueEntry');
      assert.strictEqual(res.body.queueEntry.tokenNumber, 1, 'First token allocated must be 1');
      assert.strictEqual(res.body.queueEntry.status, 'WAITING');
      assert.strictEqual(res.body.queueEntry.source, 'ONLINE');
      checkedInEntryId = res.body.queueEntry._id;

      // Verify Appointment updated in database
      const updatedAppt = await Appointment.findById(apptA1._id);
      assert.strictEqual(updatedAppt.status, 'CHECKED_IN');
      assert(updatedAppt.checkedInAt, 'checkedInAt timestamp must be recorded');

      // Verify QueueHistory entry was recorded
      const history = await QueueHistory.findOne({ queueEntryId: checkedInEntryId });
      assert(history, 'QueueHistory audit entry must be created on check-in');
      assert.strictEqual(history.action, 'CHECK_IN');
      assert.strictEqual(history.newState, 'WAITING');
      console.log('  [PASS 11] Valid check-in: status BOOKED->CHECKED_IN, Token #1 allocated, QueueEntry & QueueHistory created');
    }

    // Test 12: Repeated check-in on already checked-in appointment is rejected with 400
    {
      const req = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        params: { id: apptA1._id.toString() },
      };
      const res = createMockRes();
      await runWithAuth(req, res, checkInAppointment, ['STAFF', 'ADMIN']);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert(res.body.message.includes('CHECKED_IN'));
      console.log('  [PASS 12] Repeated check-in on already CHECKED_IN appointment is rejected with 400');
    }

    // Test 13: Concurrent check-in race condition protection (atomic findOneAndUpdate)
    {
      // Create a new appointment for race condition test with a distinct slot time within current arrival window
      const raceSlotTime = { startTime: `${slotStartHour}:30`, endTime: `${slotStartHour}:45` };
      const raceAppt = await Appointment.create({
        clinicId: clinicA._id,
        doctorId: doctorA._id,
        patientId: patient2._id,
        specialtyId: specialty._id,
        appointmentDate: todayDate,
        timeSlot: raceSlotTime,
        status: 'BOOKED',
      });

      // Simulate two concurrent check-ins
      const req1 = { headers: { authorization: `Bearer ${staffTokenA}` }, params: { id: raceAppt._id.toString() } };
      const req2 = { headers: { authorization: `Bearer ${staffTokenA}` }, params: { id: raceAppt._id.toString() } };
      const res1 = createMockRes();
      const res2 = createMockRes();

      await Promise.all([
        runWithAuth(req1, res1, checkInAppointment, ['STAFF', 'ADMIN']),
        runWithAuth(req2, res2, checkInAppointment, ['STAFF', 'ADMIN']),
      ]);

      const statusCodes = [res1.statusCode, res2.statusCode];
      assert(statusCodes.includes(200), 'Exactly one concurrent check-in must succeed with 200');
      assert(statusCodes.includes(400), 'Second concurrent check-in must fail with 400 (already checked in)');
      console.log('  [PASS 13] Concurrent check-in race protection: exactly one succeeds, duplicate check-in prevented');
    }

    // ======================================================================
    // SECTION 4: Walk-In Patient & Queue Registration
    // ======================================================================
    console.log('\n6. Running Section 4: Walk-In Patient & Queue Registration...');

    // Test 14: Walk-in patient creation with missing required fields returns 400
    {
      const req = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        body: { fullName: 'Walk In Patient' }, // missing phone and gender
      };
      const res = createMockRes();
      await runWithAuth(req, res, createWalkInPatient, ['STAFF', 'ADMIN', 'DOCTOR']);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      console.log('  [PASS 14] Walk-in patient creation with missing fields is rejected with 400');
    }

    // Test 15: Valid walk-in patient creation creates Patient record
    let newWalkInPatient;
    {
      const req = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        body: {
          fullName: 'Ramesh Patel',
          phone: '9876543210',
          gender: 'MALE',
          dateOfBirth: '1990-05-15',
          address: { street: '12 MG Road' },
        },
      };
      const res = createMockRes();
      await runWithAuth(req, res, createWalkInPatient, ['STAFF', 'ADMIN', 'DOCTOR']);
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      assert(res.body.patient, 'Must return created patient');
      assert.strictEqual(res.body.patient.phone, '9876543210');
      newWalkInPatient = res.body.patient;
      console.log('  [PASS 15] Valid walk-in patient profile created successfully (201 Created)');
    }

    // Test 16: Duplicate phone number for walk-in patient is rejected with 409
    {
      const req = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        body: {
          fullName: 'Ramesh Duplicate',
          phone: '9876543210',
          gender: 'MALE',
        },
      };
      const res = createMockRes();
      await runWithAuth(req, res, createWalkInPatient, ['STAFF', 'ADMIN', 'DOCTOR']);
      assert.strictEqual(res.statusCode, 409);
      assert.strictEqual(res.body.success, false);
      console.log('  [PASS 16] Duplicate phone number for walk-in patient returns 409 Conflict');
    }

    // Test 17: Valid walk-in queue registration allocates next token and sets source WALK_IN
    let walkInEntryId;
    {
      const req = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        body: {
          patientId: newWalkInPatient._id.toString(),
          doctorId: doctorA._id.toString(),
        },
      };
      const res = createMockRes();
      await runWithAuth(req, res, registerWalkIn, ['STAFF', 'ADMIN', 'DOCTOR']);
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      assert(res.body.queueEntry, 'Must return allocated queueEntry');
      assert.strictEqual(res.body.queueEntry.source, 'WALK_IN');
      assert.strictEqual(res.body.queueEntry.status, 'WAITING');
      walkInEntryId = res.body.queueEntry._id;
      console.log(`  [PASS 17] Walk-in queue registration: Token #${res.body.queueEntry.tokenNumber} allocated (source: WALK_IN)`);
    }

    // Test 18: Duplicate active walk-in for same doctor & patient today returns 409 Conflict
    {
      const req = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        body: {
          patientId: newWalkInPatient._id.toString(),
          doctorId: doctorA._id.toString(),
        },
      };
      const res = createMockRes();
      await runWithAuth(req, res, registerWalkIn, ['STAFF', 'ADMIN', 'DOCTOR']);
      assert.strictEqual(res.statusCode, 409);
      assert.strictEqual(res.body.success, false);
      assert(res.body.message.includes('already in the active queue'));
      console.log('  [PASS 18] Duplicate active walk-in entry is rejected with 409 Conflict');
    }

    // ======================================================================
    // SECTION 5: Queue Status Transitions & Recovery
    // ======================================================================
    console.log('\n7. Running Section 5: Queue Status Transitions & Recovery...');

    // Test 19: Call Next Patient (WAITING -> CALLED)
    let calledEntryId;
    {
      const req = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        body: { doctorId: doctorA._id.toString() },
      };
      const res = createMockRes();
      await runWithAuth(req, res, callNextPatient, ['STAFF', 'ADMIN', 'DOCTOR']);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.queueEntry.status, 'CALLED');
      calledEntryId = res.body.queueEntry._id;
      console.log(`  [PASS 19] Call Next Patient: Token #${res.body.queueEntry.tokenNumber} transitioned to CALLED`);
    }

    // Test 20: Skip Patient (CALLED -> SKIPPED) with reason
    {
      const req = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        params: { id: calledEntryId.toString() },
        body: { reason: 'Patient not responding at reception call' },
      };
      const res = createMockRes();
      await runWithAuth(req, res, skipPatient, ['STAFF', 'ADMIN', 'DOCTOR']);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.queueEntry.status, 'SKIPPED');

      // Verify reason recorded in QueueHistory audit trail
      const skipHistory = await QueueHistory.findOne({ queueEntryId: calledEntryId, action: 'SKIP' });
      assert(skipHistory, 'QueueHistory SKIP entry must be recorded');
      assert.strictEqual(skipHistory.reason, 'Patient not responding at reception call');
      console.log('  [PASS 20] Skip Patient: transitioned to SKIPPED with operational reason recorded in audit log');
    }

    // Test 21: Rejoin Skipped Patient: allocates newly incremented token and sets status back to WAITING
    {
      const req = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        params: { id: calledEntryId.toString() },
      };
      const res = createMockRes();
      await runWithAuth(req, res, rejoinPatient, ['STAFF', 'ADMIN', 'DOCTOR']);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.queueEntry.status, 'WAITING');
      assert(res.body.queueEntry.tokenNumber > 1, 'Rejoined token number must be newly incremented');
      console.log(`  [PASS 21] Rejoin Skipped Patient: allocated new Token #${res.body.queueEntry.tokenNumber} and returned to WAITING`);
    }

    // Test 22: Mark No-Show: transitions entry to NO_SHOW and syncs linked appointment
    {
      // First call the walkInEntryId
      const callReq = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        body: { doctorId: doctorA._id.toString() },
      };
      const callRes = createMockRes();
      await runWithAuth(callReq, callRes, callNextPatient, ['STAFF', 'ADMIN', 'DOCTOR']);

      const targetId = callRes.body.queueEntry ? callRes.body.queueEntry._id : walkInEntryId;
      const noShowReq = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        params: { id: targetId.toString() },
        body: { reason: 'Patient departed without consultation' },
      };
      const noShowRes = createMockRes();
      await runWithAuth(noShowReq, noShowRes, markNoShow, ['STAFF', 'ADMIN', 'DOCTOR']);
      assert.strictEqual(noShowRes.statusCode, 200);
      assert.strictEqual(noShowRes.body.queueEntry.status, 'NO_SHOW');
      console.log('  [PASS 22] Mark No-Show: transitioned entry to NO_SHOW with audit logging');
    }

    // Test 23: Cancel Queue Entry with operational reason
    {
      const cancelAppt = await Appointment.create({
        clinicId: clinicA._id,
        doctorId: doctorA._id,
        patientId: patient1._id,
        specialtyId: specialty._id,
        appointmentDate: todayDate,
        timeSlot: { startTime: `${slotStartHour}:45`, endTime: `${slotStartHour}:59` },
        status: 'CHECKED_IN',
      });

      const cancelEntry = await QueueEntry.create({
        clinicId: clinicA._id,
        doctorId: doctorA._id,
        patientId: patient1._id,
        appointmentId: cancelAppt._id,
        queueDate: todayDate,
        tokenNumber: 50,
        source: 'ONLINE',
        status: 'WAITING',
        priority: 'NORMAL',
        priorityWeight: 1,
        effectiveSlotMinutes: 15,
      });

      const cancelReq = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        params: { id: cancelEntry._id.toString() },
        body: { reason: 'Patient had family emergency and requested withdrawal' },
      };
      const cancelRes = createMockRes();
      await runWithAuth(cancelReq, cancelRes, cancelQueueEntry, ['STAFF', 'ADMIN', 'DOCTOR']);
      assert.strictEqual(cancelRes.statusCode, 200);
      assert.strictEqual(cancelRes.body.queueEntry.status, 'CANCELLED');

      // Verify linked appointment was also updated to CANCELLED with cancellation reason
      const linkedAppt = await Appointment.findById(cancelAppt._id);
      assert.strictEqual(linkedAppt.status, 'CANCELLED');
      assert.strictEqual(linkedAppt.cancellationReason, 'Patient had family emergency and requested withdrawal');

      // Verify QueueHistory CANCEL entry was logged
      const cancelHistory = await QueueHistory.findOne({ queueEntryId: cancelEntry._id, action: 'CANCEL' });
      assert(cancelHistory, 'QueueHistory CANCEL entry must be logged');
      assert.strictEqual(cancelHistory.reason, 'Patient had family emergency and requested withdrawal');
      console.log('  [PASS 23] Cancel Queue Entry: transitioned to CANCELLED and synchronized linked appointment');
    }

    // Test 24: Triage Priority Escalation
    {
      const triagePatient = await Patient.create({
        fullName: 'Triage Patient',
        phone: '9111111111',
        gender: 'MALE',
        dateOfBirth: '1975-01-01',
      });

      // Create a fresh queue entry to triage
      const freshEntry = await QueueEntry.create({
        clinicId: clinicA._id,
        doctorId: doctorA._id,
        patientId: triagePatient._id,
        queueDate: todayDate,
        tokenNumber: 99,
        source: 'STAFF_CREATED',
        status: 'WAITING',
        priority: 'NORMAL',
        priorityWeight: 1,
        effectiveSlotMinutes: 15,
      });

      const triageReq = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        params: { id: freshEntry._id.toString() },
        body: { priority: 'EMERGENCY', reason: 'Patient acute chest discomfort requiring immediate attention' },
      };
      const triageRes = createMockRes();
      await runWithAuth(triageReq, triageRes, triageQueueEntry, ['STAFF', 'ADMIN']);
      assert.strictEqual(triageRes.statusCode, 200);
      assert.strictEqual(triageRes.body.queueEntry.priority, 'EMERGENCY');
      assert.strictEqual(triageRes.body.queueEntry.priorityWeight, 3);
      assert.strictEqual(triageRes.body.queueEntry.triageReason, 'Patient acute chest discomfort requiring immediate attention');
      console.log('  [PASS 24] Triage Priority Escalation: upgraded priority to EMERGENCY (weight: 3) with reason');
    }

    // Test 25: Doctor Queue Transfer (Doctor A -> Doctor Marcus in Clinic A)
    {
      const transferPatient = await Patient.create({
        fullName: 'Transfer Patient',
        phone: '9222222222',
        gender: 'FEMALE',
        dateOfBirth: '1980-01-01',
      });

      const transferEntry = await QueueEntry.create({
        clinicId: clinicA._id,
        doctorId: doctorA._id,
        patientId: transferPatient._id,
        queueDate: todayDate,
        tokenNumber: 100,
        source: 'STAFF_CREATED',
        status: 'WAITING',
        priority: 'NORMAL',
        priorityWeight: 1,
        effectiveSlotMinutes: 15,
      });

      const transferReq = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        params: { id: transferEntry._id.toString() },
        body: {
          targetDoctorId: doctorMarcus._id.toString(),
          reason: 'Doctor A emergency leave, reallocating waiting queue',
        },
      };
      const transferRes = createMockRes();
      await runWithAuth(transferReq, transferRes, transferQueueDoctor, ['STAFF', 'ADMIN']);
      if (transferRes.statusCode !== 200) {
        console.log('TRANSFER ERROR:', transferRes.body);
      }
      assert.strictEqual(transferRes.statusCode, 200);
      assert.strictEqual(transferRes.body.queueEntry.doctorId.toString(), doctorMarcus._id.toString());
      console.log('  [PASS 25] Doctor Queue Transfer: successfully reassigned patient queue entry to Dr. Marcus');
    }

    // Test 26: Pause and Resume Doctor Queue
    {
      const pauseReq = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        body: { doctorId: doctorA._id.toString(), reason: 'Doctor in brief clinical meeting' },
      };
      const pauseRes = createMockRes();
      await runWithAuth(pauseReq, pauseRes, pauseQueue, ['STAFF', 'ADMIN', 'DOCTOR']);
      assert.strictEqual(pauseRes.statusCode, 200);
      assert.strictEqual(pauseRes.body.isQueuePaused, true);
      assert.strictEqual(pauseRes.body.queuePauseReason, 'Doctor in brief clinical meeting');

      const resumeReq = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        body: { doctorId: doctorA._id.toString() },
      };
      const resumeRes = createMockRes();
      await runWithAuth(resumeReq, resumeRes, resumeQueue, ['STAFF', 'ADMIN', 'DOCTOR']);
      assert.strictEqual(resumeRes.statusCode, 200);
      assert.strictEqual(resumeRes.body.isQueuePaused, false);
      console.log('  [PASS 26] Pause & Resume Doctor Queue: operational pause state toggled with reason');
    }

    // ======================================================================
    // SECTION 6: Administrator Operations & Roster Inspection
    // ======================================================================
    console.log('\n8. Running Section 6: Administrator Operations & Roster Inspection...');

    // Test 27: Non-admin role (STAFF) cannot access admin routes (403 Forbidden)
    {
      const req = {
        headers: { authorization: `Bearer ${staffTokenA}` },
        query: {},
      };
      const res = createMockRes();
      await runWithAuth(req, res, getStaffListAdmin, ['ADMIN']);
      assert.strictEqual(res.statusCode, 403, 'STAFF role must be rejected from admin staff list');
      console.log('  [PASS 27] Non-admin role (STAFF) is rejected with 403 when requesting admin staff roster');
    }

    // Test 28: Admin accesses GET /api/admin/clinics: returns all clinics including inactive
    {
      const req = {
        headers: { authorization: `Bearer ${adminToken}` },
        query: {},
        user: { role: 'ADMIN' },
      };
      const res = createMockRes();
      await runWithAuth(req, res, getClinics, ['ADMIN']);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.clinics.length, 3, 'Must return all 3 clinics (including inactive Clinic C)');
      const clinicNames = res.body.clinics.map((c) => c.name);
      assert(clinicNames.includes('Apex Health Center (Clinic A)'));
      assert(clinicNames.includes('Metro Care Clinic (Clinic B)'));
      assert(clinicNames.includes('Sunrise Clinic (Inactive)'));
      console.log('  [PASS 28] Admin GET /api/admin/clinics returns complete clinic registry including inactive clinics');
    }

    // Test 29: Admin accesses GET /api/admin/staff: returns staff roster populated with user and clinic
    {
      const req = {
        headers: { authorization: `Bearer ${adminToken}` },
        query: {},
      };
      const res = createMockRes();
      await runWithAuth(req, res, getStaffListAdmin, ['ADMIN']);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.staff.length, 2, 'Must return both staff members');
      const staffMember = res.body.staff[0];
      assert(staffMember.userId, 'userId must be populated');
      assert(staffMember.userId.email, 'userId.email must be populated');
      assert(staffMember.fullName, 'staffMember.fullName must be populated');
      assert(staffMember.clinicId, 'clinicId must be populated');
      assert(staffMember.clinicId.name, 'clinicId.name must be populated');
      console.log('  [PASS 29] Admin GET /api/admin/staff returns staff roster deeply populated with user and clinic');
    }

    // Test 30: Admin doctor schedule management regression check
    {
      const req = {
        headers: { authorization: `Bearer ${adminToken}` },
        params: { id: doctorA._id.toString() },
        body: {
          weeklyHours: allDays.map((d) => ({
            dayOfWeek: d,
            isWorkingDay: d !== 'SUNDAY',
            shifts: d !== 'SUNDAY' ? [{ startTime: '09:00', endTime: '17:00' }] : [],
            breaks: [],
          })),
          averageConsultationDurationMinutes: 20,
        },
      };
      const res = createMockRes();
      await runWithAuth(req, res, updateScheduleAdmin, ['ADMIN']);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);

      // Verify schedule and duration updated in DB
      const updatedDoctor = await Doctor.findById(doctorA._id);
      assert.strictEqual(updatedDoctor.averageConsultationDurationMinutes, 20);
      const updatedSchedule = await DoctorSchedule.findOne({ doctorId: doctorA._id });
      const sunday = updatedSchedule.weeklyHours.find((h) => h.dayOfWeek === 'SUNDAY');
      assert.strictEqual(sunday.isWorkingDay, false);
      console.log('  [PASS 30] Admin doctor schedule management (Phase 2 regression check) operates perfectly');
    }

    console.log('\n======================================================================');
    console.log('  Phase 6 Staff & Admin Operations Test Results: 30/30 Passed (100%)');
    console.log('======================================================================\n');
  } catch (err) {
    console.error('\n❌ TEST RUNNER FAILURE:', err);
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

runStaffAdminPhase6Tests();
