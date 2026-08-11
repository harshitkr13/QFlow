import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Appointment } from '../models/Appointment.js';
import { runAuthValidation } from './validateAuth.js';
import { runPhase04Validation } from './validatePhase04.js';
import { runPhase05Validation } from './validatePhase05.js';

dotenv.config();

export const runPhase06SchemaValidation = async () => {
  console.log('--- Phase 06 Schema Amendment Validation Starting ---');

  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }
  console.log(`✓ Connected to DB: ${mongoose.connection.host}/${mongoose.connection.name}`);

  // Sync indexes to ensure MongoDB Atlas has unique_active_doctor_slot_idx created & old index dropped
  await Appointment.syncIndexes();
  const indexes = await Appointment.collection.indexes();
  console.log('✓ Synced Appointment collection indexes on MongoDB Atlas:');
  indexes.forEach((idx) => console.log(`   - Name: ${idx.name}, Unique: ${idx.unique || false}, Partial: ${JSON.stringify(idx.partialFilterExpression || {})}`));

  const activeIdx = indexes.find((i) => i.name === 'unique_active_doctor_slot_idx');
  if (!activeIdx || !activeIdx.unique || !activeIdx.partialFilterExpression) {
    throw new Error('Schema Validation Failed: unique_active_doctor_slot_idx missing or invalid');
  }

  const createdAppointmentIds = [];
  const dummyClinic = new mongoose.Types.ObjectId();
  const dummyDoctorA = new mongoose.Types.ObjectId();
  const dummyDoctorB = new mongoose.Types.ObjectId();
  const dummyPatient1 = new mongoose.Types.ObjectId();
  const dummyPatient2 = new mongoose.Types.ObjectId();
  const dummySpecialty = new mongoose.Types.ObjectId();

  const dateX = '2026-09-01';
  const dateY = '2026-09-02';
  const slotTime = '10:00';

  try {
    // ----------------------------------------------------
    // CASE 1: Duplicate BOOKED for Doctor A + Date X + 10:00 -> MUST FAIL
    // ----------------------------------------------------
    const app1 = await Appointment.create({
      clinicId: dummyClinic,
      doctorId: dummyDoctorA,
      patientId: dummyPatient1,
      specialtyId: dummySpecialty,
      appointmentDate: dateX,
      timeSlot: { startTime: slotTime, endTime: '10:15' },
      status: 'BOOKED',
    });
    createdAppointmentIds.push(app1._id);

    try {
      const app1Dup = await Appointment.create({
        clinicId: dummyClinic,
        doctorId: dummyDoctorA,
        patientId: dummyPatient2,
        specialtyId: dummySpecialty,
        appointmentDate: dateX,
        timeSlot: { startTime: slotTime, endTime: '10:15' },
        status: 'BOOKED',
      });
      createdAppointmentIds.push(app1Dup._id);
      throw new Error('CASE 1 Failed: Second duplicate BOOKED insert did not fail!');
    } catch (err) {
      if (err.code !== 11000) throw err;
      console.log('✓ CASE 1 Passed: Duplicate BOOKED insert rejected by E11000.');
    }

    // ----------------------------------------------------
    // CASE 2: BOOKED + CHECKED_IN for Doctor A + Date X + 10:00 -> MUST FAIL
    // ----------------------------------------------------
    try {
      const app2 = await Appointment.create({
        clinicId: dummyClinic,
        doctorId: dummyDoctorA,
        patientId: dummyPatient2,
        specialtyId: dummySpecialty,
        appointmentDate: dateX,
        timeSlot: { startTime: slotTime, endTime: '10:15' },
        status: 'CHECKED_IN',
      });
      createdAppointmentIds.push(app2._id);
      throw new Error('CASE 2 Failed: CHECKED_IN insert for already BOOKED slot did not fail!');
    } catch (err) {
      if (err.code !== 11000) throw err;
      console.log('✓ CASE 2 Passed: BOOKED + CHECKED_IN duplicate slot rejected by E11000.');
    }

    // ----------------------------------------------------
    // CASE 3: CANCELLED + BOOKED for Doctor A + Date X + 10:00 -> MUST BE ALLOWED
    // ----------------------------------------------------
    app1.status = 'CANCELLED';
    await app1.save();

    const app3 = await Appointment.create({
      clinicId: dummyClinic,
      doctorId: dummyDoctorA,
      patientId: dummyPatient2,
      specialtyId: dummySpecialty,
      appointmentDate: dateX,
      timeSlot: { startTime: slotTime, endTime: '10:15' },
      status: 'BOOKED',
    });
    createdAppointmentIds.push(app3._id);
    console.log('✓ CASE 3 Passed: CANCELLED slot re-booking succeeds.');

    // ----------------------------------------------------
    // CASE 4: COMPLETED + BOOKED -> MUST BE ALLOWED
    // ----------------------------------------------------
    app3.status = 'COMPLETED';
    await app3.save();

    const app4 = await Appointment.create({
      clinicId: dummyClinic,
      doctorId: dummyDoctorA,
      patientId: dummyPatient1,
      specialtyId: dummySpecialty,
      appointmentDate: dateX,
      timeSlot: { startTime: slotTime, endTime: '10:15' },
      status: 'BOOKED',
    });
    createdAppointmentIds.push(app4._id);
    console.log('✓ CASE 4 Passed: COMPLETED slot re-booking succeeds.');

    // ----------------------------------------------------
    // CASE 5: NO_SHOW + BOOKED -> MUST BE ALLOWED
    // ----------------------------------------------------
    app4.status = 'NO_SHOW';
    await app4.save();

    const app5 = await Appointment.create({
      clinicId: dummyClinic,
      doctorId: dummyDoctorA,
      patientId: dummyPatient2,
      specialtyId: dummySpecialty,
      appointmentDate: dateX,
      timeSlot: { startTime: slotTime, endTime: '10:15' },
      status: 'BOOKED',
    });
    createdAppointmentIds.push(app5._id);
    console.log('✓ CASE 5 Passed: NO_SHOW slot re-booking succeeds.');

    // ----------------------------------------------------
    // CASE 6: Doctor A + Doctor B for Date X + 10:00 -> MUST BE ALLOWED
    // ----------------------------------------------------
    const app6 = await Appointment.create({
      clinicId: dummyClinic,
      doctorId: dummyDoctorB,
      patientId: dummyPatient1,
      specialtyId: dummySpecialty,
      appointmentDate: dateX,
      timeSlot: { startTime: slotTime, endTime: '10:15' },
      status: 'BOOKED',
    });
    createdAppointmentIds.push(app6._id);
    console.log('✓ CASE 6 Passed: Different doctors for same slot time allowed.');

    // ----------------------------------------------------
    // CASE 7: Doctor A for Date X + Date Y -> MUST BE ALLOWED
    // ----------------------------------------------------
    const app7 = await Appointment.create({
      clinicId: dummyClinic,
      doctorId: dummyDoctorA,
      patientId: dummyPatient1,
      specialtyId: dummySpecialty,
      appointmentDate: dateY,
      timeSlot: { startTime: slotTime, endTime: '10:15' },
      status: 'BOOKED',
    });
    createdAppointmentIds.push(app7._id);
    console.log('✓ CASE 7 Passed: Doctor A on different dates for same slot time allowed.');

    // ----------------------------------------------------
    // CONCURRENCY VALIDATION: 2 Simultaneous Promise.all Inserts
    // ----------------------------------------------------
    console.log('--- Testing Database Concurrency with Simultaneous Inserts ---');
    const concSlotTime = '11:00';
    const concDocId = new mongoose.Types.ObjectId();

    const req1 = Appointment.create({
      clinicId: dummyClinic,
      doctorId: concDocId,
      patientId: dummyPatient1,
      specialtyId: dummySpecialty,
      appointmentDate: dateX,
      timeSlot: { startTime: concSlotTime, endTime: '11:15' },
      status: 'BOOKED',
    });

    const req2 = Appointment.create({
      clinicId: dummyClinic,
      doctorId: concDocId,
      patientId: dummyPatient2,
      specialtyId: dummySpecialty,
      appointmentDate: dateX,
      timeSlot: { startTime: concSlotTime, endTime: '11:15' },
      status: 'BOOKED',
    });

    const results = await Promise.allSettled([req1, req2]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    if (fulfilled.length !== 1 || rejected.length !== 1) {
      throw new Error(`Concurrency Test Failed: Expected 1 fulfilled and 1 rejected, got ${fulfilled.length} fulfilled and ${rejected.length} rejected`);
    }

    if (rejected[0].reason.code !== 11000) {
      throw new Error(`Concurrency Test Failed: Rejected reason was not E11000 duplicate key error, got ${rejected[0].reason.message}`);
    }

    createdAppointmentIds.push(fulfilled[0].value._id);
    console.log('✓ Concurrency Test Passed: Exactly 1 concurrent insert succeeded, 1 rejected with E11000.');

  } finally {
    console.log('--- Cleaning Up Schema Test Records ---');
    if (createdAppointmentIds.length) {
      await Appointment.deleteMany({ _id: { $in: createdAppointmentIds } });
    }
    console.log('✓ Temporary test appointment records removed cleanly from MongoDB Atlas.');
  }

  // ----------------------------------------------------
  // REGRESSION SUITES
  // ----------------------------------------------------
  console.log('--- Running Regression Suites (Phase 03, 04, 05) ---');
  await runAuthValidation(false);
  await runPhase04Validation(false);
  await runPhase05Validation();
  console.log('✓ All Regression Suites Passed 100%!');

  console.log('--- Phase 06 Schema Amendment Validation Completed Successfully ---');
};

if (process.argv[1] && process.argv[1].endsWith('validatePhase06Schema.js')) {
  runPhase06SchemaValidation().catch((err) => {
    console.error('Phase 06 Schema Validation Error:', err);
    process.exit(1);
  });
}
