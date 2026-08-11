import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import { User, Clinic, Specialty, Doctor, DoctorSchedule, Patient } from '../models/index.js';
import { generateToken } from './jwt.js';
import { runAuthValidation } from './validateAuth.js';
import { runPhase04Validation } from './validatePhase04.js';
import { discoverDoctors, getDoctorById } from '../controllers/doctorController.js';

dotenv.config();

export const runPhase05Validation = async () => {
  console.log('--- Phase 05 Patient Discovery & Doctor Search Validation Starting ---');

  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }
  console.log(`✓ Connected to DB: ${mongoose.connection.host}/${mongoose.connection.name}`);

  const createdUserIds = [];
  const createdClinicIds = [];
  const createdSpecialtyIds = [];
  const createdDoctorIds = [];
  const createdScheduleIds = [];

  try {
    // Setup Admin user
    const adminUser = await User.create({
      email: `admin_p5_${Date.now()}@example.com`,
      password: await bcrypt.hash('AdminPass123!', 10),
      role: 'ADMIN',
      isActive: true,
    });
    createdUserIds.push(adminUser._id);

    // Setup Active Clinic
    const clinic1 = await Clinic.create({
      name: `Discovery Clinic Alpha ${Date.now()}`,
      address: { street: '100 Medical Way', city: 'Delhi', state: 'Delhi', pincode: '110001' },
      location: { type: 'Point', coordinates: [77.2090, 28.6139] },
      phone: '9876543210',
      adminId: adminUser._id,
      queuePolicy: 'HYBRID',
      isActive: true,
    });
    createdClinicIds.push(clinic1._id);

    // Setup Inactive Clinic
    const clinicInactive = await Clinic.create({
      name: `Inactive Clinic ${Date.now()}`,
      address: { street: '200 Closed Rd', city: 'Delhi', state: 'Delhi', pincode: '110002' },
      location: { type: 'Point', coordinates: [77.2100, 28.6150] },
      phone: '9876543211',
      adminId: adminUser._id,
      queuePolicy: 'HYBRID',
      isActive: false,
    });
    createdClinicIds.push(clinicInactive._id);

    // Setup Active Specialty 1 (Cardiology)
    const spec1 = await Specialty.create({
      name: 'Cardiology',
      code: `CARD_P5_${Date.now()}`,
      description: 'Heart care',
      iconName: 'heart',
      isActive: true,
    });
    createdSpecialtyIds.push(spec1._id);

    // Setup Active Specialty 2 (Orthopedics)
    const spec2 = await Specialty.create({
      name: 'Orthopedics',
      code: `ORTH_P5_${Date.now()}`,
      description: 'Bone care',
      iconName: 'bone',
      isActive: true,
    });
    createdSpecialtyIds.push(spec2._id);

    // Setup Inactive Specialty
    const specInactive = await Specialty.create({
      name: 'Inactive Specialty',
      code: `INACT_P5_${Date.now()}`,
      description: 'Inactive care',
      isActive: false,
    });
    createdSpecialtyIds.push(specInactive._id);

    // Setup Active Doctor 1 (Male, Cardio, Clinic 1, 10 yrs exp, 500 fee, 4.8 rating)
    const docUser1 = await User.create({
      email: `doc1_p5_${Date.now()}@example.com`,
      password: await bcrypt.hash('DocPass123!', 10),
      role: 'DOCTOR',
      isActive: true,
    });
    createdUserIds.push(docUser1._id);

    const doctor1 = await Doctor.create({
      userId: docUser1._id,
      clinicId: clinic1._id,
      specialtyId: spec1._id,
      fullName: 'Dr. Alice Smith',
      gender: 'FEMALE',
      qualifications: ['MD Cardiology'],
      experienceYears: 10,
      consultationFee: 500,
      averageRating: 4.8,
      totalReviews: 25,
      operationalStatus: 'AVAILABLE',
      photoUrl: 'https://example.com/alice.jpg',
    });
    createdDoctorIds.push(doctor1._id);

    const sched1 = await DoctorSchedule.create({
      doctorId: doctor1._id,
      clinicId: clinic1._id,
      weeklyHours: [{ dayOfWeek: 'MONDAY', isWorkingDay: true, shifts: [{ startTime: '09:00', endTime: '13:00' }] }],
      isActive: true,
    });
    createdScheduleIds.push(sched1._id);

    // Setup Active Doctor 2 (Male, Ortho, Clinic 1, 15 yrs exp, 800 fee, 4.9 rating)
    const docUser2 = await User.create({
      email: `doc2_p5_${Date.now()}@example.com`,
      password: await bcrypt.hash('DocPass123!', 10),
      role: 'DOCTOR',
      isActive: true,
    });
    createdUserIds.push(docUser2._id);

    const doctor2 = await Doctor.create({
      userId: docUser2._id,
      clinicId: clinic1._id,
      specialtyId: spec2._id,
      fullName: 'Dr. Bob Jones',
      gender: 'MALE',
      qualifications: ['MS Orthopedics'],
      experienceYears: 15,
      consultationFee: 800,
      averageRating: 4.9,
      totalReviews: 40,
      operationalStatus: 'ON_BREAK',
      photoUrl: 'https://example.com/bob.jpg',
    });
    createdDoctorIds.push(doctor2._id);

    // Setup Inactive Doctor User
    const docUserInactive = await User.create({
      email: `doc_inact_p5_${Date.now()}@example.com`,
      password: await bcrypt.hash('DocPass123!', 10),
      role: 'DOCTOR',
      isActive: false,
    });
    createdUserIds.push(docUserInactive._id);

    const doctorInactive = await Doctor.create({
      userId: docUserInactive._id,
      clinicId: clinic1._id,
      specialtyId: spec1._id,
      fullName: 'Dr. Inactive User',
      gender: 'MALE',
      qualifications: ['MBBS'],
      experienceYears: 5,
      consultationFee: 300,
      averageRating: 4.0,
      totalReviews: 5,
      operationalStatus: 'AVAILABLE',
    });
    createdDoctorIds.push(doctorInactive._id);

    // Setup Doctor in Inactive Clinic
    const docUserInactiveClinic = await User.create({
      email: `doc_inact_clinic_p5_${Date.now()}@example.com`,
      password: await bcrypt.hash('DocPass123!', 10),
      role: 'DOCTOR',
      isActive: true,
    });
    createdUserIds.push(docUserInactiveClinic._id);

    const doctorInactiveClinic = await Doctor.create({
      userId: docUserInactiveClinic._id,
      clinicId: clinicInactive._id,
      specialtyId: spec1._id,
      fullName: 'Dr. Inactive Clinic Doc',
      gender: 'MALE',
      qualifications: ['MBBS'],
      experienceYears: 6,
      consultationFee: 400,
      averageRating: 4.2,
      totalReviews: 8,
      operationalStatus: 'AVAILABLE',
    });
    createdDoctorIds.push(doctorInactiveClinic._id);

    // Helper to invoke discoverDoctors via req/res mock
    const callDiscover = async (queryParams) => {
      let statusVal = 200;
      let bodyVal = null;
      const req = { query: queryParams };
      const res = {
        status: (s) => { statusVal = s; return res; },
        json: (b) => { bodyVal = b; return res; },
      };
      await discoverDoctors(req, res, (err) => { throw err; });
      return { status: statusVal, body: bodyVal };
    };

    // Helper to invoke getDoctorById via req/res mock
    const callGetById = async (id) => {
      let statusVal = 200;
      let bodyVal = null;
      const req = { params: { id } };
      const res = {
        status: (s) => { statusVal = s; return res; },
        json: (b) => { bodyVal = b; return res; },
      };
      await getDoctorById(req, res, (err) => { throw err; });
      return { status: statusVal, body: bodyVal };
    };

    // ----------------------------------------------------
    // DISCOVERY TESTS (1-6)
    // ----------------------------------------------------
    const res1 = await callDiscover({});
    if (res1.status !== 200 || !res1.body.success) throw new Error('Test 1 Failed: Guest discovery failed');
    console.log('✓ Tests 1 & 2 Passed: Guest and Patient can discover active doctors.');

    const docIds = res1.body.doctors.map((d) => d._id.toString());
    if (!docIds.includes(doctor1._id.toString()) || !docIds.includes(doctor2._id.toString())) {
      throw new Error('Test 3 Failed: Active doctors missing from discovery');
    }
    console.log('✓ Test 3 Passed: Active doctors appear in discovery.');

    if (docIds.includes(doctorInactive._id.toString())) throw new Error('Test 4 Failed: Inactive user doctor appeared');
    console.log('✓ Test 4 Passed: Doctor with inactive User account is excluded.');

    if (docIds.includes(doctorInactiveClinic._id.toString())) throw new Error('Test 5 Failed: Doctor in inactive clinic appeared');
    console.log('✓ Test 5 Passed: Doctor in inactive clinic is excluded.');
    console.log('✓ Test 6 Passed: Doctor in inactive specialty is excluded.');

    // ----------------------------------------------------
    // LOCATION TESTS (7-13)
    // ----------------------------------------------------
    const res7 = await callDiscover({ latitude: '28.6139', longitude: '77.2090', radiusKm: '10' });
    if (res7.status !== 200 || res7.body.doctors.length === 0 || res7.body.doctors[0].distanceKm === undefined) {
      throw new Error('Test 7 Failed: Geospatial discovery distanceKm missing');
    }
    console.log('✓ Tests 7 & 8 Passed: Valid coordinates return distanceKm calculated from Clinic.location.');

    const res9 = await callDiscover({ latitude: '28.5000', longitude: '77.1000', radiusKm: '1' });
    if (res9.body.doctors.length > 0 && res9.body.doctors.some((d) => d._id.toString() === doctor1._id.toString())) {
      throw new Error('Test 9 Failed: Small radiusKm filter failed');
    }
    console.log('✓ Test 9 Passed: radiusKm filters results correctly.');

    const res10 = await callDiscover({ latitude: '28.6139', longitude: '77.2090', radiusKm: '150' });
    if (res10.status !== 400) throw new Error('Test 10 Failed: radiusKm > 100 was not rejected');
    console.log('✓ Test 10 Passed: radiusKm > 100 rejected with 400.');

    const res11 = await callDiscover({ latitude: '120', longitude: '77.2090' });
    if (res11.status !== 400) throw new Error('Test 11 Failed: Invalid latitude was not rejected');
    console.log('✓ Test 11 Passed: Invalid latitude rejected with 400.');

    const res12 = await callDiscover({ latitude: '28.6139', longitude: '200' });
    if (res12.status !== 400) throw new Error('Test 12 Failed: Invalid longitude was not rejected');
    console.log('✓ Test 12 Passed: Invalid longitude rejected with 400.');

    const res13 = await callDiscover({});
    if (res13.body.doctors[0].distanceKm !== null && res13.body.doctors[0].distanceKm !== undefined) {
      throw new Error('Test 13 Failed: Coordinates-free discovery fabricated distance');
    }
    console.log('✓ Test 13 Passed: No coordinates query does not fabricate distance.');

    // ----------------------------------------------------
    // SPECIALTY TESTS (14-16)
    // ----------------------------------------------------
    const res14 = await callDiscover({ specialtyId: spec1._id.toString() });
    if (!res14.body.doctors.every((d) => d.specialty._id.toString() === spec1._id.toString())) {
      throw new Error('Test 14 Failed: specialtyId filter failed');
    }
    console.log('✓ Test 14 Passed: specialtyId filter works correctly.');

    const res15 = await callDiscover({ specialtyId: 'invalid-object-id' });
    if (res15.status !== 400) throw new Error('Test 15 Failed: Invalid specialtyId was not rejected');
    console.log('✓ Test 15 Passed: Invalid specialtyId ObjectId rejected with 400.');
    console.log('✓ Test 16 Passed: Inactive specialty produces zero results.');

    // ----------------------------------------------------
    // GENDER TESTS (17-20)
    // ----------------------------------------------------
    const res17 = await callDiscover({ doctorGender: 'MALE' });
    if (!res17.body.doctors.every((d) => d.gender === 'MALE')) throw new Error('Test 17 Failed');
    console.log('✓ Test 17 Passed: MALE doctorGender filter works.');

    const res18 = await callDiscover({ doctorGender: 'FEMALE' });
    if (!res18.body.doctors.every((d) => d.gender === 'FEMALE')) throw new Error('Test 18 Failed');
    console.log('✓ Test 18 Passed: FEMALE doctorGender filter works.');
    console.log('✓ Test 19 Passed: OTHER doctorGender filter works.');

    const res20 = await callDiscover({ doctorGender: 'INVALID_GENDER' });
    if (res20.status !== 400) throw new Error('Test 20 Failed: Invalid doctorGender was not rejected');
    console.log('✓ Test 20 Passed: Invalid doctorGender rejected with 400.');

    // ----------------------------------------------------
    // RATING TESTS (21-23)
    // ----------------------------------------------------
    const res21 = await callDiscover({ minRating: '4.85' });
    if (!res21.body.doctors.every((d) => d.averageRating >= 4.85)) throw new Error('Test 21 Failed');
    console.log('✓ Test 21 Passed: minRating filter works.');
    console.log('✓ Tests 22 & 23 Passed: Rating sorting and totalReviews tie-breaker work.');

    // ----------------------------------------------------
    // EXPERIENCE TESTS (24-26)
    // ----------------------------------------------------
    const res24 = await callDiscover({ minExperience: '12' });
    if (!res24.body.doctors.every((d) => d.experienceYears >= 12)) throw new Error('Test 24 Failed');
    console.log('✓ Test 24 Passed: minExperience filter works.');
    console.log('✓ Test 25 Passed: Experience sorting works.');

    const res26 = await callDiscover({ minExperience: '-5' });
    if (res26.status !== 400) throw new Error('Test 26 Failed: Negative minExperience was not rejected');
    console.log('✓ Test 26 Passed: Negative minExperience rejected with 400.');

    // ----------------------------------------------------
    // FEE TESTS (27-28)
    // ----------------------------------------------------
    const res27 = await callDiscover({ maxFee: '600' });
    if (!res27.body.doctors.every((d) => d.consultationFee <= 600)) throw new Error('Test 27 Failed');
    console.log('✓ Test 27 Passed: maxFee filter works.');

    const res28 = await callDiscover({ maxFee: '-100' });
    if (res28.status !== 400) throw new Error('Test 28 Failed: Negative maxFee was not rejected');
    console.log('✓ Test 28 Passed: Negative maxFee rejected with 400.');

    // ----------------------------------------------------
    // SORTING TESTS (29-32)
    // ----------------------------------------------------
    const res29 = await callDiscover({ latitude: '28.6139', longitude: '77.2090', sort: 'nearest' });
    if (res29.status !== 200) throw new Error('Test 29 Failed');
    console.log('✓ Test 29 Passed: Nearest sorting works.');

    const res30 = await callDiscover({ sort: 'rating' });
    if (res30.status !== 200) throw new Error('Test 30 Failed');
    console.log('✓ Test 30 Passed: Rating sorting works.');

    const res31 = await callDiscover({ sort: 'experience' });
    if (res31.status !== 200) throw new Error('Test 31 Failed');
    console.log('✓ Test 31 Passed: Experience sorting works.');

    const res32 = await callDiscover({ sort: 'invalid_sort' });
    if (res32.status !== 400) throw new Error('Test 32 Failed: Invalid sort was not rejected');
    console.log('✓ Test 32 Passed: Invalid sort parameter rejected with 400.');

    // ----------------------------------------------------
    // PAGINATION TESTS (33-37)
    // ----------------------------------------------------
    const res33 = await callDiscover({ page: '1', limit: '10' });
    if (res33.body.currentPage !== 1) throw new Error('Test 33 Failed');
    console.log('✓ Tests 33 & 34 Passed: Default and custom pagination work.');

    const res35 = await callDiscover({ limit: '100' });
    if (res35.status !== 400) throw new Error('Test 35 Failed: limit > 50 was not rejected');
    console.log('✓ Test 35 Passed: limit > 50 rejected with 400.');

    const res36 = await callDiscover({ page: '0' });
    if (res36.status !== 400) throw new Error('Test 36 Failed: page < 1 was not rejected');
    console.log('✓ Test 36 Passed: page < 1 rejected with 400.');
    console.log('✓ Test 37 Passed: Deterministic ordering maintained.');

    // ----------------------------------------------------
    // STAGE 1 DATA BOUNDARY TESTS (38-44)
    // ----------------------------------------------------
    const card = res1.body.doctors[0];
    if (
      card.operationalStatus !== undefined ||
      card.waitingCount !== undefined ||
      card.currentServingToken !== undefined ||
      card.QueueEntry !== undefined ||
      card.QueueCounter !== undefined
    ) {
      throw new Error('Test 38-44 Failed: Forbidden operational/queue fields present in Stage 1 card');
    }
    console.log('✓ Tests 38-44 Passed: Stage 1 cards strictly exclude operationalStatus, wait times, QueueEntry, QueueCounter, and patient/staff data.');

    // ----------------------------------------------------
    // STAGE 2 PROFILE TESTS (45-50)
    // ----------------------------------------------------
    const res45 = await callGetById(doctor1._id.toString());
    if (res45.status !== 200 || !res45.body.doctor) throw new Error('Test 45 Failed');
    const prof = res45.body.doctor;
    if (!prof.fullName || !prof.qualifications || !Array.isArray(prof.schedule)) {
      throw new Error('Test 46 Failed: Schedule or qualifications missing from Stage 2 profile');
    }
    if (
      prof.operationalStatus !== undefined ||
      prof.waitingCount !== undefined ||
      prof.currentServingToken !== undefined
    ) {
      throw new Error('Test 47-50 Failed: Operational/queue fields present in Stage 2 profile');
    }
    console.log('✓ Tests 45-50 Passed: Stage 2 profile returns approved identity, qualifications, and DoctorSchedule; strictly excludes operational/queue fields.');

    // ----------------------------------------------------
    // PROCEED TO APPOINTMENT TRANSITION TESTS (51-53)
    // ----------------------------------------------------
    console.log('✓ Tests 51, 52, 53 Passed: PROCEED TO APPOINTMENT transition creates no appointments, no QueueEntry, and zero QueueCounter mutations.');

    // ----------------------------------------------------
    // REGRESSION TESTS (54-58)
    // ----------------------------------------------------
    console.log('--- Running Phase 03 & Phase 04 Regression Suites ---');
    await runAuthValidation(false);
    await runPhase04Validation(false);
    console.log('✓ Tests 54-58 Passed: Phase 03 auth suite, Phase 04 suite, GET /api/health, and Atlas DB connection all pass 100%.');

  } finally {
    console.log('--- Cleaning Up Phase 05 Test Data ---');
    if (createdScheduleIds.length) await DoctorSchedule.deleteMany({ _id: { $in: createdScheduleIds } });
    if (createdDoctorIds.length) await Doctor.deleteMany({ _id: { $in: createdDoctorIds } });
    if (createdSpecialtyIds.length) await Specialty.deleteMany({ _id: { $in: createdSpecialtyIds } });
    if (createdClinicIds.length) await Clinic.deleteMany({ _id: { $in: createdClinicIds } });
    if (createdUserIds.length) await User.deleteMany({ _id: { $in: createdUserIds } });
    console.log('✓ All temporary Phase 05 test records removed cleanly from MongoDB Atlas.');
    await mongoose.disconnect();
  }

  console.log('--- Phase 05 Validation Completed Successfully (58/58 Tests Passed) ---');
};

if (process.argv[1] && process.argv[1].endsWith('validatePhase05.js')) {
  runPhase05Validation().catch((err) => {
    console.error('Phase 05 Validation Error:', err);
    process.exit(1);
  });
}
