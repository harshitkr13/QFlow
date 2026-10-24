import assert from 'assert';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { discoverDoctors, getDoctorById } from '../controllers/doctorController.js';
import { Clinic, Doctor, DoctorSchedule, Specialty, User } from '../models/index.js';
import { getTodayDateIST, formatWorkingDays } from '../../client/src/utils/dateUtils.js';

async function runTests() {
  console.log('======================================================================');
  console.log('STARTING APPOINTMENT AVAILABILITY PHASE 1 FOCUSED TEST SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ FAIL: ${name}\n  Error: ${err.message}`);
      failed++;
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ FAIL: ${name}\n  Error: ${err.message}`);
      failed++;
    }
  }

  // --- 1. TIMEZONE & DATE HELPER TESTS ---
  console.log('--- 1. TIMEZONE-SAFE DATE HELPER TESTS ---');

  test('getTodayDateIST returns date in valid YYYY-MM-DD format', () => {
    const todayStr = getTodayDateIST();
    assert.match(todayStr, /^\d{4}-\d{2}-\d{2}$/, 'Date format must match YYYY-MM-DD');
  });

  test('getTodayDateIST evaluates date in Asia/Kolkata timezone', () => {
    const todayStr = getTodayDateIST();
    const expected = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    assert.strictEqual(todayStr, expected, 'Must match Asia/Kolkata DateTimeFormat exactly');
  });

  test('formatWorkingDays formats empty/null days safely', () => {
    assert.strictEqual(formatWorkingDays(null), 'Schedule not configured');
    assert.strictEqual(formatWorkingDays([]), 'Schedule not configured');
    assert.strictEqual(formatWorkingDays(undefined), 'Schedule not configured');
  });

  test('formatWorkingDays formats single and multiple days chronologically', () => {
    assert.strictEqual(formatWorkingDays(['MONDAY']), 'Mon');
    assert.strictEqual(formatWorkingDays(['SATURDAY', 'MONDAY', 'WEDNESDAY']), 'Mon, Wed, Sat');
    assert.strictEqual(formatWorkingDays(['SUNDAY', 'FRIDAY', 'TUESDAY']), 'Tue, Fri, Sun');
  });

  // --- 2. AVAILABILITY ERROR & MESSAGE RESOLUTION TESTS ---
  console.log('\n--- 2. AVAILABILITY MESSAGE RESOLUTION TESTS ---');

  function resolveAvailabilityDisplay(availability) {
    if (availability?.availableSlots?.length > 0) {
      return { type: 'SLOTS_AVAILABLE', count: availability.availableSlots.length };
    }
    if (availability?.message) {
      if (availability.message.includes('not configured')) {
        return { type: 'SCHEDULE_NOT_CONFIGURED', title: 'Schedule Not Configured', text: availability.message };
      }
      if (availability.message.includes('does not work')) {
        return { type: 'OFF_DUTY_DAY', title: 'Doctor Off-Duty On This Day', text: availability.message };
      }
      if (availability.isPastDate) {
        return { type: 'PAST_DATE', title: 'Past Date Selected', text: availability.message };
      }
      if (availability.isError) {
        return { type: 'ERROR_NOTICE', title: 'Availability Notice', text: availability.message };
      }
      return { type: 'MESSAGE_NOTICE', title: 'No Slots Available', text: availability.message };
    }
    return { type: 'NO_REMAINING_SLOTS', title: 'No Remaining Slots', text: 'All consultation slots fully booked.' };
  }

  test('Availability display correctly identifies Schedule Not Configured', () => {
    const res = resolveAvailabilityDisplay({
      success: true,
      availableSlots: [],
      message: 'Doctor schedule is not configured',
    });
    assert.strictEqual(res.type, 'SCHEDULE_NOT_CONFIGURED');
    assert.strictEqual(res.title, 'Schedule Not Configured');
  });

  test('Availability display correctly identifies Doctor Off-Duty Day', () => {
    const res = resolveAvailabilityDisplay({
      success: true,
      availableSlots: [],
      message: 'Doctor does not work on this day',
      dayOfWeek: 'TUESDAY',
    });
    assert.strictEqual(res.type, 'OFF_DUTY_DAY');
    assert.strictEqual(res.title, 'Doctor Off-Duty On This Day');
  });

  test('Availability display correctly identifies Past Date Selected', () => {
    const res = resolveAvailabilityDisplay({
      success: false,
      availableSlots: [],
      message: 'Selected date is in the past. Please select today or a future date.',
      isPastDate: true,
    });
    assert.strictEqual(res.type, 'PAST_DATE');
    assert.strictEqual(res.title, 'Past Date Selected');
  });

  test('Availability display correctly identifies No Remaining Slots (slots exhausted)', () => {
    const res = resolveAvailabilityDisplay({
      success: true,
      availableSlotsCount: 0,
      availableSlots: [],
    });
    assert.strictEqual(res.type, 'NO_REMAINING_SLOTS');
    assert.strictEqual(res.title, 'No Remaining Slots');
  });

  test('Availability display correctly identifies API / Network Error Notice', () => {
    const res = resolveAvailabilityDisplay({
      success: false,
      availableSlots: [],
      message: 'Unable to connect to clinic scheduling service.',
      isError: true,
    });
    assert.strictEqual(res.type, 'ERROR_NOTICE');
    assert.strictEqual(res.title, 'Availability Notice');
  });

  // --- 3. IN-MEMORY REPLICA SET INTEGRATION TESTS FOR WORKING-DAY PAYLOAD ---
  console.log('\n--- 3. DOCTOR DISCOVERY WORKING-DAYS INTEGRATION TESTS ---');

  let replSet;
  let connection;

  try {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    const uri = replSet.getUri('qflow_test_avail');
    connection = await mongoose.connect(uri);
    console.log('✓ In-memory MongoDB replica set online for isolated discovery tests.');

    // Seed mock data
    const adminUser = await User.create({
      fullName: 'Clinic Admin',
      email: 'admin@test.com',
      password: 'Password123!',
      role: 'ADMIN',
      isActive: true,
    });

    const clinic = await Clinic.create({
      name: 'City Health Clinic',
      code: 'CHC-01',
      address: { street: '1 Main St', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
      location: { type: 'Point', coordinates: [72.87, 19.07] },
      phone: '9876543210',
      email: 'clinic@test.com',
      adminId: adminUser._id,
      isActive: true,
    });

    const specialty = await Specialty.create({
      name: 'Cardiology',
      code: 'CARDIO-01',
      description: 'Heart care',
      isActive: true,
    });

    const userWithSchedule = await User.create({
      fullName: 'Dr. Jane Cardio',
      email: 'jane@test.com',
      password: 'Password123!',
      role: 'DOCTOR',
      isActive: true,
    });

    const doctorWithSchedule = await Doctor.create({
      userId: userWithSchedule._id,
      clinicId: clinic._id,
      specialtyId: specialty._id,
      fullName: 'Dr. Jane Cardio',
      gender: 'FEMALE',
      qualifications: ['MD', 'DM Cardiology'],
      experienceYears: 10,
      consultationFee: 800,
      averageRating: 4.9,
      totalReviews: 25,
    });

    await DoctorSchedule.create({
      doctorId: doctorWithSchedule._id,
      clinicId: clinic._id,
      isActive: true,
      weeklyHours: [
        {
          dayOfWeek: 'MONDAY',
          isWorkingDay: true,
          shifts: [{ startTime: '09:00', endTime: '13:00' }],
        },
        {
          dayOfWeek: 'WEDNESDAY',
          isWorkingDay: true,
          shifts: [{ startTime: '14:00', endTime: '18:00' }],
        },
        {
          dayOfWeek: 'FRIDAY',
          isWorkingDay: false,
          shifts: [],
        },
      ],
    });

    const userWithoutSchedule = await User.create({
      fullName: 'Dr. Mark Unscheduled',
      email: 'mark@test.com',
      password: 'Password123!',
      role: 'DOCTOR',
      isActive: true,
    });

    const doctorWithoutSchedule = await Doctor.create({
      userId: userWithoutSchedule._id,
      clinicId: clinic._id,
      specialtyId: specialty._id,
      fullName: 'Dr. Mark Unscheduled',
      gender: 'MALE',
      qualifications: ['MBBS'],
      experienceYears: 4,
      consultationFee: 500,
      averageRating: 4.2,
      totalReviews: 5,
    });

    await asyncTest('discoverDoctors returns populated workingDays and hasSchedule flag', async () => {
      const mockReq = { query: {} };
      let jsonPayload = null;
      let statusCode = 200;

      const mockRes = {
        status: (code) => {
          statusCode = code;
          return mockRes;
        },
        json: (data) => {
          jsonPayload = data;
        },
      };

      await discoverDoctors(mockReq, mockRes, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(statusCode, 200);
      assert.strictEqual(jsonPayload.success, true);
      assert.strictEqual(jsonPayload.doctors.length, 2);

      const scheduledDoc = jsonPayload.doctors.find((d) => d._id.toString() === doctorWithSchedule._id.toString());
      assert(scheduledDoc, 'Scheduled doctor must be present in discovery data');
      assert.strictEqual(scheduledDoc.hasSchedule, true);
      assert.deepStrictEqual(scheduledDoc.workingDays, ['MONDAY', 'WEDNESDAY']);

      const unscheduledDoc = jsonPayload.doctors.find((d) => d._id.toString() === doctorWithoutSchedule._id.toString());
      assert(unscheduledDoc, 'Unscheduled doctor must be present in discovery data');
      assert.strictEqual(unscheduledDoc.hasSchedule, false);
      assert.deepStrictEqual(unscheduledDoc.workingDays, []);
    });

    await asyncTest('getDoctorById returns populated workingDays and hasSchedule flag', async () => {
      const mockReq = { params: { id: doctorWithSchedule._id.toString() } };
      let jsonPayload = null;
      let statusCode = 200;

      const mockRes = {
        status: (code) => {
          statusCode = code;
          return mockRes;
        },
        json: (data) => {
          jsonPayload = data;
        },
      };

      await getDoctorById(mockReq, mockRes, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(statusCode, 200);
      assert.strictEqual(jsonPayload.success, true);
      assert.strictEqual(jsonPayload.doctor.hasSchedule, true);
      assert.deepStrictEqual(jsonPayload.doctor.workingDays, ['MONDAY', 'WEDNESDAY']);
    });

    await asyncTest('getDoctorById handles unscheduled doctor with hasSchedule: false', async () => {
      const mockReq = { params: { id: doctorWithoutSchedule._id.toString() } };
      let jsonPayload = null;
      let statusCode = 200;

      const mockRes = {
        status: (code) => {
          statusCode = code;
          return mockRes;
        },
        json: (data) => {
          jsonPayload = data;
        },
      };

      await getDoctorById(mockReq, mockRes, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(statusCode, 200);
      assert.strictEqual(jsonPayload.success, true);
      assert.strictEqual(jsonPayload.doctor.hasSchedule, false);
      assert.deepStrictEqual(jsonPayload.doctor.workingDays, []);
    });

  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (replSet) {
      await replSet.stop();
      console.log('✓ In-memory MongoDB replica set stopped.');
    }
  }

  console.log('\n======================================================================');
  console.log(`TEST RESULTS: ${passed} passed, ${failed} failed.`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
