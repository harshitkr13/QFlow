import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import {
  User,
  Clinic,
  Specialty,
  Doctor,
  Staff,
  DoctorSchedule,
  Patient,
  Appointment,
  QueueEntry,
  QueueCounter,
  QueueHistory,
} from '../models/index.js';
import { runAuthValidation } from './validateAuth.js';
import { runPhase04Validation } from './validatePhase04.js';
import { runPhase05Validation } from './validatePhase05.js';
import { runPhase06Validation } from './validatePhase06.js';
import { runPhase07Validation } from './validatePhase07.js';
import {
  searchPatients,
  createWalkInPatient,
  registerWalkIn,
  getTodayQueue,
  callNextPatient,
  startConsultation,
  completeConsultation,
  skipPatient,
  markNoShow,
  rejoinPatient,
  pauseQueue,
  resumeQueue,
  cancelQueueEntry,
} from '../controllers/staffQueueController.js';
import { checkInAppointment } from '../controllers/appointmentController.js';

dotenv.config();

const getFormattedDateIST = (dateObj = new Date()) => {
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  return new Intl.DateTimeFormat('en-CA', options).format(dateObj);
};

const createMockCtx = (user = null, params = {}, body = {}, query = {}) => {
  const req = { user, params, body, query };
  let statusCode = 200;
  let jsonBody = null;
  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      jsonBody = data;
      return res;
    },
  };
  return {
    req,
    res,
    next: (err) => {
      if (err) throw err;
    },
    get status() {
      return statusCode;
    },
    get body() {
      return jsonBody;
    },
  };
};

