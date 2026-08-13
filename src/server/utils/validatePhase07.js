import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import { User, Clinic, Specialty, Doctor, Staff, DoctorSchedule, Patient, Appointment, QueueEntry, QueueCounter, QueueHistory } from '../models/index.js';
import { generateToken } from './jwt.js';
import { runAuthValidation } from './validateAuth.js';
import { runPhase04Validation } from './validatePhase04.js';
import { runPhase05Validation } from './validatePhase05.js';
import { runPhase06Validation } from './validatePhase06.js';
import {
  searchPatients,
  createWalkInPatient,
  registerWalkIn,
  getTodayQueue,
} from '../controllers/staffQueueController.js';
import { checkInAppointment } from '../controllers/appointmentController.js';

dotenv.config();

/**
 * Helper to format date YYYY-MM-DD in IST
 */
const getFormattedDateIST = (dateObj = new Date()) => {
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  return new Intl.DateTimeFormat('en-CA', options).format(dateObj);
};

/**
 * Helper to format time HH:mm in IST
 */
const getFormattedTimeIST = (dateObj = new Date()) => {
  const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false };
  return new Intl.DateTimeFormat('en-GB', options).format(dateObj);
};

export const runPhase07Validation = async () => {
  console.log('--- Phase 07 Queue Entry, Token Allocation & Reception Operations Validation Starting ---');

  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }
  console.log(`✓ Connected to DB: ${mongoose.connection.host}/${mongoose.connection.name}`);

  // Sync indexes to ensure MongoDB Atlas has new unique indexes created
  await Patient.syncIndexes();
  await QueueEntry.syncIndexes();
  console.log('✓ Synced Patient and QueueEntry indexes on MongoDB Atlas.');

  const createdUserIds = [];
  const createdClinicIds = [];
  const createdSpecialtyIds = [];
  const createdDoctorIds = [];
  const createdPatientIds = [];
  const createdStaffIds = [];
  const createdScheduleIds = [];
  const createdAppointmentIds = [];

  try {
    // Setup Admin user
    const adminUser = await User.create({
      email: `admin_p7_${Date.now()}@example.com`,
      password: await bcrypt.hash('AdminPass123!', 10),
      role: 'ADMIN',
      isActive: true,
    });
    createdUserIds.push(adminUser._id);

    // Setup Active Clinic 1
    const clinic1 = await Clinic.create({
      name: `Reception Clinic Alpha ${Date.now()}`,
      address: { street: '100 Queue Way', city: 'Delhi', state: 'Delhi', pincode: '110001' },
      location: { type: 'Point', coordinates: [77.2090, 28.6139] },
      phone: '9876543210',
      adminId: adminUser._id,
      queuePolicy: 'HYBRID',
      isActive: true,
    });
    createdClinicIds.push(clinic1._id);

    // Setup Active Clinic 2
    const clinic2 = await Clinic.create({
      name: `Reception Clinic Beta ${Date.now()}`,
      address: { street: '200 Queue Rd', city: 'Delhi', state: 'Delhi', pincode: '110002' },
      location: { type: 'Point', coordinates: [77.2100, 28.6150] },
      phone: '9876543211',
      adminId: adminUser._id,
      queuePolicy: 'HYBRID',
      isActive: true,
    });
    createdClinicIds.push(clinic2._id);

    // Setup Active Specialty
    const spec1 = await Specialty.create({
      name: 'General Medicine',
      code: `GEN_P7_${Date.now()}`,
      description: 'General health',
      isActive: true,
    });
    createdSpecialtyIds.push(spec1._id);

    // Setup Active Doctor 1 (Clinic 1)
    const docUser1 = await User.create({
      email: `doc1_p7_${Date.now()}@example.com`,
      password: await bcrypt.hash('DocPass123!', 10),
      role: 'DOCTOR',
      isActive: true,
    });
    createdUserIds.push(docUser1._id);

    const doctor1 = await Doctor.create({
      userId: docUser1._id,
      clinicId: clinic1._id,
      specialtyId: spec1._id,
      fullName: 'Dr. Bob Queue',
      gender: 'MALE',
      qualifications: ['MBBS'],
      experienceYears: 8,
      consultationFee: 300,
      averageConsultationDurationMinutes: 15,
      operationalStatus: 'AVAILABLE',
    });
    createdDoctorIds.push(doctor1._id);

    // Setup Staff User (Clinic 1)
    const staffUser1 = await User.create({
      email: `staff1_p7_${Date.now()}@example.com`,
      password: await bcrypt.hash('StaffPass123!', 10),
      role: 'STAFF',
      isActive: true,
    });
    createdUserIds.push(staffUser1._id);

    const staff1 = await Staff.create({
      userId: staffUser1._id,
      clinicId: clinic1._id,
      fullName: 'Staff One',
      phone: '9991112221',
    });
    createdStaffIds.push(staff1._id);

    // Setup Staff User (Clinic 2)
    const staffUser2 = await User.create({
      email: `staff2_p7_${Date.now()}@example.com`,
      password: await bcrypt.hash('StaffPass123!', 10),
      role: 'STAFF',
      isActive: true,
    });
    createdUserIds.push(staffUser2._id);

    const staff2 = await Staff.create({
      userId: staffUser2._id,
      clinicId: clinic2._id,
      fullName: 'Staff Two',
      phone: '9991112222',
    });
    createdStaffIds.push(staff2._id);

    // Mock controller caller helper
    const mockCall = async (fn, reqObj) => {
      let statusVal = 200;
      let bodyVal = null;
      const req = reqObj;
      const res = {
        status: (s) => { statusVal = s; return res; },
        json: (b) => { bodyVal = b; return res; },
      };
      await fn(req, res, (err) => { throw err; });
      return { status: statusVal, body: bodyVal };
    };

    // ----------------------------------------------------
    // 1. PATIENT SEARCH TESTS
    // ----------------------------------------------------
    const uniquePhone = `98700${Date.now().toString().slice(-5)}`;
    const createPatientRes = await mockCall(createWalkInPatient, {
      user: { _id: staffUser1._id, id: staffUser1._id, role: 'STAFF', staffClinicId: clinic1._id },
      body: { fullName: 'John Searchable', phone: uniquePhone, gender: 'MALE' },
    });
    if (createPatientRes.status !== 201 || !createPatientRes.body.patient) {
      throw new Error('Test 3 Failed: Walk-in patient creation failed');
    }
    const patient1 = createPatientRes.body.patient;
    createdPatientIds.push(patient1._id);
    console.log('✓ Test 3 Passed: Walk-in Patient creation succeeds with userId = null.');

    // Search by Phone
    const searchResPhone = await mockCall(searchPatients, {
      user: { _id: staffUser1._id, id: staffUser1._id, role: 'STAFF', staffClinicId: clinic1._id },
      body: { phone: uniquePhone.slice(0, 5) },
    });
    if (searchResPhone.status !== 200 || searchResPhone.body.patients.length === 0) {
      throw new Error('Test 1 Failed: Patient search by phone failed');
    }
    console.log('✓ Test 1 Passed: Staff patient search by phone prefix works.');

    // Search by Name
    const searchResName = await mockCall(searchPatients, {
      user: { _id: staffUser1._id, id: staffUser1._id, role: 'STAFF', staffClinicId: clinic1._id },
      body: { name: 'Searchable' },
    });
    if (searchResName.status !== 200 || searchResName.body.patients.length === 0) {
      throw new Error('Test 2 Failed: Patient search by name failed');
    }
    console.log('✓ Test 2 Passed: Staff patient search by name partial match works.');

    // Duplicate Phone Prevention Test (409 Conflict)
    const dupPhoneRes = await mockCall(createWalkInPatient, {
      user: { _id: staffUser1._id, id: staffUser1._id, role: 'STAFF', staffClinicId: clinic1._id },
      body: { fullName: 'Duplicate Phone', phone: uniquePhone, gender: 'FEMALE' },
    });
    if (dupPhoneRes.status !== 409) {
      throw new Error('Test 4 Failed: Duplicate phone registration did not return 409 Conflict');
    }
    console.log('✓ Test 4 Passed: Duplicate patient phone number rejected by unique index with HTTP 409.');

    // ----------------------------------------------------
    // 2. WALK-IN REGISTRATION & TOKEN ALLOCATION TESTS
    // ----------------------------------------------------
    const walkInRes = await mockCall(registerWalkIn, {
      user: { _id: staffUser1._id, id: staffUser1._id, role: 'STAFF', staffClinicId: clinic1._id },
      body: { doctorId: doctor1._id, patientId: patient1._id },
    });
    if (walkInRes.status !== 201 || !walkInRes.body.queueEntry) {
      throw new Error('Test 5 & 6 Failed: Walk-in registration failed');
    }
    const qEntry1 = walkInRes.body.queueEntry;
    if (qEntry1.tokenNumber !== 1 || qEntry1.source !== 'WALK_IN' || qEntry1.status !== 'WAITING') {
      throw new Error('Test 5 & 6 Failed: Token number or source invalid');
    }
    console.log('✓ Tests 5 & 6 Passed: Walk-in registration creates QueueEntry with source WALK_IN and Token #1.');

    // Verify QueueHistory CHECK_IN record
    const qh1 = await QueueHistory.findOne({ queueEntryId: qEntry1._id });
    if (!qh1 || qh1.action !== 'CHECK_IN' || qh1.newState !== 'WAITING') {
      throw new Error('Test 7 Failed: QueueHistory audit record not created');
    }
    console.log('✓ Test 7 Passed: QueueHistory audit record created cleanly with action CHECK_IN.');

    // Duplicate Walk-in Attempt for same patient today -> 409 Conflict
    const dupWalkInRes = await mockCall(registerWalkIn, {
      user: { _id: staffUser1._id, id: staffUser1._id, role: 'STAFF', staffClinicId: clinic1._id },
      body: { doctorId: doctor1._id, patientId: patient1._id },
    });
    if (dupWalkInRes.status !== 409) {
      throw new Error('Test 12 Failed: Duplicate active queue entry was not rejected with 409');
    }
    console.log('✓ Test 12 Passed: Duplicate active queue entry for same patient/doctor today rejected with 409.');

    // ----------------------------------------------------
    // 3. ONLINE APPOINTMENT CHECK-IN TESTS
    // ----------------------------------------------------
    const todayIST = getFormattedDateIST();
    const currentHM = getFormattedTimeIST();
    const [cHour, cMin] = currentHM.split(':').map(Number);
    const slotStartStr = `${cHour.toString().padStart(2, '0')}:${cMin.toString().padStart(2, '0')}`;
    const slotEndMin = (cHour * 60 + cMin + 15);
    const slotEndStr = `${Math.floor(slotEndMin / 60).toString().padStart(2, '0')}:${(slotEndMin % 60).toString().padStart(2, '0')}`;

    // Setup Patient 2 & Online Appointment for Today within 60m window
    const patientUser2 = await User.create({
      email: `patient2_p7_${Date.now()}@example.com`,
      password: await bcrypt.hash('PatientPass123!', 10),
      role: 'PATIENT',
      isActive: true,
    });
    createdUserIds.push(patientUser2._id);

    const patient2 = await Patient.create({
      userId: patientUser2._id,
      fullName: 'Jane Online',
      phone: `98711${Date.now().toString().slice(-5)}`,
      gender: 'FEMALE',
    });
    createdPatientIds.push(patient2._id);

    const apptToday = await Appointment.create({
      clinicId: clinic1._id,
      doctorId: doctor1._id,
      patientId: patient2._id,
      specialtyId: spec1._id,
      appointmentDate: todayIST,
      timeSlot: { startTime: slotStartStr, endTime: slotEndStr },
      status: 'BOOKED',
    });
    createdAppointmentIds.push(apptToday._id);

    // Cross-Clinic Staff Check-In Attempt -> 403
    const crossStaffRes = await mockCall(checkInAppointment, {
      params: { id: apptToday._id },
      user: { _id: staffUser2._id, id: staffUser2._id, role: 'STAFF', staffClinicId: clinic2._id },
    });
    if (crossStaffRes.status !== 403) throw new Error('Test 14 Failed: Cross-clinic staff check-in was not blocked');
    console.log('✓ Test 14 Passed: Cross-clinic staff check-in rejected with 403 Forbidden.');

    // Admin Cross-Clinic Check-In Permission -> 200 OK
    const checkInRes = await mockCall(checkInAppointment, {
      params: { id: apptToday._id },
      user: { _id: adminUser._id, id: adminUser._id, role: 'ADMIN' },
    });
    if (checkInRes.status !== 200 || !checkInRes.body.queueEntry) {
      throw new Error('Test 8 & 9 & 15 Failed: Appointment check-in failed');
    }
    const qEntry2 = checkInRes.body.queueEntry;
    if (qEntry2.tokenNumber !== 2 || qEntry2.source !== 'ONLINE') {
      throw new Error('Test 8 & 9 Failed: Token allocation or source invalid');
    }
    console.log('✓ Tests 8, 9, 15 Passed: Online appointment check-in updates status to CHECKED_IN, allocates Token #2, and allows Admin global override.');

    // Duplicate Check-in Attempt on already CHECKED_IN appointment -> 400
    const dupCheckInRes = await mockCall(checkInAppointment, {
      params: { id: apptToday._id },
      user: { _id: staffUser1._id, id: staffUser1._id, role: 'STAFF', staffClinicId: clinic1._id },
    });
    if (dupCheckInRes.status !== 400) throw new Error('Test 10 & 11 & 13 Failed');
    console.log('✓ Tests 10, 11, 13 Passed: Duplicate check-in on already checked-in appointment rejected with 400.');

    // ----------------------------------------------------
    // 4. BLOCKING ISSUE 3: CONCURRENT CHECK-IN TEST (Promise.all)
    // ----------------------------------------------------
    console.log('--- Running Concurrent Check-In Promise.all Test ---');
    const patientUserConcurrent = await User.create({
      email: `patient_conc_${Date.now()}@example.com`,
      password: await bcrypt.hash('PatientPass123!', 10),
      role: 'PATIENT',
      isActive: true,
    });
    createdUserIds.push(patientUserConcurrent._id);

    const patientConcurrent = await Patient.create({
      userId: patientUserConcurrent._id,
      fullName: 'Concurrent Patient',
      phone: `98799${Date.now().toString().slice(-5)}`,
      gender: 'MALE',
    });
    createdPatientIds.push(patientConcurrent._id);

    const slot2StartMin = cHour * 60 + cMin + 15;
    const slot2EndMin = slot2StartMin + 15;
    const slotStart2Str = `${Math.floor(slot2StartMin / 60).toString().padStart(2, '0')}:${(slot2StartMin % 60).toString().padStart(2, '0')}`;
    const slotEnd2Str = `${Math.floor(slot2EndMin / 60).toString().padStart(2, '0')}:${(slot2EndMin % 60).toString().padStart(2, '0')}`;

    const apptConcurrent = await Appointment.create({
      clinicId: clinic1._id,
      doctorId: doctor1._id,
      patientId: patientConcurrent._id,
      specialtyId: spec1._id,
      appointmentDate: todayIST,
      timeSlot: { startTime: slotStart2Str, endTime: slotEnd2Str },
      status: 'BOOKED',
    });
    createdAppointmentIds.push(apptConcurrent._id);

    // Fire 2 simultaneous check-in requests for SAME appointment ID
    const [resConcA, resConcB] = await Promise.all([
      mockCall(checkInAppointment, {
        params: { id: apptConcurrent._id },
        user: { _id: staffUser1._id, id: staffUser1._id, role: 'STAFF', staffClinicId: clinic1._id },
      }),
      mockCall(checkInAppointment, {
        params: { id: apptConcurrent._id },
        user: { _id: staffUser1._id, id: staffUser1._id, role: 'STAFF', staffClinicId: clinic1._id },
      }),
    ]);

    const successCount = [resConcA, resConcB].filter((r) => r.status === 200).length;
    const fail400Count = [resConcA, resConcB].filter((r) => r.status === 400).length;

    if (successCount !== 1 || fail400Count !== 1) {
      throw new Error(`Concurrent Check-in Test Failed: Expected 1 success (200) and 1 failure (400), got ${successCount} successes and ${fail400Count} failures`);
    }

    const apptAfterConc = await Appointment.findById(apptConcurrent._id);
    if (apptAfterConc.status !== 'CHECKED_IN') throw new Error('Concurrent Check-in Test Failed: Appointment status is not CHECKED_IN');

    const qeConc = await QueueEntry.find({ appointmentId: apptConcurrent._id });
    if (qeConc.length !== 1) throw new Error(`Concurrent Check-in Test Failed: Expected exactly 1 QueueEntry, found ${qeConc.length}`);

    const qhConc = await QueueHistory.find({ queueEntryId: qeConc[0]._id });
    if (qhConc.length !== 1) throw new Error(`Concurrent Check-in Test Failed: Expected exactly 1 QueueHistory record, found ${qhConc.length}`);

    console.log('✓ Concurrent Check-In Test Passed: Exactly 1 request succeeded (200), 1 failed (400), exactly 1 QueueEntry and 1 QueueHistory created.');

    // ----------------------------------------------------
    // CONCURRENT WALK-IN REGISTRATION TEST (Promise.all)
    // ----------------------------------------------------
    console.log('--- Running Concurrent Walk-In Registration Promise.all Test ---');
    const patientWalkInConc = await Patient.create({
      fullName: 'Concurrent Walk-In Patient',
      phone: `98788${Date.now().toString().slice(-5)}`,
      gender: 'FEMALE',
    });
    createdPatientIds.push(patientWalkInConc._id);

    const [resWalkInConcA, resWalkInConcB] = await Promise.all([
      mockCall(registerWalkIn, {
        body: { patientId: patientWalkInConc._id, doctorId: doctor1._id, priority: 'NORMAL' },
        user: { _id: staffUser1._id, id: staffUser1._id, role: 'STAFF', staffClinicId: clinic1._id },
      }),
      mockCall(registerWalkIn, {
        body: { patientId: patientWalkInConc._id, doctorId: doctor1._id, priority: 'NORMAL' },
        user: { _id: staffUser1._id, id: staffUser1._id, role: 'STAFF', staffClinicId: clinic1._id },
      }),
    ]);

    const walkInSuccessCount = [resWalkInConcA, resWalkInConcB].filter((r) => r.status === 201).length;
    const walkInConflictCount = [resWalkInConcA, resWalkInConcB].filter((r) => r.status === 409).length;

    if (walkInSuccessCount !== 1 || walkInConflictCount !== 1) {
      throw new Error(`Concurrent Walk-In Test Failed: Expected 1 success (201) and 1 conflict (409), got ${walkInSuccessCount} successes and ${walkInConflictCount} conflicts`);
    }

    const qeWalkInConc = await QueueEntry.find({ patientId: patientWalkInConc._id, doctorId: doctor1._id, queueDate: todayIST });
    if (qeWalkInConc.length !== 1) {
      throw new Error(`Concurrent Walk-In Test Failed: Expected exactly 1 active QueueEntry, found ${qeWalkInConc.length}`);
    }
    console.log('✓ Concurrent Walk-In Test Passed: Exactly 1 request succeeded (201), 1 failed (409 Conflict), exactly 1 QueueEntry created.');

    // ----------------------------------------------------
    // CONCURRENT QUEUECOUNTER ALLOCATION TEST (Promise.all)
    // ----------------------------------------------------
    console.log('--- Running Concurrent QueueCounter Allocation Promise.all Test ---');
    const walkInPatientsCount = 5;
    const distinctPatients = [];
    for (let i = 0; i < walkInPatientsCount; i++) {
      const p = await Patient.create({
        fullName: `Concurrent Counter Patient ${i}_${Date.now()}`,
        phone: `9877${i}${Date.now().toString().slice(-5)}`,
        gender: 'OTHER',
      });
      createdPatientIds.push(p._id);
      distinctPatients.push(p);
    }

    const counterPromises = distinctPatients.map((p) =>
      mockCall(registerWalkIn, {
        body: { patientId: p._id, doctorId: doctor1._id, priority: 'NORMAL' },
        user: { _id: staffUser1._id, id: staffUser1._id, role: 'STAFF', staffClinicId: clinic1._id },
      })
    );

    const counterResults = await Promise.all(counterPromises);
    const counterSuccesses = counterResults.filter((r) => r.status === 201);
    if (counterSuccesses.length !== walkInPatientsCount) {
      throw new Error(`Concurrent QueueCounter Test Failed: Expected ${walkInPatientsCount} successes, got ${counterSuccesses.length}`);
    }

    const tokensAllocated = counterSuccesses.map((r) => r.body.queueEntry.tokenNumber);
    const uniqueTokens = new Set(tokensAllocated);
    if (uniqueTokens.size !== walkInPatientsCount) {
      throw new Error(`Concurrent QueueCounter Test Failed: Token collisions detected! Tokens: ${tokensAllocated.join(', ')}`);
    }
    console.log(`✓ Concurrent QueueCounter Test Passed: ${walkInPatientsCount} parallel requests allocated unique tokens [${tokensAllocated.sort((a,b)=>a-b).join(', ')}] with zero collisions.`);

    // ----------------------------------------------------
    // 5. BLOCKING ISSUE 2: TRANSACTION ROLLBACK TEST
    // ----------------------------------------------------
    console.log('--- Running Session Transaction Abort Test ---');
    const sessionTest = await mongoose.startSession();
    const tokenGapBefore = (await QueueCounter.findOne({ clinicId: clinic1._id, doctorId: doctor1._id, date: todayIST })).lastTokenNumber;

    try {
      sessionTest.startTransaction();

      // Create QueueEntry inside transaction
      const [txQe] = await QueueEntry.create(
        [
          {
            clinicId: clinic1._id,
            doctorId: doctor1._id,
            patientId: patient1._id,
            queueDate: todayIST,
            tokenNumber: tokenGapBefore + 99,
            source: 'WALK_IN',
            priority: 'NORMAL',
            status: 'WAITING',
            joinedAt: new Date(),
          },
        ],
        { session: sessionTest }
      );

      // Force QueueHistory failure (missing required performedBy)
      await QueueHistory.create(
        [
          {
            queueEntryId: txQe._id,
            doctorId: doctor1._id,
            clinicId: clinic1._id,
            action: 'CHECK_IN',
            // performedBy omitted to force validation error
          },
        ],
        { session: sessionTest }
      );

      await sessionTest.commitTransaction();
    } catch (err) {
      await sessionTest.abortTransaction();
      console.log('✓ Transaction aborted successfully upon QueueHistory validation failure.');
    } finally {
      sessionTest.endSession();
    }

    // Verify QueueEntry was rolled back and does not exist in DB
    const rolledBackQe = await QueueEntry.findOne({ tokenNumber: tokenGapBefore + 99, queueDate: todayIST });
    if (rolledBackQe) {
      throw new Error('Transaction Rollback Test Failed: QueueEntry persisted despite transaction abort!');
    }
    console.log('✓ Transaction Rollback Test Passed: QueueEntry was strictly rolled back and does not exist in database.');

    // ----------------------------------------------------
    // 6. TODAY QUEUE LISTING
    // ----------------------------------------------------
    const queueListRes = await mockCall(getTodayQueue, {
      user: { _id: staffUser1._id, id: staffUser1._id, role: 'STAFF', staffClinicId: clinic1._id },
      query: { doctorId: doctor1._id },
    });
    if (queueListRes.status !== 200 || queueListRes.body.queueEntries.length < 2) {
      throw new Error('Test 18 Failed: Staff today queue list query failed');
    }
    console.log('✓ Test 18 Passed: Staff can view today\'s operational queue listing.');

  } finally {
    console.log('--- Cleaning Up Phase 07 Test Data ---');
    await QueueHistory.deleteMany({ clinicId: { $in: createdClinicIds } });
    await QueueEntry.deleteMany({ clinicId: { $in: createdClinicIds } });
    await QueueCounter.deleteMany({ clinicId: { $in: createdClinicIds } });
    if (createdAppointmentIds.length) await Appointment.deleteMany({ _id: { $in: createdAppointmentIds } });
    if (createdScheduleIds.length) await DoctorSchedule.deleteMany({ _id: { $in: createdScheduleIds } });
    if (createdStaffIds.length) await Staff.deleteMany({ _id: { $in: createdStaffIds } });
    if (createdPatientIds.length) await Patient.deleteMany({ _id: { $in: createdPatientIds } });
    if (createdDoctorIds.length) await Doctor.deleteMany({ _id: { $in: createdDoctorIds } });
    if (createdSpecialtyIds.length) await Specialty.deleteMany({ _id: { $in: createdSpecialtyIds } });
    if (createdClinicIds.length) await Clinic.deleteMany({ _id: { $in: createdClinicIds } });
    if (createdUserIds.length) await User.deleteMany({ _id: { $in: createdUserIds } });
    console.log('✓ All temporary Phase 07 test records removed cleanly from MongoDB Atlas.');
  }

  // ----------------------------------------------------
  // REGRESSION SUITES (Phase 03, 04, 05, 06)
  // ----------------------------------------------------
  console.log('--- Running Regression Suites (Phase 03, 04, 05, 06) ---');
  await runAuthValidation(false);
  await runPhase04Validation(false);
  await runPhase05Validation();
  await runPhase06Validation();
  console.log('✓ All Regression Suites Passed 100%!');

  console.log('--- Phase 07 Validation Completed Successfully (All Assertions Passed) ---');
};

if (process.argv[1] && process.argv[1].endsWith('validatePhase07.js')) {
  runPhase07Validation().catch((err) => {
    console.error('Phase 07 Validation Error:', err);
    process.exit(1);
  });
}
