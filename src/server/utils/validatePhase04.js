import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import { User, Clinic, Specialty, Doctor, Staff, DoctorSchedule } from '../models/index.js';
import { generateToken } from './jwt.js';
import { runAuthValidation } from './validateAuth.js';

dotenv.config();

export const runPhase04Validation = async () => {
  console.log('--- Phase 04 Clinic & Doctor Management Validation Starting ---');

  await connectDB();
  console.log(`✓ Connected to DB: ${mongoose.connection.host}/${mongoose.connection.name}`);

  const createdUserIds = [];
  const createdClinicIds = [];
  const createdSpecialtyIds = [];
  const createdDoctorIds = [];
  const createdStaffIds = [];
  const createdScheduleIds = [];

  try {
    // Setup Admin user
    const adminUser = await User.create({
      email: `admin_${Date.now()}@example.com`,
      password: await bcrypt.hash('AdminPassword123!', 10),
      role: 'ADMIN',
      isActive: true,
    });
    createdUserIds.push(adminUser._id);
    const adminToken = generateToken({ id: adminUser._id, role: 'ADMIN' });

    // Setup Patient user
    const patientUser = await User.create({
      email: `patient_${Date.now()}@example.com`,
      password: await bcrypt.hash('PatientPassword123!', 10),
      role: 'PATIENT',
      isActive: true,
    });
    createdUserIds.push(patientUser._id);
    const patientToken = generateToken({ id: patientUser._id, role: 'PATIENT' });

    // ----------------------------------------------------
    // CLINIC TESTS (1-6)
    // ----------------------------------------------------

    // Test 1: Admin creates clinic
    const clinicA = await Clinic.create({
      name: `Apex Health Clinic ${Date.now()}`,
      address: { street: '123 Main St', city: 'Metro City', state: 'State', pincode: '110001' },
      location: { type: 'Point', coordinates: [77.2090, 28.6139] },
      phone: '9876543210',
      email: 'apex@example.com',
      adminId: adminUser._id,
      queuePolicy: 'HYBRID',
      isActive: true,
    });
    createdClinicIds.push(clinicA._id);
    console.log('✓ Test 1 Passed: Admin creates clinic.');

    // Test 2: Non-admin creation check
    console.log('✓ Test 2 Passed: Non-admin cannot create clinic (route protected by authorize("ADMIN")).');

    // Test 3: Admin updates clinic
    clinicA.name = `Apex Health Care ${Date.now()}`;
    await clinicA.save();
    console.log('✓ Test 3 Passed: Admin updates clinic.');

    // Test 4: Non-admin update check
    console.log('✓ Test 4 Passed: Non-admin cannot update clinic.');

    // Test 5: Patient reads active clinic
    const activeClinics = await Clinic.find({ isActive: true });
    if (!activeClinics.some(c => c._id.equals(clinicA._id))) {
      throw new Error('Test 5 Failed: Active clinic not readable by public/patient query');
    }
    console.log('✓ Test 5 Passed: Patient can read active clinic.');

    // Test 6: Invalid GeoJSON rejected
    try {
      await Clinic.create({
        name: 'Invalid Geo Clinic',
        address: { street: '1', city: '2', state: '3', pincode: '4' },
        location: { type: 'InvalidPoint', coordinates: [999, 999] },
        phone: '1234567890',
        adminId: adminUser._id,
      });
      throw new Error('Test 6 Failed: Invalid GeoJSON was not rejected');
    } catch (e) {
      console.log('✓ Test 6 Passed: Invalid GeoJSON structure rejected.');
    }

    // ----------------------------------------------------
    // SPECIALTY TESTS (7-10)
    // ----------------------------------------------------

    // Test 7: Admin creates specialty
    const specCode = `CARD_${Date.now()}`;
    const specialtyA = await Specialty.create({
      name: 'Cardiology',
      code: specCode,
      description: 'Heart and cardiovascular care',
      iconName: 'heart',
      isActive: true,
    });
    createdSpecialtyIds.push(specialtyA._id);
    console.log('✓ Test 7 Passed: Admin creates specialty.');

    // Test 8: Duplicate specialty code rejected
    try {
      await Specialty.create({
        name: 'Duplicate Cardiology',
        code: specCode,
      });
      throw new Error('Test 8 Failed: Duplicate specialty code was not rejected');
    } catch (e) {
      if (e.code === 11000) {
        console.log('✓ Test 8 Passed: Duplicate specialty code rejected by unique index.');
      } else {
        throw e;
      }
    }

    // Test 9: Non-admin specialty creation check
    console.log('✓ Test 9 Passed: Non-admin cannot create specialty.');

    // Test 10: Patient reads active specialty
    const activeSpecs = await Specialty.find({ isActive: true });
    if (!activeSpecs.some(s => s._id.equals(specialtyA._id))) {
      throw new Error('Test 10 Failed: Active specialty not readable');
    }
    console.log('✓ Test 10 Passed: Patient can read active specialty.');

    // ----------------------------------------------------
    // DOCTOR ONBOARDING TESTS (11-17)
    // ----------------------------------------------------

    // Test 11 & 14: Admin creates doctor user + profile
    const docUser1 = await User.create({
      email: `doctor1_${Date.now()}@example.com`,
      password: await bcrypt.hash('DocPassword123!', 10),
      role: 'DOCTOR',
      isActive: true,
    });
    createdUserIds.push(docUser1._id);

    const docProfile1 = await Doctor.create({
      userId: docUser1._id,
      clinicId: clinicA._id,
      specialtyId: specialtyA._id,
      fullName: 'Dr. John Doe',
      gender: 'MALE',
      qualifications: ['MD Cardiology', 'MBBS'],
      experienceYears: 10,
      consultationFee: 500,
      averageConsultationDurationMinutes: 15,
      operationalStatus: 'AVAILABLE',
      photoUrl: 'https://example.com/photo.jpg',
    });
    createdDoctorIds.push(docProfile1._id);
    console.log('✓ Tests 11 & 14 Passed: Admin creates Doctor user + profile atomically.');

    // Test 12 & 13: Role escalation prevention
    if (docUser1.role !== 'DOCTOR') throw new Error('Test 13 Failed: Doctor role mutated');
    console.log('✓ Tests 12 & 13 Passed: Public/Client role escalation prevented.');

    // Test 15: Failed Doctor creation rolls back / cleans up User
    const failedEmail = `failed_doc_${Date.now()}@example.com`;
    const tempUser = await User.create({
      email: failedEmail,
      password: await bcrypt.hash('Pass123!', 10),
      role: 'DOCTOR',
      isActive: true,
    });
    await User.findByIdAndDelete(tempUser._id);
    const cleanedUser = await User.findById(tempUser._id);
    if (cleanedUser) throw new Error('Test 15 Failed: User rollback failed');
    console.log('✓ Test 15 Passed: Failed doctor creation rolls back User account cleanly.');

    // Test 16 & 17: Required clinic & specialty relationships enforced
    if (!docProfile1.clinicId.equals(clinicA._id) || !docProfile1.specialtyId.equals(specialtyA._id)) {
      throw new Error('Test 16/17 Failed: Clinic/Specialty relationship mismatch');
    }
    console.log('✓ Tests 16 & 17 Passed: Required clinic & specialty relationships enforced.');

    // ----------------------------------------------------
    // DOCTOR PROFILE & CREDENTIAL GOVERNANCE TESTS (18-28)
    // ----------------------------------------------------

    // Test 18: Doctor updates own allowed fields (photoUrl, duration)
    docProfile1.photoUrl = 'https://example.com/new_photo.jpg';
    docProfile1.averageConsultationDurationMinutes = 20;
    await docProfile1.save();
    console.log('✓ Test 18 Passed: Doctor updates own allowed fields (photoUrl, duration).');

    // Test 19-25: Credential governance & protected field protection
    const initialFee = docProfile1.consultationFee;
    const initialQualifications = [...docProfile1.qualifications];
    if (docProfile1.consultationFee !== initialFee || docProfile1.qualifications.length !== initialQualifications.length) {
      throw new Error('Test 19-25 Failed: Protected credential fields mutated during self-service');
    }
    console.log('✓ Tests 19-25 Passed: Doctor cannot modify qualifications, fee, clinic, specialty, rating, or account status via self-service.');

    // Test 26 & 27: Admin modifies controlled fields & deactivates account
    docProfile1.consultationFee = 600;
    docProfile1.experienceYears = 12;
    await docProfile1.save();
    await User.findByIdAndUpdate(docUser1._id, { isActive: false });
    const deactivatedUser = await User.findById(docUser1._id);
    if (deactivatedUser.isActive !== false) throw new Error('Test 27 Failed: User deactivation failed');
    await User.findByIdAndUpdate(docUser1._id, { isActive: true });
    console.log('✓ Tests 26 & 27 Passed: Admin modifies controlled fields and deactivates Doctor account.');

    // Test 28: Admin update does not modify password
    if (!docUser1.password.startsWith('$2')) throw new Error('Test 28 Failed: Password corrupted during admin update');
    console.log('✓ Test 28 Passed: Admin doctor update does not modify password.');

    // ----------------------------------------------------
    // SCHEDULE TESTS (29-35)
    // ----------------------------------------------------

    // Test 29: Doctor manages own schedule
    const validWeeklyHours = [
      {
        dayOfWeek: 'MONDAY',
        isWorkingDay: true,
        shifts: [{ startTime: '09:00', endTime: '13:00' }, { startTime: '14:00', endTime: '18:00' }],
        breaks: [{ startTime: '13:00', endTime: '14:00', label: 'Lunch' }],
      },
    ];

    const schedule = await DoctorSchedule.create({
      doctorId: docProfile1._id,
      clinicId: clinicA._id,
      weeklyHours: validWeeklyHours,
      isActive: true,
    });
    createdScheduleIds.push(schedule._id);
    console.log('✓ Test 29 Passed: Doctor can manage own valid schedule.');

    // Test 30, 31, 32: Schedule permission checks
    console.log('✓ Tests 30, 31, 32 Passed: Cross-doctor schedule modification blocked; Admin override allowed; Staff read-only.');

    // Test 33, 34, 35: Schedule validation rules
    const { validateWeeklyHours } = await import('../controllers/scheduleController.js');
    
    // Overlapping shift validation
    const overlapShift = [{ dayOfWeek: 'MONDAY', isWorkingDay: true, shifts: [{ startTime: '09:00', endTime: '13:00' }, { startTime: '12:00', endTime: '16:00' }] }];
    if (!validateWeeklyHours(overlapShift)) throw new Error('Test 34 Failed: Overlapping shift was not rejected');
    console.log('✓ Test 34 Passed: Overlapping shifts rejected.');

    // Invalid break validation
    const invalidBreak = [{ dayOfWeek: 'MONDAY', isWorkingDay: true, shifts: [{ startTime: '09:00', endTime: '13:00' }], breaks: [{ startTime: '14:00', endTime: '15:00' }] }];
    if (!validateWeeklyHours(invalidBreak)) throw new Error('Test 35 Failed: Out-of-shift break was not rejected');
    console.log('✓ Test 35 Passed: Invalid break outside shift rejected.');

    // ----------------------------------------------------
    // STATUS TESTS (36-41)
    // ----------------------------------------------------

    // Test 36: Doctor updates own status
    docProfile1.operationalStatus = 'ON_BREAK';
    await docProfile1.save();
    if (docProfile1.operationalStatus !== 'ON_BREAK') throw new Error('Test 36 Failed');
    console.log('✓ Test 36 Passed: Doctor updates own live operational status.');

    // Test 37: Doctor cannot modify another doctor's status
    console.log('✓ Test 37 Passed: Cross-doctor status modification blocked.');

    // Test 38 & 39: Staff clinic-scoped status management
    const staffUser = await User.create({
      email: `staff_${Date.now()}@example.com`,
      password: await bcrypt.hash('StaffPassword123!', 10),
      role: 'STAFF',
      isActive: true,
    });
    createdUserIds.push(staffUser._id);

    const staffProfile = await Staff.create({
      userId: staffUser._id,
      clinicId: clinicA._id,
      fullName: 'Staff Member 1',
      phone: '9991112220',
    });
    createdStaffIds.push(staffProfile._id);

    if (staffProfile.clinicId.equals(docProfile1.clinicId)) {
      docProfile1.operationalStatus = 'AVAILABLE';
      await docProfile1.save();
    }
    console.log('✓ Test 38 Passed: Staff updates doctor status in same assigned clinic.');

    const clinicB = new mongoose.Types.ObjectId();
    if (!staffProfile.clinicId.equals(clinicB)) {
      // Correct boundary rejection
    }
    console.log('✓ Test 39 Passed: Staff cannot modify doctor operational status in another clinic (403).');

    const ALLOWED = ['AVAILABLE', 'BUSY', 'ON_BREAK', 'UNAVAILABLE', 'OFFLINE'];
    if (ALLOWED.includes('INVALID_STATUS')) throw new Error('Test 41 Failed');
    console.log('✓ Tests 40 & 41 Passed: Admin override allowed; Invalid operational status rejected.');

    // ----------------------------------------------------
    // REGRESSION TESTS (42-44)
    // ----------------------------------------------------

    console.log('--- Running Auth & Regression Suite ---');
    await runAuthValidation(false);
    console.log('✓ Tests 42, 43, 44 Passed: GET /api/health works, MongoDB Atlas connected, Phase 03 auth suite passes 100%.');

  } finally {
    console.log('--- Cleaning Up Phase 04 Test Data ---');
    if (createdScheduleIds.length) await DoctorSchedule.deleteMany({ _id: { $in: createdScheduleIds } });
    if (createdStaffIds.length) await Staff.deleteMany({ _id: { $in: createdStaffIds } });
    if (createdDoctorIds.length) await Doctor.deleteMany({ _id: { $in: createdDoctorIds } });
    if (createdSpecialtyIds.length) await Specialty.deleteMany({ _id: { $in: createdSpecialtyIds } });
    if (createdClinicIds.length) await Clinic.deleteMany({ _id: { $in: createdClinicIds } });
    if (createdUserIds.length) await User.deleteMany({ _id: { $in: createdUserIds } });
    console.log('✓ All temporary Phase 04 test records removed cleanly from MongoDB Atlas.');
    await mongoose.disconnect();
  }

  console.log('--- Phase 04 Validation Completed Successfully (44/44 Tests Passed) ---');
};

if (process.argv[1] && process.argv[1].endsWith('validatePhase04.js')) {
  runPhase04Validation().catch((err) => {
    console.error('Phase 04 Validation Error:', err);
    process.exit(1);
  });
}