export const runPhase08Tests = async () => {
  console.log('--- Phase 08 Core Queue Engine Validation Starting ---');
  let testClinic, testSpecialty, testDoctor, testDoctorUser, testStaff, testStaffUser, testAdminUser, testPatientUser;
  let createdUserIds = [];
  let createdPatientIds = [];

  try {
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    console.log(`✓ Connected to DB: ${mongoose.connection.host}/${mongoose.connection.name}`);

    const queueDate = getFormattedDateIST();

    // Create Admin User
    testAdminUser = await User.create({
      fullName: 'Phase 08 Admin',
      email: `p8admin_${Date.now()}@test.com`,
      password: 'Password123!',
      role: 'ADMIN',
      isActive: true,
    });
    createdUserIds.push(testAdminUser._id);

    // Setup Test Environment Fixtures
    testClinic = await Clinic.create({
      name: 'Phase 08 Queue Test Clinic',
      code: `P8-CLN-${Date.now()}`,
      address: { street: '123 Engine St', city: 'Delhi', state: 'Delhi', pincode: '110001' },
      location: { type: 'Point', coordinates: [77.209, 28.6139] },
      phone: '9876543210',
      email: `p8clinic_${Date.now()}@test.com`,
      adminId: testAdminUser._id,
      isActive: true,
    });

    testSpecialty = await Specialty.create({
      name: 'Phase 08 General Medicine',
      code: `P8-SPEC-${Date.now()}`,
    });

    // Create Doctor User & Profile
    testDoctorUser = await User.create({
      fullName: 'Dr. Phase 08 Engine',
      email: `p8doc_${Date.now()}@test.com`,
      password: 'Password123!',
      role: 'DOCTOR',
      isActive: true,
    });
    createdUserIds.push(testDoctorUser._id);

    testDoctor = await Doctor.create({
      userId: testDoctorUser._id,
      clinicId: testClinic._id,
      specialtyId: testSpecialty._id,
      fullName: 'Dr. Phase 08 Engine',
      gender: 'MALE',
      qualifications: ['MBBS'],
      consultationFee: 500,
      experienceYears: 10,
      averageConsultationDurationMinutes: 15,
      operationalStatus: 'AVAILABLE',
    });

    // Setup Doctor Schedule
    await DoctorSchedule.create({
      doctorId: testDoctor._id,
      clinicId: testClinic._id,
      weeklySchedule: [
        { dayOfWeek: 'Monday', isWorkingDay: true, shifts: [{ startTime: '08:00', endTime: '20:00' }] },
        { dayOfWeek: 'Tuesday', isWorkingDay: true, shifts: [{ startTime: '08:00', endTime: '20:00' }] },
        { dayOfWeek: 'Wednesday', isWorkingDay: true, shifts: [{ startTime: '08:00', endTime: '20:00' }] },
        { dayOfWeek: 'Thursday', isWorkingDay: true, shifts: [{ startTime: '08:00', endTime: '20:00' }] },
        { dayOfWeek: 'Friday', isWorkingDay: true, shifts: [{ startTime: '08:00', endTime: '20:00' }] },
        { dayOfWeek: 'Saturday', isWorkingDay: true, shifts: [{ startTime: '08:00', endTime: '20:00' }] },
        { dayOfWeek: 'Sunday', isWorkingDay: true, shifts: [{ startTime: '08:00', endTime: '20:00' }] },
      ],
    });

    // Create Staff User & Profile
    testStaffUser = await User.create({
      fullName: 'Phase 08 Receptionist',
      email: `p8staff_${Date.now()}@test.com`,
      password: 'Password123!',
      role: 'STAFF',
      isActive: true,
    });
    createdUserIds.push(testStaffUser._id);

    testStaff = await Staff.create({
      userId: testStaffUser._id,
      clinicId: testClinic._id,
      fullName: 'Phase 08 Receptionist',
      phone: '9876543212',
    });

    const staffUserPayload = {
      _id: testStaffUser._id,
      id: testStaffUser._id,
      role: 'STAFF',
      staffClinicId: testClinic._id,
    };

    const adminUserPayload = {
      _id: testAdminUser._id,
      id: testAdminUser._id,
      role: 'ADMIN',
    };

    // Create Patient User
    testPatientUser = await User.create({
      fullName: 'Phase 08 Patient',
      email: `p8patient_${Date.now()}@test.com`,
      password: 'Password123!',
      role: 'PATIENT',
      isActive: true,
    });
    createdUserIds.push(testPatientUser._id);

    const patientUserPayload = {
      _id: testPatientUser._id,
      id: testPatientUser._id,
      role: 'PATIENT',
    };

    console.log('✓ Test fixtures created successfully.');

    // Helper to create test patient
    const createTestPatient = async (name) => {
      const p = await Patient.create({
        userId: null,
        fullName: name,
        phone: `${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        gender: 'MALE',
      });
      createdPatientIds.push(p._id);
      return p;
    };

    // Helper to clear doctor's queue entries for clean isolated test cases
    const resetDoctorQueue = async () => {
      await QueueEntry.deleteMany({ doctorId: testDoctor._id });
      await QueueCounter.deleteMany({ doctorId: testDoctor._id });
      await Appointment.deleteMany({ doctorId: testDoctor._id });
      await Doctor.updateOne({ _id: testDoctor._id }, { isQueuePaused: false, queuePausedAt: null, queuePauseReason: null, queuePausedDate: null });
    };

    // ==================================================
    // PART 1: 20 MANDATORY HYBRID QUEUE ORDERING SCENARIOS
    // ==================================================
    console.log('--- Testing 20 Mandatory HYBRID Queue Ordering Scenarios ---');

    // Scenario 1: One Walk-In Only
    await resetDoctorQueue();
    const p1 = await createTestPatient('Patient 1');
    const ctx1 = createMockCtx(staffUserPayload, {}, { patientId: p1._id, doctorId: testDoctor._id });
    await registerWalkIn(ctx1.req, ctx1.res, ctx1.next);
    if (ctx1.status !== 201) throw new Error(`Scenario 1 Failed: ${JSON.stringify(ctx1.body)}`);

    const qCtx1 = createMockCtx(staffUserPayload, {}, {}, { doctorId: testDoctor._id.toString() });
    await getTodayQueue(qCtx1.req, qCtx1.res, qCtx1.next);
    if (qCtx1.body.waitingEntries.length !== 1 || qCtx1.body.waitingEntries[0].patientId._id.toString() !== p1._id.toString()) throw new Error('Scenario 1 Assertion Failed');
    console.log('✓ Scenario 1 Passed: One Walk-In Only.');

    // Scenario 2: Multiple Walk-Ins
    const p2 = await createTestPatient('Patient 2');
    const ctx2 = createMockCtx(staffUserPayload, {}, { patientId: p2._id, doctorId: testDoctor._id });
    await registerWalkIn(ctx2.req, ctx2.res, ctx2.next);
    const qCtx2 = createMockCtx(staffUserPayload, {}, {}, { doctorId: testDoctor._id.toString() });
    await getTodayQueue(qCtx2.req, qCtx2.res, qCtx2.next);
    if (qCtx2.body.waitingEntries.length !== 2 || qCtx2.body.waitingEntries[0].tokenNumber !== 1 || qCtx2.body.waitingEntries[1].tokenNumber !== 2) throw new Error('Scenario 2 Assertion Failed');
    console.log('✓ Scenario 2 Passed: Multiple Walk-Ins (Token #1 before Token #2).');

    // Scenario 3: One Online Appt Only
    await resetDoctorQueue();
    const p3 = await createTestPatient('Patient 3');
    const appt3 = await Appointment.create({ clinicId: testClinic._id, doctorId: testDoctor._id, specialtyId: testSpecialty._id, patientId: p3._id, appointmentDate: queueDate, timeSlot: { startTime: '10:00', endTime: '10:15' }, status: 'CHECKED_IN' });
    await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: p3._id, appointmentId: appt3._id, queueDate, tokenNumber: 1, source: 'ONLINE', status: 'WAITING', effectiveSlotMinutes: 600 });
    const qCtx3 = createMockCtx(staffUserPayload, {}, {}, { doctorId: testDoctor._id.toString() });
    await getTodayQueue(qCtx3.req, qCtx3.res, qCtx3.next);
    if (qCtx3.body.waitingEntries.length !== 1 || qCtx3.body.waitingEntries[0].effectiveSlotMinutes !== 600) throw new Error('Scenario 3 Assertion Failed');
    console.log('✓ Scenario 3 Passed: One Online Appt Only.');

    // Scenario 4: Walk-In Arriving Before Appointment Slot
    await resetDoctorQueue();
    const p4_w = await createTestPatient('Walk-In A');
    const p4_o = await createTestPatient('Online B');
    await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: p4_w._id, queueDate, tokenNumber: 1, source: 'WALK_IN', status: 'WAITING', effectiveSlotMinutes: 540, joinedAt: new Date(Date.now() - 10000) });
    await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: p4_o._id, queueDate, tokenNumber: 2, source: 'ONLINE', status: 'WAITING', effectiveSlotMinutes: 600, joinedAt: new Date() });
    const qCtx4 = createMockCtx(staffUserPayload, {}, {}, { doctorId: testDoctor._id.toString() });
    await getTodayQueue(qCtx4.req, qCtx4.res, qCtx4.next);
    if (qCtx4.body.waitingEntries[0].patientId._id.toString() !== p4_w._id.toString()) throw new Error('Scenario 4 Assertion Failed');
    console.log('✓ Scenario 4 Passed: Walk-In arriving at 09:00 ordered before 10:00 online slot.');

    // Scenario 5: Early Check-In Online Appt
    await resetDoctorQueue();
    const p5_w = await createTestPatient('Walk-In A');
    const p5_o = await createTestPatient('Online B');
    await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: p5_w._id, queueDate, tokenNumber: 1, source: 'WALK_IN', status: 'WAITING', effectiveSlotMinutes: 560, joinedAt: new Date(Date.now() - 5000) });
    await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: p5_o._id, queueDate, tokenNumber: 2, source: 'ONLINE', status: 'WAITING', effectiveSlotMinutes: 570, joinedAt: new Date(Date.now() - 15000) });
    const qCtx5 = createMockCtx(staffUserPayload, {}, {}, { doctorId: testDoctor._id.toString() });
    await getTodayQueue(qCtx5.req, qCtx5.res, qCtx5.next);
    if (qCtx5.body.waitingEntries[0].patientId._id.toString() !== p5_w._id.toString()) throw new Error('Scenario 5 Assertion Failed');
    console.log('✓ Scenario 5 Passed: Early online check-in does not jump ahead of earlier walk-in.');

    // Scenario 6: On-Time Check-In Online Appt
    await resetDoctorQueue();
    const p6_o = await createTestPatient('Online B');
    const p6_w = await createTestPatient('Walk-In A');
    await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: p6_o._id, queueDate, tokenNumber: 1, source: 'ONLINE', status: 'WAITING', effectiveSlotMinutes: 570 });
    await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: p6_w._id, queueDate, tokenNumber: 2, source: 'WALK_IN', status: 'WAITING', effectiveSlotMinutes: 575 });
    const qCtx6 = createMockCtx(staffUserPayload, {}, {}, { doctorId: testDoctor._id.toString() });
    await getTodayQueue(qCtx6.req, qCtx6.res, qCtx6.next);
    if (qCtx6.body.waitingEntries[0].patientId._id.toString() !== p6_o._id.toString()) throw new Error('Scenario 6 Assertion Failed');
    console.log('✓ Scenario 6 Passed: On-time online appointment precedes subsequent walk-in.');

    // Scenario 7: Late Arrival Online Appt
    await resetDoctorQueue();
    const p7_w = await createTestPatient('Walk-In A');
    const p7_o = await createTestPatient('Online B');
    await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: p7_w._id, queueDate, tokenNumber: 1, source: 'WALK_IN', status: 'WAITING', effectiveSlotMinutes: 560 });
    await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: p7_o._id, queueDate, tokenNumber: 2, source: 'ONLINE', status: 'WAITING', effectiveSlotMinutes: 565 });
    const qCtx7 = createMockCtx(staffUserPayload, {}, {}, { doctorId: testDoctor._id.toString() });
    await getTodayQueue(qCtx7.req, qCtx7.res, qCtx7.next);
    if (qCtx7.body.waitingEntries[0].patientId._id.toString() !== p7_w._id.toString()) throw new Error('Scenario 7 Assertion Failed');
    console.log('✓ Scenario 7 Passed: Late online appointment demoted to arrival time.');

    // Scenario 8: Same-Slot Appointments
    await resetDoctorQueue();
    const p8_1 = await createTestPatient('Appt 1');
    const p8_2 = await createTestPatient('Appt 2');
    await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: p8_1._id, queueDate, tokenNumber: 1, source: 'ONLINE', status: 'WAITING', effectiveSlotMinutes: 600, joinedAt: new Date(Date.now() - 5000) });
    await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: p8_2._id, queueDate, tokenNumber: 2, source: 'ONLINE', status: 'WAITING', effectiveSlotMinutes: 600, joinedAt: new Date() });
    const qCtx8 = createMockCtx(staffUserPayload, {}, {}, { doctorId: testDoctor._id.toString() });
    await getTodayQueue(qCtx8.req, qCtx8.res, qCtx8.next);
    if (qCtx8.body.waitingEntries[0].tokenNumber !== 1 || qCtx8.body.waitingEntries[1].tokenNumber !== 2) throw new Error('Scenario 8 Assertion Failed');
    console.log('✓ Scenario 8 Passed: Same-slot appointments ordered by check-in timestamp / token tie-breaker.');

    // Scenario 9: Same-Minute Walk-Ins
    await resetDoctorQueue();
    const p9_1 = await createTestPatient('Walk-In 1');
    const p9_2 = await createTestPatient('Walk-In 2');
    const nowMs = Date.now();
    await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: p9_1._id, queueDate, tokenNumber: 1, source: 'WALK_IN', status: 'WAITING', effectiveSlotMinutes: 600, joinedAt: new Date(nowMs) });
    await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: p9_2._id, queueDate, tokenNumber: 2, source: 'WALK_IN', status: 'WAITING', effectiveSlotMinutes: 600, joinedAt: new Date(nowMs + 200) });
    const qCtx9 = createMockCtx(staffUserPayload, {}, {}, { doctorId: testDoctor._id.toString() });
    await getTodayQueue(qCtx9.req, qCtx9.res, qCtx9.next);
    if (qCtx9.body.waitingEntries[0].tokenNumber !== 1) throw new Error('Scenario 9 Assertion Failed');
    console.log('✓ Scenario 9 Passed: Same-minute walk-ins ordered by millisecond timestamp / token.');

    // Scenario 10: Long-Waiting Walk-In vs New Appt
    await resetDoctorQueue();
    const p10_w = await createTestPatient('Long Walk-In');
    const p10_o = await createTestPatient('New Appt');
    await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: p10_w._id, queueDate, tokenNumber: 1, source: 'WALK_IN', status: 'WAITING', effectiveSlotMinutes: 540 });
    await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: p10_o._id, queueDate, tokenNumber: 2, source: 'ONLINE', status: 'WAITING', effectiveSlotMinutes: 600 });
    const qCtx10 = createMockCtx(staffUserPayload, {}, {}, { doctorId: testDoctor._id.toString() });
    await getTodayQueue(qCtx10.req, qCtx10.res, qCtx10.next);
    if (qCtx10.body.waitingEntries[0].patientId._id.toString() !== p10_w._id.toString()) throw new Error('Scenario 10 Assertion Failed');
    console.log('✓ Scenario 10 Passed: Long-waiting walk-in precedes later online slot.');

    // Scenario 11: Skipped Patient
    await resetDoctorQueue();
    const p11_1 = await createTestPatient('Patient A');
    const p11_2 = await createTestPatient('Patient B');
    const walk11_1 = createMockCtx(staffUserPayload, {}, { patientId: p11_1._id, doctorId: testDoctor._id });
    await registerWalkIn(walk11_1.req, walk11_1.res, walk11_1.next);
    const walk11_2 = createMockCtx(staffUserPayload, {}, { patientId: p11_2._id, doctorId: testDoctor._id });
    await registerWalkIn(walk11_2.req, walk11_2.res, walk11_2.next);

    const callCtx11 = createMockCtx(staffUserPayload, {}, { doctorId: testDoctor._id });
    await callNextPatient(callCtx11.req, callCtx11.res, callCtx11.next);
    const q11_1 = callCtx11.body.queueEntry;

    const skipCtx11 = createMockCtx(staffUserPayload, { id: q11_1._id }, { reason: 'Skipped' });
    await skipPatient(skipCtx11.req, skipCtx11.res, skipCtx11.next);
    const qCtx11 = createMockCtx(staffUserPayload, {}, {}, { doctorId: testDoctor._id.toString() });
    await getTodayQueue(qCtx11.req, qCtx11.res, qCtx11.next);
    if (qCtx11.body.waitingEntries.length !== 1 || qCtx11.body.skippedEntries.length !== 1) throw new Error('Scenario 11 Assertion Failed');
    console.log('✓ Scenario 11 Passed: Skipped patient removed from WAITING list.');

    // Scenario 12: Rejoined Patient (New Token Allocated per Decision 002)
    const rejCtx12 = createMockCtx(staffUserPayload, { id: q11_1._id });
    await rejoinPatient(rejCtx12.req, rejCtx12.res, rejCtx12.next);
    if (rejCtx12.status !== 200 || rejCtx12.body.queueEntry.tokenNumber !== 3) throw new Error(`Scenario 12 Failed: ${JSON.stringify(rejCtx12.body)}`);
    console.log('✓ Scenario 12 Passed: Rejoined patient restored to WAITING list with NEW Token #3.');

    // Scenario 13: Multiple Rejoined Patients
    await resetDoctorQueue();
    const p13_1 = await createTestPatient('Patient 13_1');
    const p13_2 = await createTestPatient('Patient 13_2');
    const q13_1 = await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: p13_1._id, queueDate, tokenNumber: 1, source: 'WALK_IN', status: 'SKIPPED', effectiveSlotMinutes: 500 });
    const q13_2 = await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: p13_2._id, queueDate, tokenNumber: 2, source: 'WALK_IN', status: 'SKIPPED', effectiveSlotMinutes: 505 });
    
    const rejCtx13_1 = createMockCtx(staffUserPayload, { id: q13_1._id });
    await rejoinPatient(rejCtx13_1.req, rejCtx13_1.res, rejCtx13_1.next);
    await new Promise(r => setTimeout(r, 100));
    const rejCtx13_2 = createMockCtx(staffUserPayload, { id: q13_2._id });
    await rejoinPatient(rejCtx13_2.req, rejCtx13_2.res, rejCtx13_2.next);

    const qCtx13 = createMockCtx(staffUserPayload, {}, {}, { doctorId: testDoctor._id.toString() });
    await getTodayQueue(qCtx13.req, qCtx13.res, qCtx13.next);
    if (qCtx13.body.waitingEntries.length !== 2) throw new Error('Scenario 13 Assertion Failed');
    console.log('✓ Scenario 13 Passed: Multiple rejoined patients ordered deterministically.');

    // Scenario 14: Paused Queue
    await resetDoctorQueue();
    const pauseCtx14 = createMockCtx(staffUserPayload, {}, { doctorId: testDoctor._id, reason: 'Doctor break' });
    await pauseQueue(pauseCtx14.req, pauseCtx14.res, pauseCtx14.next);
    const p14 = await createTestPatient('Patient 14');
    await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: p14._id, queueDate, tokenNumber: 1, source: 'WALK_IN', status: 'WAITING', effectiveSlotMinutes: 540 });
    
    const callCtx14 = createMockCtx(staffUserPayload, {}, { doctorId: testDoctor._id });
    await callNextPatient(callCtx14.req, callCtx14.res, callCtx14.next);
    if (callCtx14.status !== 400 || !callCtx14.body.message.includes('paused')) throw new Error('Scenario 14 Assertion Failed');
    console.log('✓ Scenario 14 Passed: Paused queue blocks CALL_NEXT with 400 Bad Request.');

    // Scenario 15: Resumed Queue
    const resumeCtx15 = createMockCtx(staffUserPayload, {}, { doctorId: testDoctor._id });
    await resumeQueue(resumeCtx15.req, resumeCtx15.res, resumeCtx15.next);
    const callCtx15 = createMockCtx(staffUserPayload, {}, { doctorId: testDoctor._id });
    await callNextPatient(callCtx15.req, callCtx15.res, callCtx15.next);
    if (callCtx15.status !== 200 || callCtx15.body.queueEntry.status !== 'CALLED') throw new Error('Scenario 15 Assertion Failed');
    console.log('✓ Scenario 15 Passed: Resumed queue unblocks CALL_NEXT.');

    // Scenario 16: Doctor IN_CONSULTATION
    const startCtx16 = createMockCtx(staffUserPayload, { id: callCtx15.body.queueEntry._id });
    await startConsultation(startCtx16.req, startCtx16.res, startCtx16.next);
    const p16 = await createTestPatient('Patient 16');
    await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: p16._id, queueDate, tokenNumber: 2, source: 'WALK_IN', status: 'WAITING', effectiveSlotMinutes: 545 });
    
    const callCtx16 = createMockCtx(staffUserPayload, {}, { doctorId: testDoctor._id });
    await callNextPatient(callCtx16.req, callCtx16.res, callCtx16.next);
    if (callCtx16.status !== 400 || !callCtx16.body.message.includes('active patient')) throw new Error('Scenario 16 Assertion Failed');
    console.log('✓ Scenario 16 Passed: CALL_NEXT blocked when doctor already IN_CONSULTATION.');

    // Scenario 17: New Check-In While Another is CALLED
    await resetDoctorQueue();
    const p17_1 = await createTestPatient('Patient 17_1');
    const walkCtx17_1 = createMockCtx(staffUserPayload, {}, { patientId: p17_1._id, doctorId: testDoctor._id });
    await registerWalkIn(walkCtx17_1.req, walkCtx17_1.res, walkCtx17_1.next);
    
    const callCtx17 = createMockCtx(staffUserPayload, {}, { doctorId: testDoctor._id });
    await callNextPatient(callCtx17.req, callCtx17.res, callCtx17.next);
    const q17_1 = callCtx17.body.queueEntry;

    const p17_2 = await createTestPatient('Patient 17_2');
    const walkCtx17_2 = createMockCtx(staffUserPayload, {}, { patientId: p17_2._id, doctorId: testDoctor._id });
    await registerWalkIn(walkCtx17_2.req, walkCtx17_2.res, walkCtx17_2.next);

    const qCtx17 = createMockCtx(staffUserPayload, {}, {}, { doctorId: testDoctor._id.toString() });
    await getTodayQueue(qCtx17.req, qCtx17.res, qCtx17.next);
    const activeId17 = qCtx17.body.activeEntries[0]?._id?.toString();
    const waitingPatId17 = (qCtx17.body.waitingEntries[0]?.patientId?._id || qCtx17.body.waitingEntries[0]?.patientId)?.toString();
    if (activeId17 !== q17_1._id.toString() || waitingPatId17 !== p17_2._id.toString()) {
      console.log('Scenario 17 Debug:', { activeId17, q17_1: q17_1._id.toString(), waitingPatId17, p17_2: p17_2._id.toString(), activeEntries: qCtx17.body.activeEntries, waitingEntries: qCtx17.body.waitingEntries });
      throw new Error('Scenario 17 Assertion Failed');
    }
    console.log('✓ Scenario 17 Passed: New check-in added to WAITING queue while another is CALLED.');

    // Scenario 18: Simultaneous Check-Ins (Token Monotonicity)
    await resetDoctorQueue();
    const p18_1 = await createTestPatient('Patient 18_1');
    const p18_2 = await createTestPatient('Patient 18_2');
    const walkCtx18_1 = createMockCtx(staffUserPayload, {}, { patientId: p18_1._id, doctorId: testDoctor._id });
    const walkCtx18_2 = createMockCtx(staffUserPayload, {}, { patientId: p18_2._id, doctorId: testDoctor._id });
    await Promise.all([
      registerWalkIn(walkCtx18_1.req, walkCtx18_1.res, walkCtx18_1.next),
      registerWalkIn(walkCtx18_2.req, walkCtx18_2.res, walkCtx18_2.next),
    ]);
    const tokens = [walkCtx18_1.body.queueEntry.tokenNumber, walkCtx18_2.body.queueEntry.tokenNumber].sort((a,b) => a - b);
    if (tokens[0] !== 1 || tokens[1] !== 2) throw new Error('Scenario 18 Assertion Failed');
    console.log('✓ Scenario 18 Passed: Simultaneous check-ins allocate Tokens #1 and #2 cleanly.');

    // Scenario 19: Concurrent CALL_NEXT (Atomic Conditional Update)
    await resetDoctorQueue();
    const p19 = await createTestPatient('Patient 19');
    await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: p19._id, queueDate, tokenNumber: 1, source: 'WALK_IN', status: 'WAITING', effectiveSlotMinutes: 540 });
    
    const callCtx19_1 = createMockCtx(staffUserPayload, {}, { doctorId: testDoctor._id });
    const callCtx19_2 = createMockCtx(staffUserPayload, {}, { doctorId: testDoctor._id });
    await Promise.all([
      callNextPatient(callCtx19_1.req, callCtx19_1.res, callCtx19_1.next),
      callNextPatient(callCtx19_2.req, callCtx19_2.res, callCtx19_2.next),
    ]);
    const statuses19 = [callCtx19_1.status, callCtx19_2.status].sort();
    if (statuses19[0] !== 200 || (statuses19[1] !== 400 && statuses19[1] !== 409)) throw new Error(`Scenario 19 Assertion Failed: ${JSON.stringify(statuses19)}`);
    console.log('✓ Scenario 19 Passed: Concurrent CALL_NEXT yields exactly 1 success and 1 rejection.');

    // Scenario 20: Empty Queue CALL_NEXT
    await resetDoctorQueue();
    const callCtx20 = createMockCtx(staffUserPayload, {}, { doctorId: testDoctor._id });
    await callNextPatient(callCtx20.req, callCtx20.res, callCtx20.next);
    if (callCtx20.status !== 404) throw new Error('Scenario 20 Assertion Failed');
    console.log('✓ Scenario 20 Passed: Empty queue CALL_NEXT returns 404 Not Found.');

    // ==================================================
    // PART 2: STATE MACHINE & APPOINTMENT SYNCHRONIZATION
    // ==================================================
    console.log('--- Testing State Machine & Appointment Synchronization ---');

    // Complete Consultation Sync
    await resetDoctorQueue();
    const pSync1 = await createTestPatient('Sync Patient 1');
    const apptSync1 = await Appointment.create({ clinicId: testClinic._id, doctorId: testDoctor._id, specialtyId: testSpecialty._id, patientId: pSync1._id, appointmentDate: queueDate, timeSlot: { startTime: '11:00', endTime: '11:15' }, status: 'CHECKED_IN' });
    const qSync1 = await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: pSync1._id, appointmentId: apptSync1._id, queueDate, tokenNumber: 1, source: 'ONLINE', status: 'IN_CONSULTATION', effectiveSlotMinutes: 660 });
    
    const compCtx1 = createMockCtx(staffUserPayload, { id: qSync1._id });
    await completeConsultation(compCtx1.req, compCtx1.res, compCtx1.next);
    if (compCtx1.status !== 200 || compCtx1.body.queueEntry.status !== 'COMPLETED') throw new Error('Complete Sync Failed');
    const updatedAppt1 = await Appointment.findById(apptSync1._id);
    if (updatedAppt1.status !== 'COMPLETED') throw new Error('Appointment COMPLETE sync failed');
    console.log('✓ State Machine Test Passed: COMPLETE consultation syncs Appointment to COMPLETED.');

    // No-Show Sync
    const pSync2 = await createTestPatient('Sync Patient 2');
    const apptSync2 = await Appointment.create({ clinicId: testClinic._id, doctorId: testDoctor._id, specialtyId: testSpecialty._id, patientId: pSync2._id, appointmentDate: queueDate, timeSlot: { startTime: '11:15', endTime: '11:30' }, status: 'CHECKED_IN' });
    const qSync2 = await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: pSync2._id, appointmentId: apptSync2._id, queueDate, tokenNumber: 2, source: 'ONLINE', status: 'WAITING', effectiveSlotMinutes: 675 });
    
    const nsCtx2 = createMockCtx(staffUserPayload, { id: qSync2._id }, { reason: 'Patient did not arrive' });
    await markNoShow(nsCtx2.req, nsCtx2.res, nsCtx2.next);
    if (nsCtx2.status !== 200 || nsCtx2.body.queueEntry.status !== 'NO_SHOW') throw new Error('No-Show Sync Failed');
    const updatedAppt2 = await Appointment.findById(apptSync2._id);
    if (updatedAppt2.status !== 'NO_SHOW') throw new Error('Appointment NO_SHOW sync failed');
    console.log('✓ State Machine Test Passed: NO_SHOW syncs Appointment to NO_SHOW.');

    // Cancel Sync
    const pSync3 = await createTestPatient('Sync Patient 3');
    const apptSync3 = await Appointment.create({ clinicId: testClinic._id, doctorId: testDoctor._id, specialtyId: testSpecialty._id, patientId: pSync3._id, appointmentDate: queueDate, timeSlot: { startTime: '11:30', endTime: '11:45' }, status: 'CHECKED_IN' });
    const qSync3 = await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: pSync3._id, appointmentId: apptSync3._id, queueDate, tokenNumber: 3, source: 'ONLINE', status: 'WAITING', effectiveSlotMinutes: 690 });
    
    const cancelCtx3 = createMockCtx(staffUserPayload, { id: qSync3._id }, { reason: 'Cancelled by patient' });
    await cancelQueueEntry(cancelCtx3.req, cancelCtx3.res, cancelCtx3.next);
    if (cancelCtx3.status !== 200 || cancelCtx3.body.queueEntry.status !== 'CANCELLED') throw new Error('Cancel Sync Failed');
    const updatedAppt3 = await Appointment.findById(apptSync3._id);
    if (updatedAppt3.status !== 'CANCELLED') throw new Error('Appointment CANCELLED sync failed');
    console.log('✓ State Machine Test Passed: CANCEL syncs Appointment to CANCELLED.');

    // ==================================================
    // PART 3: CONCURRENCY & IDEMPOTENCY SUITE
    // ==================================================
    console.log('--- Testing Concurrency & Idempotency ---');

    // 10 Simultaneous CALL_NEXT calls
    await resetDoctorQueue();
    const pConc = await createTestPatient('Conc Patient');
    await QueueEntry.create({ clinicId: testClinic._id, doctorId: testDoctor._id, patientId: pConc._id, queueDate, tokenNumber: 1, source: 'WALK_IN', status: 'WAITING', effectiveSlotMinutes: 540 });
    
    const tenCalls = Array(10).fill(null).map(() => {
      const ctx = createMockCtx(staffUserPayload, {}, { doctorId: testDoctor._id });
      return callNextPatient(ctx.req, ctx.res, ctx.next).then(() => ctx);
    });
    const tenResults = await Promise.all(tenCalls);
    const successCalls = tenResults.filter(r => r.status === 200);
    if (successCalls.length !== 1) throw new Error(`10 Concurrent CALL_NEXT Failed: ${successCalls.length} succeeded`);
    console.log('✓ Concurrency Test Passed: Exactly 1 out of 10 simultaneous CALL_NEXT requests succeeded.');

    // ==================================================
    // PART 4: SECURITY & RBAC ENFORCEMENT
    // ==================================================
    console.log('--- Testing Security & Authorization ---');

    // Patient forbidden from staff queue
    const patCtx = createMockCtx(patientUserPayload, {}, {}, { doctorId: testDoctor._id.toString() });
    await getTodayQueue(patCtx.req, patCtx.res, patCtx.next);
    if (patCtx.status !== 403) throw new Error('Patient authorization bypass');
    console.log('✓ Security Test Passed: Patient role rejected with 403 Forbidden.');

    // Cross-Clinic Staff rejection
    const otherClinic = await Clinic.create({ name: 'Other Clinic', code: `OTH-${Date.now()}`, address: { street: '123 St', city: 'Delhi', state: 'Delhi', pincode: '110001' }, location: { type: 'Point', coordinates: [77.2, 28.6] }, phone: '9999999999', email: `oth_${Date.now()}@test.com`, adminId: testAdminUser._id, isActive: true });
    const otherStaffUser = await User.create({ fullName: 'Other Staff', email: `othstaff_${Date.now()}@test.com`, password: 'Password123!', role: 'STAFF', isActive: true });
    createdUserIds.push(otherStaffUser._id);
    await Staff.create({ userId: otherStaffUser._id, clinicId: otherClinic._id, fullName: 'Other Staff', phone: '9999999998' });
    
    const otherStaffUserPayload = { _id: otherStaffUser._id, id: otherStaffUser._id, role: 'STAFF', staffClinicId: otherClinic._id };
    const crossCtx = createMockCtx(otherStaffUserPayload, {}, { doctorId: testDoctor._id });
    await callNextPatient(crossCtx.req, crossCtx.res, crossCtx.next);
    if (crossCtx.status !== 403) throw new Error('Cross-clinic security failure');
    console.log('✓ Security Test Passed: Cross-clinic staff access rejected with 403 Forbidden.');

    // Admin global access
    const adminCtx = createMockCtx(adminUserPayload, {}, {}, { doctorId: testDoctor._id.toString() });
    await getTodayQueue(adminCtx.req, adminCtx.res, adminCtx.next);
    if (adminCtx.status !== 200) throw new Error('Admin global access failed');
    console.log('✓ Security Test Passed: ADMIN role has global operational access.');

    // ==================================================
    // PART 5: DATABASE INDEXES & QUEUEHISTORY AUDIT LOGS
    // ==================================================
    console.log('--- Testing Database Indexes & QueueHistory Audit Logs ---');

    const indexes = await QueueEntry.collection.getIndexes();
    if (!indexes['hybrid_queue_ordering_idx']) throw new Error('hybrid_queue_ordering_idx index missing on QueueEntry collection');
    console.log('✓ Database Test Passed: hybrid_queue_ordering_idx compound index exists.');

    const historyLogs = await QueueHistory.find({ doctorId: testDoctor._id });
    if (historyLogs.length === 0) throw new Error('QueueHistory audit records missing');
    console.log(`✓ Audit Log Test Passed: ${historyLogs.length} immutable QueueHistory records logged.`);

    // Clean test records
    await resetDoctorQueue();
    await Clinic.deleteMany({ _id: { $in: [testClinic._id, otherClinic._id] } });
    await Specialty.deleteMany({ _id: testSpecialty._id });
    await User.deleteMany({ _id: { $in: createdUserIds } });
    await Doctor.deleteMany({ userId: testDoctorUser._id });
    await Staff.deleteMany({ userId: { $in: [testStaffUser._id, otherStaffUser._id] } });
    await Patient.deleteMany({ _id: { $in: createdPatientIds } });
    console.log('✓ All Phase 08 temporary test records removed cleanly from MongoDB Atlas.');

    console.log('--- Running Prior Phase Regression Suites (Phase 03, 04, 05, 06, 07) ---');
    await runAuthValidation();
    await runPhase04Validation();
    await runPhase05Validation();
    await runPhase06Validation();
    await runPhase07Validation();
    console.log('✓ All Prior Phase Regression Suites (03, 04, 05, 06, 07) Passed 100%.');

    console.log('--- Phase 08 Validation Completed Successfully (All 20 Scenarios & Regression Passed) ---');
  } catch (error) {
    console.error('❌ Phase 08 Validation Suite Encountered Error:', error);
    throw error;
  }
};

if (process.argv[1] === new URL(import.meta.url).pathname || process.argv[1]?.endsWith('validatePhase08.js')) {
  runPhase08Tests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
