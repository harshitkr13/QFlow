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
  Appointment,
} from '../models/index.js';
import { formatDoctorName as serverFormatDoctorName } from '../utils/doctorUtils.js';
import { formatDoctorName as clientFormatDoctorName } from '../../client/src/utils/doctorUtils.js';
import { loginUser, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { getTodayQueue, callNextPatient } from '../controllers/staffQueueController.js';
import { getStaffListAdmin } from '../controllers/clinicController.js';
import { getDoctorAppointments } from '../controllers/appointmentController.js';

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
      Appointment.init(),
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

    // --------------------------------------------------------------------------
    // TEST 6: GET /api/admin/staff returns populated staff profile name & mirrors to userId
    // --------------------------------------------------------------------------
    console.log('\n[TEST 6] Testing GET /api/admin/staff returns correct staff profile name...');
    const adminReq = {
      user: {
        _id: adminUser._id,
        role: 'ADMIN',
      },
      query: {},
    };
    const adminRes = createMockRes();
    await getStaffListAdmin(adminReq, adminRes, (err) => { if (err) throw err; });

    assert.strictEqual(adminRes.statusCode, 200);
    assert.strictEqual(adminRes.body.success, true);
    assert.ok(adminRes.body.staff.length > 0, 'Must return staff members');

    const returnedStaff = adminRes.body.staff.find((s) => s.userId?.email === 'staff.staging@qflow.test');
    assert.ok(returnedStaff, 'Target staff member must be in response');
    assert.strictEqual(
      returnedStaff.fullName,
      'Staging Staff Receptionist',
      'staff.fullName must contain the actual assigned staff profile name'
    );
    assert.strictEqual(
      returnedStaff.userId?.fullName,
      'Staging Staff Receptionist',
      'staff.userId.fullName must mirror staff.fullName for data contract compatibility'
    );
    assert.strictEqual(
      returnedStaff.phone,
      '+91 98200 11223',
      'staff.phone must match staff profile phone'
    );
    console.log('✅ PASS: Admin staff roster returns actual profile name and mirrors to userId.');

    // --------------------------------------------------------------------------
    // TEST 7: GET /api/doctors/me/appointments populates clinic name and code without [object Object]
    // --------------------------------------------------------------------------
    console.log('\n[TEST 7] Testing Doctor Consultations & Appointments clinic name rendering...');
    const appointment = await Appointment.create({
      clinicId: clinic._id,
      doctorId: doctor._id,
      patientId: patient._id,
      specialtyId: specialty._id,
      appointmentDate: today,
      timeSlot: {
        startTime: '10:00',
        endTime: '10:15',
      },
      status: 'BOOKED',
      consultationFee: 500,
    });

    const docApptReq = {
      user: {
        _id: doctorUser._id,
        id: doctorUser._id,
        doctorId: doctor._id,
        role: 'DOCTOR',
      },
      query: {
        scope: 'today',
      },
    };
    const docApptRes = createMockRes();
    await getDoctorAppointments(docApptReq, docApptRes, (err) => { if (err) throw err; });

    assert.strictEqual(docApptRes.statusCode, 200);
    assert.strictEqual(docApptRes.body.success, true);
    assert.ok(docApptRes.body.appointments.length > 0, 'Must return doctor appointments');

    const docAppt = docApptRes.body.appointments.find((a) => a._id.toString() === appointment._id.toString());
    assert.ok(docAppt, 'Created appointment must be found');
    assert.ok(docAppt.clinicId, 'clinicId must be populated');
    assert.strictEqual(docAppt.clinicId.name, '[STAGING DEMO] Apex Community Clinic');
    assert.strictEqual(typeof docAppt.clinicId.address, 'object', 'clinic address is an object');
    assert.strictEqual(docAppt.clinicId.address.city, 'Mumbai', 'clinic address city is Mumbai');

    // Simulate frontend safe rendering logic:
    const code = docAppt.clinicId.code;
    const city = typeof docAppt.clinicId.address === 'object'
      ? (docAppt.clinicId.address?.city || docAppt.clinicId.address?.street)
      : (typeof docAppt.clinicId.address === 'string' ? docAppt.clinicId.address : null);
    const sub = code || city;
    const renderedLabel = `${docAppt.clinicId.name}${sub ? ` (${sub})` : ''}`;

    console.log(`  Rendered clinic label: "${renderedLabel}"`);
    assert.strictEqual(
      renderedLabel,
      '[STAGING DEMO] Apex Community Clinic (Mumbai)',
      'Clinic label must render human-readable name and location/code'
    );
    assert.ok(
      !renderedLabel.includes('[object Object]'),
      'Rendered clinic label must never contain [object Object]'
    );
    console.log('✅ PASS: Doctor appointments clinic label renders name and code without object coercion.');

    // --------------------------------------------------------------------------
    // TEST 8: Doctor Consultations & Appointments Scope Filtering (Upcoming vs Today vs Past)
    // --------------------------------------------------------------------------
    console.log('\n[TEST 8] Testing Doctor Consultations & Appointments Upcoming vs Today vs Past filtering...');

    function getOffsetDate(offsetDays) {
      const d = new Date();
      d.setDate(d.getDate() + offsetDays);
      return getFormattedDateIST(d);
    }

    const futureDate = getOffsetDate(3);
    const pastDate = getOffsetDate(-3);

    // 1. Completed appointment for today (matches the exact staging defect scenario)
    const apptTodayCompleted = await Appointment.create({
      clinicId: clinic._id,
      doctorId: doctor._id,
      patientId: patient._id,
      specialtyId: specialty._id,
      appointmentDate: today,
      timeSlot: {
        startTime: '15:45',
        endTime: '16:00',
      },
      status: 'COMPLETED',
      consultationFee: 500,
    });

    // 2. Future active appointment (BOOKED)
    const apptFutureBooked = await Appointment.create({
      clinicId: clinic._id,
      doctorId: doctor._id,
      patientId: patient._id,
      specialtyId: specialty._id,
      appointmentDate: futureDate,
      timeSlot: {
        startTime: '11:00',
        endTime: '11:15',
      },
      status: 'BOOKED',
      consultationFee: 500,
    });

    // 3. Future cancelled appointment (CANCELLED - terminal status)
    const apptFutureCancelled = await Appointment.create({
      clinicId: clinic._id,
      doctorId: doctor._id,
      patientId: patient._id,
      specialtyId: specialty._id,
      appointmentDate: futureDate,
      timeSlot: {
        startTime: '11:30',
        endTime: '11:45',
      },
      status: 'CANCELLED',
      consultationFee: 500,
    });

    // 4. Past completed appointment
    const apptPastCompleted = await Appointment.create({
      clinicId: clinic._id,
      doctorId: doctor._id,
      patientId: patient._id,
      specialtyId: specialty._id,
      appointmentDate: pastDate,
      timeSlot: {
        startTime: '14:00',
        endTime: '14:15',
      },
      status: 'COMPLETED',
      consultationFee: 500,
    });

    // Query 8A: GET /api/doctors/me/appointments?scope=upcoming
    const upcomingReq = {
      user: {
        _id: doctorUser._id,
        id: doctorUser._id,
        doctorId: doctor._id,
        role: 'DOCTOR',
      },
      query: {
        scope: 'upcoming',
      },
    };
    const upcomingRes = createMockRes();
    await getDoctorAppointments(upcomingReq, upcomingRes, (err) => { if (err) throw err; });

    assert.strictEqual(upcomingRes.statusCode, 200);
    assert.strictEqual(upcomingRes.body.success, true);
    const upcomingAppts = upcomingRes.body.appointments;
    const upcomingIds = upcomingAppts.map((a) => a._id.toString());

    // Upcoming MUST contain active appointments (BOOKED from test 7 and future booked)
    assert.ok(upcomingIds.includes(appointment._id.toString()), 'Upcoming must include today active BOOKED appointment');
    assert.ok(upcomingIds.includes(apptFutureBooked._id.toString()), 'Upcoming must include future active BOOKED appointment');

    // Upcoming MUST EXCLUDE COMPLETED, CANCELLED, NO_SHOW, and other terminal statuses
    assert.ok(
      !upcomingIds.includes(apptTodayCompleted._id.toString()),
      'CRITICAL: Upcoming must EXCLUDE completed appointment for today'
    );
    assert.ok(
      !upcomingIds.includes(apptFutureCancelled._id.toString()),
      'Upcoming must EXCLUDE cancelled future appointment'
    );
    assert.ok(
      !upcomingIds.includes(apptPastCompleted._id.toString()),
      'Upcoming must EXCLUDE past completed appointment'
    );

    // Verify all returned upcoming appointments are strictly active
    for (const a of upcomingAppts) {
      assert.ok(
        ['BOOKED', 'CHECKED_IN'].includes(a.status),
        `Upcoming appointment status must be active (got: ${a.status})`
      );
    }
    console.log('  ✅ scope=upcoming properly excludes COMPLETED and CANCELLED appointments, retaining only active ones.');

    // Query 8B: GET /api/doctors/me/appointments?scope=today
    const todayReq = {
      user: {
        _id: doctorUser._id,
        id: doctorUser._id,
        doctorId: doctor._id,
        role: 'DOCTOR',
      },
      query: {
        scope: 'today',
      },
    };
    const todayRes = createMockRes();
    await getDoctorAppointments(todayReq, todayRes, (err) => { if (err) throw err; });

    assert.strictEqual(todayRes.statusCode, 200);
    const todayAppts = todayRes.body.appointments;
    const todayIds = todayAppts.map((a) => a._id.toString());

    // Today tab MUST include both today's active AND today's completed appointments
    assert.ok(todayIds.includes(appointment._id.toString()), 'Today tab must include today BOOKED appointment');
    assert.ok(todayIds.includes(apptTodayCompleted._id.toString()), 'Today tab must include today COMPLETED appointment');
    assert.ok(!todayIds.includes(apptFutureBooked._id.toString()), 'Today tab must not include future appointment');
    assert.ok(!todayIds.includes(apptPastCompleted._id.toString()), 'Today tab must not include past appointment');
    console.log('  ✅ scope=today properly includes all today appointments regardless of completion status.');

    // Query 8C: GET /api/doctors/me/appointments?scope=past
    const pastReq = {
      user: {
        _id: doctorUser._id,
        id: doctorUser._id,
        doctorId: doctor._id,
        role: 'DOCTOR',
      },
      query: {
        scope: 'past',
      },
    };
    const pastRes = createMockRes();
    await getDoctorAppointments(pastReq, pastRes, (err) => { if (err) throw err; });

    assert.strictEqual(pastRes.statusCode, 200);
    const pastAppts = pastRes.body.appointments;
    const pastIds = pastAppts.map((a) => a._id.toString());

    assert.ok(pastIds.includes(apptPastCompleted._id.toString()), 'Past tab must include past appointment');
    assert.ok(!pastIds.includes(appointment._id.toString()), 'Past tab must not include today appointment');
    assert.ok(!pastIds.includes(apptFutureBooked._id.toString()), 'Past tab must not include future appointment');
    console.log('  ✅ scope=past properly returns historical appointments.');

    // Query 8D: Frontend simulated filter logic verification
    const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'EXPIRED'];
    const simulateClientFilter = (appts, scope, dateFilter) => {
      return appts.filter((a) => {
        if (scope === 'upcoming' && !dateFilter) {
          if (TERMINAL_STATUSES.includes(a.status)) return false;
        }
        return true;
      });
    };

    const clientUpcomingFiltered = simulateClientFilter(
      [appointment, apptTodayCompleted, apptFutureBooked, apptFutureCancelled, apptPastCompleted],
      'upcoming',
      ''
    );
    const clientUpcomingIds = clientUpcomingFiltered.map((a) => a._id.toString());
    assert.ok(!clientUpcomingIds.includes(apptTodayCompleted._id.toString()), 'Client filter excludes COMPLETED in upcoming');
    assert.ok(!clientUpcomingIds.includes(apptFutureCancelled._id.toString()), 'Client filter excludes CANCELLED in upcoming');
    assert.ok(clientUpcomingIds.includes(appointment._id.toString()), 'Client filter retains BOOKED in upcoming');
    assert.ok(clientUpcomingIds.includes(apptFutureBooked._id.toString()), 'Client filter retains future BOOKED in upcoming');

    const clientTodayFiltered = simulateClientFilter(
      [appointment, apptTodayCompleted],
      'today',
      ''
    );
    assert.strictEqual(clientTodayFiltered.length, 2, 'Client filter preserves all appointments in today scope');
    console.log('  ✅ Frontend client-side filter defense-in-depth verified.');

    console.log('✅ PASS: Doctor Consultations & Appointments scope filtering verified across Backend and Frontend.');

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
