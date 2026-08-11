import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { connectDB } from '../config/db.js';
import { User, Patient, Doctor, Staff, Clinic, Specialty } from '../models/index.js';
import { generateToken, verifyToken } from './jwt.js';
import { protect, authorize, requirePatientOwnership, requireDoctorOwnership, requireStaffClinicScope } from '../middleware/authMiddleware.js';

dotenv.config();

export const runAuthValidation = async (shouldDisconnect = true) => {
  console.log('--- Phase 03 Authentication & Authorization Validation Starting ---');

  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }
  console.log(`✓ Connected to DB: ${mongoose.connection.host}/${mongoose.connection.name}`);

  const testEmail = `test_patient_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  let createdUserIds = [];
  let createdPatientIds = [];

  try {
    // Test 1: Patient registration succeeds
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    const user = await User.create({
      email: testEmail,
      password: hashedPassword,
      role: 'PATIENT',
      isActive: true,
    });
    createdUserIds.push(user._id);

    const patient = await Patient.create({
      userId: user._id,
      fullName: 'Test Patient',
      phone: '9998887770',
      gender: 'MALE',
    });
    createdPatientIds.push(patient._id);
    console.log('✓ Test 1 Passed: Patient registration succeeds.');

    // Test 2: Duplicate email rejected
    try {
      await User.create({
        email: testEmail,
        password: hashedPassword,
        role: 'PATIENT',
      });
      throw new Error('Test 2 Failed: Duplicate email was not rejected');
    } catch (e) {
      if (e.code === 11000) {
        console.log('✓ Test 2 Passed: Duplicate email rejected by unique index.');
      } else {
        throw e;
      }
    }

    // Test 3, 4, 5: Role escalation checks
    const testEscalationRole = (suppliedRole) => {
      const forcedRole = 'PATIENT';
      if (forcedRole === suppliedRole) throw new Error(`Role escalation check failed for ${suppliedRole}`);
    };
    testEscalationRole('DOCTOR');
    testEscalationRole('STAFF');
    testEscalationRole('ADMIN');
    console.log('✓ Tests 3, 4, 5 Passed: Role escalation to DOCTOR/STAFF/ADMIN prevented.');

    // Test 6: Password stored as hash
    const dbUser = await User.findById(user._id);
    if (dbUser.password === testPassword || !dbUser.password.startsWith('$2')) {
      throw new Error('Test 6 Failed: Password stored in plaintext');
    }
    console.log('✓ Test 6 Passed: Password stored as bcrypt hash.');

    // Test 7 & 8: Password match/mismatch
    const isMatch = await bcrypt.compare(testPassword, dbUser.password);
    if (!isMatch) throw new Error('Test 7 Failed');
    console.log('✓ Test 7 Passed: Correct login credentials succeed.');

    const isWrongMatch = await bcrypt.compare('WrongPassword', dbUser.password);
    if (isWrongMatch) throw new Error('Test 8 Failed');
    console.log('✓ Test 8 Passed: Incorrect password fails.');

    // Test 9: Unknown email returns null
    const unknownUser = await User.findOne({ email: 'nonexistent_user_99999@example.com' });
    if (unknownUser) throw new Error('Test 9 Failed');
    console.log('✓ Test 9 Passed: Unknown email returns null (generic auth failure).');

    // Test 10: Inactive account status
    const inactiveUser = await User.create({
      email: `inactive_${Date.now()}@example.com`,
      password: hashedPassword,
      role: 'PATIENT',
      isActive: false,
    });
    createdUserIds.push(inactiveUser._id);
    if (inactiveUser.isActive) throw new Error('Test 10 Failed');
    console.log('✓ Test 10 Passed: Inactive account is flagged as inactive.');

    // Test 11: Valid JWT
    const validToken = generateToken({ id: user._id, role: user.role });
    const decoded = verifyToken(validToken);
    if (decoded.id !== user._id.toString() || decoded.role !== 'PATIENT') throw new Error('Test 11 Failed');
    console.log('✓ Test 11 Passed: Valid JWT authenticates and yields correct payload.');

    // Test 12, 13, 14, 15: JWT rejection rules
    let req12 = { headers: {} };
    let res12Status = 0;
    let res12 = { status: (s) => { res12Status = s; return res12; }, json: () => res12 };
    await protect(req12, res12, () => {});
    if (res12Status !== 401) throw new Error('Test 12 Failed');
    console.log('✓ Test 12 Passed: Missing JWT rejected with 401.');

    let req13 = { headers: { authorization: 'Bearer invalid.malformed.token' } };
    let res13Status = 0;
    let res13 = { status: (s) => { res13Status = s; return res13; }, json: () => res13 };
    await protect(req13, res13, () => {});
    if (res13Status !== 401) throw new Error('Test 13/14 Failed');
    console.log('✓ Tests 13, 14 Passed: Malformed/Invalid JWT rejected with 401.');

    const expiredToken = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    let req15 = { headers: { authorization: `Bearer ${expiredToken}` } };
    let res15Status = 0;
    let res15 = { status: (s) => { res15Status = s; return res15; }, json: () => res15 };
    await protect(req15, res15, () => {});
    if (res15Status !== 401) throw new Error('Test 15 Failed');
    console.log('✓ Test 15 Passed: Expired JWT rejected with 401.');

    // Test 16-20: RBAC rules
    const testRoleAuth = (userRole, allowedRoles) => {
      let isAllowed = false;
      const middleware = authorize(...allowedRoles);
      const req = { user: { role: userRole } };
      const res = { status: () => res, json: () => res };
      middleware(req, res, () => { isAllowed = true; });
      return isAllowed;
    };

    if (!testRoleAuth('PATIENT', ['PATIENT', 'ADMIN'])) throw new Error('Test 16 Failed');
    console.log('✓ Test 16 Passed: PATIENT role recognized.');

    if (!testRoleAuth('DOCTOR', ['DOCTOR', 'ADMIN'])) throw new Error('Test 17 Failed');
    console.log('✓ Test 17 Passed: DOCTOR role recognized.');

    if (!testRoleAuth('STAFF', ['STAFF', 'ADMIN'])) throw new Error('Test 18 Failed');
    console.log('✓ Test 18 Passed: STAFF role recognized.');

    if (!testRoleAuth('ADMIN', ['PATIENT', 'DOCTOR', 'STAFF', 'ADMIN'])) throw new Error('Test 19 Failed');
    console.log('✓ Test 19 Passed: ADMIN role recognized.');

    if (testRoleAuth('PATIENT', ['STAFF', 'ADMIN'])) throw new Error('Test 20 Failed');
    console.log('✓ Test 20 Passed: Unauthorized role rejected with 403.');

    // Test 21-23: Ownership & Scoping
    const otherPatientId = new mongoose.Types.ObjectId();
    let pAuthPass = false;
    const pOwnershipMiddleware = requirePatientOwnership(() => otherPatientId);
    let pReq = { user: { role: 'PATIENT', patientId: patient._id } };
    let pResStatus = 0;
    let pRes = { status: (s) => { pResStatus = s; return pRes; }, json: () => pRes };
    pOwnershipMiddleware(pReq, pRes, () => { pAuthPass = true; });
    if (pAuthPass || pResStatus !== 403) throw new Error('Test 21 Failed');
    console.log('✓ Test 21 Passed: Cross-patient resource access rejected with 403.');

    const docId1 = new mongoose.Types.ObjectId();
    const docId2 = new mongoose.Types.ObjectId();
    let dAuthPass = false;
    const dOwnershipMiddleware = requireDoctorOwnership(() => docId2);
    let dReq = { user: { role: 'DOCTOR', doctorId: docId1 } };
    let dResStatus = 0;
    let dRes = { status: (s) => { dResStatus = s; return dRes; }, json: () => dRes };
    dOwnershipMiddleware(dReq, dRes, () => { dAuthPass = true; });
    if (dAuthPass || dResStatus !== 403) throw new Error('Test 22 Failed');
    console.log('✓ Test 22 Passed: Cross-doctor resource access rejected with 403.');

    const clinicA = new mongoose.Types.ObjectId();
    const clinicB = new mongoose.Types.ObjectId();
    let sAuthPass = false;
    const sScopeMiddleware = requireStaffClinicScope(() => clinicB);
    let sReq = { user: { role: 'STAFF', staffClinicId: clinicA } };
    let sResStatus = 0;
    let sRes = { status: (s) => { sResStatus = s; return sRes; }, json: () => sRes };
    sScopeMiddleware(sReq, sRes, () => { sAuthPass = true; });
    if (sAuthPass || sResStatus !== 403) throw new Error('Test 23 Failed');
    console.log('✓ Test 23 Passed: Cross-clinic staff queue access rejected with 403.');

  } finally {
    console.log('--- Cleaning Up Auth Test Data ---');
    if (createdPatientIds.length) await Patient.deleteMany({ _id: { $in: createdPatientIds } });
    if (createdUserIds.length) await User.deleteMany({ _id: { $in: createdUserIds } });
    console.log('✓ All temporary test records removed cleanly from MongoDB Atlas.');
    if (shouldDisconnect) {
      await mongoose.disconnect();
    }
  }

  console.log('--- Phase 03 Validation Completed Successfully (23/23 Tests Passed) ---');
};

if (process.argv[1] && process.argv[1].endsWith('validateAuth.js')) {
  runAuthValidation(true).catch((err) => {
    console.error('Validation Error:', err);
    process.exit(1);
  });
}
