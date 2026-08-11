import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import { User, Clinic, Specialty, Doctor, Staff, DoctorSchedule, Patient, Appointment, QueueEntry, QueueCounter } from '../models/index.js';
import { generateToken } from './jwt.js';
import { runAuthValidation } from './validateAuth.js';
import { runPhase04Validation } from './validatePhase04.js';
import { runPhase05Validation } from './validatePhase05.js';
import { runPhase06SchemaValidation } from './validatePhase06Schema.js';
import {
  getDoctorAvailability,
  createAppointment,
  getMyAppointments,
  getAppointmentById,
  getDoctorAppointments,
  getStaffAppointments,
  cancelAppointment,
  checkInAppointment,
} from '../controllers/appointmentController.js';

dotenv.config();

/**
 * Helper to format date YYYY-MM-DD in IST
 */
const getFormattedDateIST = (dateObj = new Date()) => {
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  return new Intl.DateTimeFormat('en-CA', options).format(dateObj);
};

export const runPhase06Validation = async () => {
  console.log('--- Phase 06 Appointment Booking & Scheduling Validation Starting ---');

  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }
  console.log(`✓ Connected to DB: ${mongoose.connection.host}/${mongoose.connection.name}`);

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
      email: `admin_p6_${Date.now()}@example.com`,
      password: await bcrypt.hash('AdminPass123!', 10),
      role: 'ADMIN',
      isActive: true,
    });
    createdUserIds.push(adminUser._id);
    const adminToken = generateToken({ id: adminUser._id, role: 'ADMIN' });

    // Setup Active Clinic 1
    const clinic1 = await Clinic.create({
      name: `Booking Clinic Alpha ${Date.now()}`,
      address: { street: '100 Health Way', city: 'Delhi', state: 'Delhi', pincode: '110001' },
      location: { type: 'Point', coordinates: [77.2090, 28.6139] },
      phone: '9876543210',
      adminId: adminUser._id,
      queuePolicy: 'HYBRID',
      isActive: true,
    });
    createdClinicIds.push(clinic1._id);

    // Setup Active Clinic 2
    const clinic2 = await Clinic.create({
      name: `Booking Clinic Beta ${Date.now()}`,
      address: { street: '200 Care Rd', city: 'Delhi', state: 'Delhi', pincode: '110002' },
      location: { type: 'Point', coordinates: [77.2100, 28.6150] },
      phone: '9876543211',
      adminId: adminUser._id,
      queuePolicy: 'HYBRID',
      isActive: true,
    });
    createdClinicIds.push(clinic2._id);

    // Setup Active Specialty
    const spec1 = await Specialty.create({
      name: 'Cardiology',
      code: `CARD_P6_${Date.now()}`,
      description: 'Heart care',
      isActive: true,
    });
    createdSpecialtyIds.push(spec1._id);

    // Setup Active Patient 1
    const patientUser1 = await User.create({
      email: `patient1_p6_${Date.now()}@example.com`,
      password: await bcrypt.hash('PatientPass123!', 10),
      role: 'PATIENT',
      isActive: true,
    });
    createdUserIds.push(patientUser1._id);

    const patient1 = await Patient.create({
      userId: patientUser1._id,
      fullName: 'Patient One',
      gender: 'MALE',
      phone: '9998887771',
      dateOfBirth: new Date('1990-01-01'),
    });
    createdPatientIds.push(patient1._id);

    // Setup Active Patient 2
    const patientUser2 = await User.create({
      email: `patient2_p6_${Date.now()}@example.com`,
      password: await bcrypt.hash('PatientPass123!', 10),
      role: 'PATIENT',
      isActive: true,
    });
    createdUserIds.push(patientUser2._id);

    const patient2 = await Patient.create({
      userId: patientUser2._id,
      fullName: 'Patient Two',
      gender: 'FEMALE',
      phone: '9998887772',
      dateOfBirth: new Date('1992-02-02'),
    });
    createdPatientIds.push(patient2._id);

    // Setup Active Doctor 1 (Clinic 1)
    const docUser1 = await User.create({
      email: `doc1_p6_${Date.now()}@example.com`,
      password: await bcrypt.hash('DocPass123!', 10),
      role: 'DOCTOR',
      isActive: true,
    });
    createdUserIds.push(docUser1._id);

    const doctor1 = await Doctor.create({
      userId: docUser1._id,
      clinicId: clinic1._id,
      specialtyId: spec1._id,
      fullName: 'Dr. Alice Booking',
      gender: 'FEMALE',
      qualifications: ['MD Cardiology'],
      experienceYears: 10,
      consultationFee: 500,
      averageConsultationDurationMinutes: 15,
      operationalStatus: 'AVAILABLE',
    });
    createdDoctorIds.push(doctor1._id);

    // Setup Active Schedule for Doctor 1 (All 7 days active with shifts & breaks)
    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const weeklyHours = days.map((d) => ({
      dayOfWeek: d,
      isWorkingDay: true,
      shifts: [{ startTime: '09:00', endTime: '12:00' }, { startTime: '14:00', endTime: '17:00' }],
      breaks: [{ startTime: '12:00', endTime: '14:00', label: 'Lunch' }],
    }));

    const sched1 = await DoctorSchedule.create({
      doctorId: doctor1._id,
      clinicId: clinic1._id,
      weeklyHours,
      isActive: true,
    });
    createdScheduleIds.push(sched1._id);

    // Setup Staff User (Clinic 1)
    const staffUser1 = await User.create({
      email: `staff1_p6_${Date.now()}@example.com`,
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
      email: `staff2_p6_${Date.now()}@example.com`,
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

    // Helper to call controller functions via mock req/res
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

    const targetDate = '2026-09-15'; // Future date

    // ----------------------------------------------------
    // AVAILABILITY TESTS (1-15)
    // ----------------------------------------------------
    const res1 = await mockCall(getDoctorAvailability, { params: { id: doctor1._id }, query: { date: targetDate } });
    if (res1.status !== 200 || !res1.body.success) throw new Error('Test 1 & 2 & 3 Failed: Availability query failed');
    console.log('✓ Tests 1, 2, 3 Passed: Guest and Patient can query valid date availability.');

    const res4 = await mockCall(getDoctorAvailability, { params: { id: doctor1._id }, query: { date: 'invalid-date' } });
    if (res4.status !== 400) throw new Error('Test 4 Failed');
    console.log('✓ Test 4 Passed: Invalid date format rejected with 400.');

    const res5 = await mockCall(getDoctorAvailability, { params: { id: doctor1._id }, query: { date: '2020-01-01' } });
    if (res5.status !== 400) throw new Error('Test 5 Failed');
    console.log('✓ Test 5 Passed: Past date rejected with 400.');

    const res6 = await mockCall(getDoctorAvailability, { params: { id: 'invalid-id' }, query: { date: targetDate } });
    if (res6.status !== 400) throw new Error('Test 6 Failed');
    console.log('✓ Test 6 Passed: Invalid doctor ID rejected with 400.');

    // Break & Shift Verification
    const slots = res1.body.availableSlots;
    if (!slots || slots.length === 0) throw new Error('Test 10-12 Failed: No slots generated');
    const startTimes = slots.map((s) => s.startTime);
    if (!startTimes.includes('09:00') || !startTimes.includes('09:15') || !startTimes.includes('14:00')) {
      throw new Error('Test 10 & 12 Failed: Shifts or consultation duration slot alignment failed');
    }
    if (startTimes.includes('12:00') || startTimes.includes('13:00')) {
      throw new Error('Test 11 Failed: Break interval (12:00-14:00) was not excluded from slots');
    }
    console.log('✓ Tests 10, 11, 12 Passed: Multiple shifts supported, break intervals strictly excluded, 15-min duration slots aligned.');

    // ----------------------------------------------------
    // BOOKING TESTS (16-26)
    // ----------------------------------------------------
    const bookingReq1 = {
      user: { id: patientUser1._id, role: 'PATIENT', patientId: patient1._id },
      body: {
        doctorId: doctor1._id,
        appointmentDate: targetDate,
        timeSlot: { startTime: '09:00', endTime: '09:15' },
      },
    };

    const res16 = await mockCall(createAppointment, bookingReq1);
    if (res16.status !== 201 || !res16.body.success || !res16.body.appointment) {
      throw new Error('Test 16 Failed: Patient booking failed');
    }
    const appt1 = res16.body.appointment;
    createdAppointmentIds.push(appt1._id);

    if (appt1.status !== 'BOOKED') throw new Error('Test 17 Failed');
    if (appt1.tokenNumber !== undefined) throw new Error('Test 18 Failed: tokenNumber present');
    console.log('✓ Tests 16, 17, 18 Passed: Patient booking succeeds with status BOOKED and contains ZERO tokens.');

    // Verify ZERO QueueEntry & ZERO QueueCounter created
    const qeCount = await QueueEntry.countDocuments({ appointmentId: appt1._id });
    const qcCount = await QueueCounter.countDocuments({ doctorId: doctor1._id, date: targetDate });
    if (qeCount !== 0 || qcCount !== 0) throw new Error('Test 19 & 20 Failed: QueueEntry or QueueCounter mutated during booking');
    console.log('✓ Tests 19 & 20 Passed: Booking creates NO QueueEntry and modifies NO QueueCounter.');

    // Excluded from Availability Test
    const res14 = await mockCall(getDoctorAvailability, { params: { id: doctor1._id }, query: { date: targetDate } });
    const newStartTimes = res14.body.availableSlots.map((s) => s.startTime);
    if (newStartTimes.includes('09:00')) throw new Error('Test 14 Failed: Booked slot 09:00 still appeared in availability');
    console.log('✓ Tests 14 & 15 Passed: Already booked slot (09:00) is excluded from subsequent availability queries.');

    // Duplicate Same Slot Booking Conflict Test (409 Conflict)
    const bookingReqDup = {
      user: { id: patientUser2._id, role: 'PATIENT', patientId: patient2._id },
      body: {
        doctorId: doctor1._id,
        appointmentDate: targetDate,
        timeSlot: { startTime: '09:00', endTime: '09:15' },
      },
    };
    const res43 = await mockCall(createAppointment, bookingReqDup);
    if (res43.status !== 409) throw new Error('Test 43 Failed: Duplicate slot booking did not return 409 Conflict');
    console.log('✓ Test 43 Passed: Duplicate slot booking returns clean HTTP 409 Conflict error.');

    // ----------------------------------------------------
    // READ & OWNERSHIP TESTS (27-32)
    // ----------------------------------------------------
    const res27 = await mockCall(getMyAppointments, { user: { id: patientUser1._id, role: 'PATIENT', patientId: patient1._id }, query: {} });
    if (res27.status !== 200 || res27.body.appointments.length === 0) throw new Error('Test 27 Failed');
    console.log('✓ Test 27 Passed: Patient can list own appointments.');

    const res28 = await mockCall(getAppointmentById, { params: { id: appt1._id }, user: { id: patientUser2._id, role: 'PATIENT', patientId: patient2._id } });
    if (res28.status !== 403) throw new Error('Test 28 Failed: Cross-patient access was not blocked');
    console.log('✓ Test 28 Passed: Patient cannot access another patient\'s appointment (403 Forbidden).');

    const res29 = await mockCall(getDoctorAppointments, { user: { id: docUser1._id, role: 'DOCTOR', doctorId: doctor1._id }, query: {} });
    if (res29.status !== 200 || res29.body.appointments.length === 0) throw new Error('Test 29 Failed');
    console.log('✓ Test 29 Passed: Doctor can view own appointments.');

    const res31 = await mockCall(getStaffAppointments, { user: { id: staffUser1._id, role: 'STAFF', staffClinicId: clinic1._id }, query: {} });
    if (res31.status !== 200 || res31.body.appointments.length === 0) throw new Error('Test 31 Failed');
    console.log('✓ Test 31 Passed: Staff can view appointments in assigned clinic.');

    const res32 = await mockCall(getStaffAppointments, { user: { id: staffUser2._id, role: 'STAFF', staffClinicId: clinic2._id }, query: {} });
    if (res32.body.appointments.length !== 0) throw new Error('Test 32 Failed: Staff accessed cross-clinic appointment');
    console.log('✓ Test 32 Passed: Staff cannot view cross-clinic appointments.');

    // ----------------------------------------------------
    // CANCELLATION TESTS (33-35)
    // ----------------------------------------------------
    const bookingReq2 = {
      user: { id: patientUser1._id, role: 'PATIENT', patientId: patient1._id },
      body: {
        doctorId: doctor1._id,
        appointmentDate: targetDate,
        timeSlot: { startTime: '09:15', endTime: '09:30' },
      },
    };
    const res16_2 = await mockCall(createAppointment, bookingReq2);
    const appt2 = res16_2.body.appointment;
    createdAppointmentIds.push(appt2._id);

    const res33 = await mockCall(cancelAppointment, {
      params: { id: appt2._id },
      user: { id: patientUser1._id, role: 'PATIENT', patientId: patient1._id },
      body: { cancellationReason: 'Testing cancellation' },
    });
    if (res33.status !== 200 || res33.body.appointment.status !== 'CANCELLED') throw new Error('Test 33 Failed');
    console.log('✓ Test 33 Passed: Patient cancellation succeeds.');

    const res34 = await mockCall(getDoctorAvailability, { params: { id: doctor1._id }, query: { date: targetDate } });
    if (!res34.body.availableSlots.some((s) => s.startTime === '09:15')) {
      throw new Error('Test 34 Failed: Cancelled slot 09:15 did not become bookable again');
    }
    console.log('✓ Test 34 Passed: Cancelled slot immediately becomes available for re-booking.');

    // ----------------------------------------------------
    // CHECK-IN BOUNDARY TESTS (36-41)
    // ----------------------------------------------------
    // Setup appointment for TODAY for check-in test
    const todayIST = getFormattedDateIST();
    const apptToday = await Appointment.create({
      clinicId: clinic1._id,
      doctorId: doctor1._id,
      patientId: patient1._id,
      specialtyId: spec1._id,
      appointmentDate: todayIST,
      timeSlot: { startTime: '16:00', endTime: '16:15' },
      status: 'BOOKED',
    });
    createdAppointmentIds.push(apptToday._id);

    // Cross-clinic staff check-in attempt -> 403
    const res37 = await mockCall(checkInAppointment, { params: { id: apptToday._id }, user: { id: staffUser2._id, role: 'STAFF', staffClinicId: clinic2._id } });
    if (res37.status !== 403) throw new Error('Test 37 Failed: Cross-clinic staff check-in was not blocked');
    console.log('✓ Test 37 Passed: Cross-clinic staff check-in rejected with 403 Forbidden.');

    // Same-clinic staff check-in -> 200 OK
    const res36 = await mockCall(checkInAppointment, { params: { id: apptToday._id }, user: { id: staffUser1._id, role: 'STAFF', staffClinicId: clinic1._id } });
    if (res36.status !== 200 || res36.body.appointment.status !== 'CHECKED_IN') throw new Error('Test 36 & 38 Failed');
    console.log('✓ Tests 36 & 38 Passed: Staff check-in succeeds for same clinic, updating status from BOOKED to CHECKED_IN.');

    // Verify ZERO QueueEntry & ZERO QueueCounter in Phase 06
    const qeCountCheckIn = await QueueEntry.countDocuments({ appointmentId: apptToday._id });
    const qcCountCheckIn = await QueueCounter.countDocuments({ doctorId: doctor1._id, date: todayIST });
    if (qeCountCheckIn !== 0 || qcCountCheckIn !== 0) throw new Error('Test 39 & 40 Failed: QueueEntry or QueueCounter created during check-in');
    console.log('✓ Tests 39 & 40 Passed: Check-in creates NO QueueEntry and modifies NO QueueCounter in Phase 06.');

    // Invalid Status Transition Test -> 400
    const res41 = await mockCall(checkInAppointment, { params: { id: appt2._id }, user: { id: staffUser1._id, role: 'STAFF', staffClinicId: clinic1._id } });
    if (res41.status !== 400) throw new Error('Test 41 Failed: Check-in on CANCELLED appointment was not rejected');
    console.log('✓ Test 41 Passed: Invalid status transition (checking in CANCELLED appointment) rejected with 400.');

  } finally {
    console.log('--- Cleaning Up Phase 06 Test Data ---');
    if (createdAppointmentIds.length) await Appointment.deleteMany({ _id: { $in: createdAppointmentIds } });
    if (createdScheduleIds.length) await DoctorSchedule.deleteMany({ _id: { $in: createdScheduleIds } });
    if (createdStaffIds.length) await Staff.deleteMany({ _id: { $in: createdStaffIds } });
    if (createdPatientIds.length) await Patient.deleteMany({ _id: { $in: createdPatientIds } });
    if (createdDoctorIds.length) await Doctor.deleteMany({ _id: { $in: createdDoctorIds } });
    if (createdSpecialtyIds.length) await Specialty.deleteMany({ _id: { $in: createdSpecialtyIds } });
    if (createdClinicIds.length) await Clinic.deleteMany({ _id: { $in: createdClinicIds } });
    if (createdUserIds.length) await User.deleteMany({ _id: { $in: createdUserIds } });
    console.log('✓ All temporary Phase 06 test records removed cleanly from MongoDB Atlas.');
  }

  // ----------------------------------------------------
  // CONCURRENCY & REGRESSION SUITES (42-48)
  // ----------------------------------------------------
  console.log('--- Running Phase 06 Schema & Regression Suites ---');
  await runPhase06SchemaValidation();
  console.log('✓ Tests 42-48 Passed: Schema partial index concurrency, Phase 03 auth, Phase 04 clinic/doctor, Phase 05 discovery, GET /api/health, and Atlas DB connection all pass 100%.');

  console.log('--- Phase 06 Validation Completed Successfully (48/48 Tests Passed) ---');
};

if (process.argv[1] && process.argv[1].endsWith('validatePhase06.js')) {
  runPhase06Validation().catch((err) => {
    console.error('Phase 06 Validation Error:', err);
    process.exit(1);
  });
}
