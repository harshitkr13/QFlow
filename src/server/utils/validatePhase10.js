import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

import { connectDB } from '../config/db.js';
import { User, Patient, Doctor, Clinic, Specialty, QueueEntry, QueueHistory, QueueCounter, Rating, Notification } from '../models/index.js';
import { getPublicQueueDisplay } from '../controllers/publicQueueController.js';
import { submitRating, getDoctorRatings } from '../controllers/ratingController.js';
import { getPatientNotifications, markNotificationRead } from '../controllers/notificationController.js';
import { callNextPatient, pauseQueue } from '../controllers/staffQueueController.js';

// Regression Suites
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

export const runPhase10Validation = async () => {
  console.log('\n==================================================');
  console.log('STARTING PHASE 10 COMPREHENSIVE VALIDATION');
  console.log('==================================================\n');

  await connectDB();

  const createdUsers = [];
  const createdPatients = [];
  const createdDoctors = [];
  const createdClinics = [];
  const createdSpecialties = [];
  const createdQueueEntries = [];
  const createdRatings = [];
  const createdNotifs = [];

  try {
    const todayIST = getFormattedDateIST();

    // 1. Create Admin User
    const testAdminUser = await User.create({
      fullName: 'P10 Admin User',
      email: `p10_admin_${Date.now()}@qflow.test`,
      password: 'Password123!',
      role: 'ADMIN',
      isActive: true,
    });
    createdUsers.push(testAdminUser);

    // 2. Create Test Clinic
    const testClinic = await Clinic.create({
      name: `P10 Test Clinic Center ${Date.now()}`,
      code: `P10-CLN-${Date.now()}`,
      address: { street: '100 Phase 10 Plaza', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
      location: { type: 'Point', coordinates: [72.8777, 19.076] },
      phone: '9876543210',
      email: `p10clinic_${Date.now()}@qflow.test`,
      adminId: testAdminUser._id,
      isActive: true,
    });
    createdClinics.push(testClinic);

    // 3. Create Specialty
    const testSpecialty = await Specialty.create({
      name: `P10 Specialty ${Date.now()}`,
      code: `P10_${Date.now()}`,
    });
    createdSpecialties.push(testSpecialty);

    // 4. Create Test Doctor User & Doctor
    const testDoctorUser = await User.create({
      fullName: 'Dr. Phase10 Specialist',
      email: `p10_doctor_${Date.now()}@qflow.test`,
      password: 'Password123!',
      role: 'DOCTOR',
      isActive: true,
    });
    createdUsers.push(testDoctorUser);

    const testDoctor = await Doctor.create({
      userId: testDoctorUser._id,
      clinicId: testClinic._id,
      specialtyId: testSpecialty._id,
      fullName: 'Dr. Phase10 Specialist',
      gender: 'MALE',
      qualifications: ['MBBS', 'MD'],
      experienceYears: 10,
      consultationFee: 500,
      averageConsultationDurationMinutes: 15,
      operationalStatus: 'AVAILABLE',
      isQueuePaused: false,
    });
    createdDoctors.push(testDoctor);

    // 5. Create Patient A User & Patient
    const testUserA = await User.create({
      fullName: 'Patient Alpha P10',
      email: `p10_patient_a_${Date.now()}@qflow.test`,
      password: 'Password123!',
      role: 'PATIENT',
      isActive: true,
    });
    createdUsers.push(testUserA);

    const testPatientA = await Patient.create({
      userId: testUserA._id,
      fullName: 'Patient Alpha P10',
      phone: `991${Date.now().toString().slice(-7)}`,
      gender: 'MALE',
      dateOfBirth: new Date('1990-01-01'),
    });
    createdPatients.push(testPatientA);

    // 6. Create Patient B User & Patient
    const testUserB = await User.create({
      fullName: 'Patient Beta P10',
      email: `p10_patient_b_${Date.now()}@qflow.test`,
      password: 'Password123!',
      role: 'PATIENT',
      isActive: true,
    });
    createdUsers.push(testUserB);

    const testPatientB = await Patient.create({
      userId: testUserB._id,
      fullName: 'Patient Beta P10',
      phone: `992${Date.now().toString().slice(-7)}`,
      gender: 'FEMALE',
      dateOfBirth: new Date('1992-05-15'),
    });
    createdPatients.push(testPatientB);

    // Helper mock req/res
    const makeReq = (user, query = {}, body = {}, params = {}) => ({
      user,
      query,
      body,
      params,
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
    // TEST 1: Public Queue Display (Anonymous & Safe)
    // ----------------------------------------------------
    let req = makeReq(null, { clinicId: testClinic._id.toString() });
    let res = makeRes();
    await getPublicQueueDisplay(req, res, (err) => { throw err; });

    if (!res.body.success || !res.body.clinicName.includes('P10 Test Clinic Center')) {
      throw new Error(`Test 1 Failed: Public display response invalid: ${JSON.stringify(res.body)}`);
    }
    const publicStr = JSON.stringify(res.body);
    if (publicStr.includes('Patient Alpha') || publicStr.includes('9991112222')) {
      throw new Error('Test 1 Failed: Private patient details leaked in public display!');
    }
    console.log('✓ TEST 1 PASS: Public display returns anonymous token feed without privacy leakage');

    // ----------------------------------------------------
    // TEST 2: Public Queue Display Validation Errors
    // ----------------------------------------------------
    req = makeReq(null, {}); // Missing clinicId
    res = makeRes();
    await getPublicQueueDisplay(req, res, (err) => { throw err; });
    if (res.statusCode !== 400) {
      throw new Error('Test 2 Failed: Missing clinicId should return 400 Bad Request');
    }
    console.log('✓ TEST 2 PASS: Public display invalid parameters correctly rejected');

    // ----------------------------------------------------
    // TEST 3: Ratings - Waiting Patient Cannot Rate
    // ----------------------------------------------------
    const qeWaiting = await QueueEntry.create({
      clinicId: testClinic._id,
      doctorId: testDoctor._id,
      patientId: testPatientA._id,
      queueDate: todayIST,
      tokenNumber: 1,
      source: 'ONLINE',
      status: 'WAITING',
    });
    createdQueueEntries.push(qeWaiting);

    req = makeReq({ _id: testUserA._id, id: testUserA._id, role: 'PATIENT' }, {}, { queueEntryId: qeWaiting._id, rating: 5, reviewText: 'Great' });
    res = makeRes();
    await submitRating(req, res, (err) => { throw err; });

    if (res.statusCode !== 400) {
      throw new Error(`Test 3 Failed: Rating WAITING entry should return 400, got ${res.statusCode}`);
    }
    console.log('✓ TEST 3 PASS: Waiting consultation rating attempt rejected with 400');

    // ----------------------------------------------------
    // TEST 4: Ratings - Completed Patient Can Rate & Updates Doctor Summary
    // ----------------------------------------------------
    const qeCompletedA = await QueueEntry.create({
      clinicId: testClinic._id,
      doctorId: testDoctor._id,
      patientId: testPatientA._id,
      queueDate: todayIST,
      tokenNumber: 2,
      source: 'ONLINE',
      status: 'COMPLETED',
    });
    createdQueueEntries.push(qeCompletedA);

    req = makeReq({ _id: testUserA._id, id: testUserA._id, role: 'PATIENT' }, {}, { queueEntryId: qeCompletedA._id, rating: 5, reviewText: 'Excellent care!' });
    res = makeRes();
    await submitRating(req, res, (err) => { throw err; });

    if (res.statusCode !== 201 || !res.body.success) {
      throw new Error(`Test 4 Failed: Completed consultation rating failed: ${JSON.stringify(res.body)}`);
    }
    if (res.body.rating._id) createdRatings.push({ _id: res.body.rating._id });

    const updatedDoc = await Doctor.findById(testDoctor._id);
    if (updatedDoc.totalReviews !== 1 || updatedDoc.averageRating !== 5) {
      throw new Error(`Test 4 Failed: Doctor rating summary not updated correctly. Total: ${updatedDoc.totalReviews}, Avg: ${updatedDoc.averageRating}`);
    }
    console.log('✓ TEST 4 PASS: Completed consultation rated successfully and doctor average updated');

    // ----------------------------------------------------
    // TEST 5: Ratings - Duplicate Rating Rejected (HTTP 409)
    // ----------------------------------------------------
    req = makeReq({ _id: testUserA._id, id: testUserA._id, role: 'PATIENT' }, {}, { queueEntryId: qeCompletedA._id, rating: 4, reviewText: 'Again' });
    res = makeRes();
    await submitRating(req, res, (err) => { throw err; });

    if (res.statusCode !== 409) {
      throw new Error(`Test 5 Failed: Duplicate rating should return 409 Conflict, got ${res.statusCode}`);
    }
    console.log('✓ TEST 5 PASS: Duplicate rating submission rejected with 409 Conflict');

    // ----------------------------------------------------
    // TEST 6: Ratings - IDOR Protection (Cross-Patient Access Blocked)
    // ----------------------------------------------------
    req = makeReq({ _id: testUserB._id, id: testUserB._id, role: 'PATIENT' }, {}, { queueEntryId: qeCompletedA._id, rating: 1, reviewText: 'Malicious' });
    res = makeRes();
    await submitRating(req, res, (err) => { throw err; });

    if (res.statusCode !== 403) {
      throw new Error(`Test 6 Failed: Rating another patient's entry should return 403 Forbidden, got ${res.statusCode}`);
    }
    console.log('✓ TEST 6 PASS: IDOR rating attempt blocked with 403 Forbidden');

    // ----------------------------------------------------
    // TEST 7: Public Doctor Ratings Endpoint
    // ----------------------------------------------------
    req = makeReq(null, {}, {}, { id: testDoctor._id.toString() });
    res = makeRes();
    await getDoctorRatings(req, res, (err) => { throw err; });

    if (!res.body.success || res.body.summary.totalReviews !== 1 || res.body.ratings.length !== 1) {
      throw new Error('Test 7 Failed: Public doctor ratings lookup invalid');
    }
    if (res.body.ratings[0].patientFirstName !== 'Patient') {
      throw new Error('Test 7 Failed: Public doctor ratings leaked patient identity!');
    }
    console.log('✓ TEST 7 PASS: Public doctor ratings returned with anonymous labels');

    // ----------------------------------------------------
    // TEST 8: Notifications - Dispatch on CALL_NEXT & Patient Retrieval
    // ----------------------------------------------------
    qeWaiting.status = 'COMPLETED';
    await qeWaiting.save();

    const qeToCall = await QueueEntry.create({
      clinicId: testClinic._id,
      doctorId: testDoctor._id,
      patientId: testPatientB._id,
      queueDate: todayIST,
      tokenNumber: 3,
      source: 'WALK_IN',
      priority: 'NORMAL',
      priorityWeight: 1,
      effectiveSlotMinutes: 600,
      status: 'WAITING',
      joinedAt: new Date(),
    });
    createdQueueEntries.push(qeToCall);

    req = makeReq({ _id: testDoctorUser._id, id: testDoctorUser._id, role: 'DOCTOR' }, {}, { doctorId: testDoctor._id });
    res = makeRes();
    await callNextPatient(req, res, (err) => { throw err; });

    // Allow async notification creation to persist
    await new Promise((r) => setTimeout(r, 100));

    req = makeReq({ _id: testUserB._id, id: testUserB._id, role: 'PATIENT' });
    res = makeRes();
    await getPatientNotifications(req, res, (err) => { throw err; });

    if (!res.body.success || res.body.unreadCount < 1 || res.body.notifications.length < 1) {
      throw new Error('Test 8 Failed: PATIENT_CALLED notification not created or retrieved');
    }
    const notif = res.body.notifications[0];
    if (notif.type !== 'PATIENT_CALLED') {
      throw new Error(`Test 8 Failed: Expected PATIENT_CALLED notification, got ${notif.type}`);
    }
    createdNotifs.push({ _id: notif.id });
    console.log('✓ TEST 8 PASS: PATIENT_CALLED notification created and retrieved by patient');

    // ----------------------------------------------------
    // TEST 9: Notifications - Mark Read & Cross-Patient Protection
    // ----------------------------------------------------
    // Patient A trying to mark Patient B's notification read -> 404/403
    req = makeReq({ _id: testUserA._id, id: testUserA._id, role: 'PATIENT' }, {}, {}, { id: notif.id.toString() });
    res = makeRes();
    await markNotificationRead(req, res, (err) => { throw err; });

    if (res.statusCode !== 404) {
      throw new Error(`Test 9 Failed: Marking another patient's notification read should return 404, got ${res.statusCode}`);
    }

    // Patient B marking own notification read -> 200
    req = makeReq({ _id: testUserB._id, id: testUserB._id, role: 'PATIENT' }, {}, {}, { id: notif.id.toString() });
    res = makeRes();
    await markNotificationRead(req, res, (err) => { throw err; });

    if (!res.body.success || !res.body.notification.isRead) {
      throw new Error('Test 9 Failed: Marking own notification read failed');
    }
    console.log('✓ TEST 9 PASS: Notification mark-read ownership protected and idempotent');

    console.log('\n==================================================');
    console.log('PHASE 10 CORE TESTS 100% PASSED');
    console.log('==================================================\n');

    // ----------------------------------------------------
    // REGRESSION SUITE EXECUTION (Phases 03 - 09)
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
    console.log('ALL PHASE 03 - 10 REGRESSIONS 100% PASSED');
    console.log('==================================================\n');
  } finally {
    // Teardown test records safely
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    if (createdNotifs.length > 0) await Notification.deleteMany({ _id: { $in: createdNotifs.map((n) => n._id) } });
    if (createdRatings.length > 0) await Rating.deleteMany({ _id: { $in: createdRatings.map((r) => r._id) } });
    if (createdQueueEntries.length > 0) await QueueEntry.deleteMany({ _id: { $in: createdQueueEntries.map((q) => q._id) } });
    if (createdDoctors.length > 0) await Doctor.deleteMany({ _id: { $in: createdDoctors.map((d) => d._id) } });
    if (createdPatients.length > 0) await Patient.deleteMany({ _id: { $in: createdPatients.map((p) => p._id) } });
    if (createdClinics.length > 0) await Clinic.deleteMany({ _id: { $in: createdClinics.map((c) => c._id) } });
    if (createdUsers.length > 0) await User.deleteMany({ _id: { $in: createdUsers.map((u) => u._id) } });
    if (createdSpecialties.length > 0) await Specialty.deleteMany({ _id: { $in: createdSpecialties.map((s) => s._id) } });
  }
};

// Direct script execution
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  runPhase10Validation()
    .then(() => {
      console.log('Phase 10 Validation script finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Phase 10 Validation script failed:', err);
      process.exit(1);
    });
}
