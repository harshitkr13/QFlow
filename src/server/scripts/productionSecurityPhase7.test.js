import assert from 'assert';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import {
  Clinic,
  Doctor,
  DoctorSchedule,
  Specialty,
  User,
  Patient,
  Appointment,
  Staff,
  QueueEntry,
  Invoice,
  Notification,
} from '../models/index.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { securityHeaders, authRateLimiter, apiRateLimiter } from '../middleware/securityMiddleware.js';
import { errorHandler } from '../middleware/errorMiddleware.js';
import { validateEnvironment } from '../config/envValidator.js';
import { isProtectedDatabase, isTestExecutionContext, parseDatabaseName } from '../config/db.js';
import { generateToken } from '../utils/jwt.js';
import { loginUser, registerPatient, getMe } from '../controllers/authController.js';
import { searchPatients } from '../controllers/staffQueueController.js';
import { getPatientInvoiceById } from '../controllers/billingController.js';
import { markNotificationRead } from '../controllers/notificationController.js';
import { getAppointmentById, cancelAppointment } from '../controllers/appointmentController.js';
import { getStaffListAdmin } from '../controllers/clinicController.js';

process.env.JWT_SECRET = 'test-jwt-secret-qflow-production-security-phase7-hardened-99999';
process.env.NODE_ENV = 'development';

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    getHeader(name) {
      return this.headers[name.toLowerCase()];
    },
    removeHeader(name) {
      delete this.headers[name.toLowerCase()];
      return this;
    },
  };
  return res;
}

function createMockReq({
  user = null,
  body = {},
  params = {},
  query = {},
  headers = {},
  ip = '127.0.0.1',
  method = 'GET',
  originalUrl = '/test',
} = {}) {
  return {
    user,
    body,
    params,
    query,
    headers: { ...headers },
    ip,
    method,
    originalUrl,
    socket: { remoteAddress: ip },
  };
}

async function runProductionSecurityPhase7Tests() {
  console.log('======================================================================');
  console.log('  QFlow — Phase 7: Production Security & Release Hardening Test Suite');
  console.log('  Verifying Auth, RBAC, IDOR, ReDoS, Headers, Errors & Env Safeguards');
  console.log('======================================================================\n');

  let replSet;
  let clinicA;
  let clinicB;
  let doctorA;
  let doctorB;
  let patientA;
  let patientB;
  let staffA;
  let staffB;
  let adminUser;
  let userPatientA;
  let userPatientB;
  let userDoctorA;
  let userDoctorB;
  let userStaffA;
  let userStaffB;
  let testAppointmentA;
  let testInvoiceA;
  let testNotificationA;

  try {
    // 1. Start in-memory MongoDB replica set
    console.log('1. Starting isolated in-memory MongoMemoryReplSet...');
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    const uri = replSet.getUri();
    await mongoose.connect(uri, { dbName: 'qflow_phase7_sec_test' });
    console.log('   Connected to in-memory MongoDB replica set successfully.\n');

    // 2. Provision Test Data Fixtures
    console.log('2. Provisioning Test Data Fixtures...');
    const hashedPass = await bcrypt.hash('SecurePassword#2026', 10);

    adminUser = await User.create({ email: 'sec_admin@qflow.org', password: hashedPass, role: 'ADMIN', isActive: true });
    userPatientA = await User.create({ email: 'sec_pat_a@qflow.org', password: hashedPass, role: 'PATIENT', isActive: true });
    userPatientB = await User.create({ email: 'sec_pat_b@qflow.org', password: hashedPass, role: 'PATIENT', isActive: true });
    userDoctorA = await User.create({ email: 'sec_doc_a@qflow.org', password: hashedPass, role: 'DOCTOR', isActive: true });
    userDoctorB = await User.create({ email: 'sec_doc_b@qflow.org', password: hashedPass, role: 'DOCTOR', isActive: true });
    userStaffA = await User.create({ email: 'sec_staff_a@qflow.org', password: hashedPass, role: 'STAFF', isActive: true });
    userStaffB = await User.create({ email: 'sec_staff_b@qflow.org', password: hashedPass, role: 'STAFF', isActive: true });

    clinicA = await Clinic.create({
      name: 'Alpha Health Center',
      code: 'ALPHA_01',
      city: 'Bangalore',
      phone: '080-12345678',
      adminId: adminUser._id,
      address: { street: '123 Main St', city: 'Bangalore', state: 'Karnataka', pincode: '560001' },
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      isActive: true,
    });
    clinicB = await Clinic.create({
      name: 'Beta Medical Clinic',
      code: 'BETA_01',
      city: 'Bangalore',
      phone: '080-12345679',
      adminId: adminUser._id,
      address: { street: '456 Side St', city: 'Bangalore', state: 'Karnataka', pincode: '560002' },
      location: { type: 'Point', coordinates: [77.595, 12.972] },
      isActive: true,
    });

    const specialty = await Specialty.create({ name: 'General Medicine', code: 'GENMED', isActive: true });

    doctorA = await Doctor.create({
      userId: userDoctorA._id,
      clinicId: clinicA._id,
      specialtyId: specialty._id,
      fullName: 'Dr. Sarah Security',
      gender: 'FEMALE',
      qualifications: ['MBBS'],
      experienceYears: 5,
      consultationFee: 500,
      averageConsultationDurationMinutes: 15,
      isActive: true,
    });
    doctorB = await Doctor.create({
      userId: userDoctorB._id,
      clinicId: clinicB._id,
      specialtyId: specialty._id,
      fullName: 'Dr. John Security',
      gender: 'MALE',
      qualifications: ['MBBS', 'MD'],
      experienceYears: 8,
      consultationFee: 600,
      averageConsultationDurationMinutes: 15,
      isActive: true,
    });

    patientA = await Patient.create({
      userId: userPatientA._id,
      fullName: 'Alice Patient A (Special+Char)',
      phone: '9876543210',
      gender: 'FEMALE',
    });
    patientB = await Patient.create({
      userId: userPatientB._id,
      fullName: 'Bob Patient B',
      phone: '9876543211',
      gender: 'MALE',
    });

    staffA = await Staff.create({
      userId: userStaffA._id,
      clinicId: clinicA._id,
      fullName: 'Staff Alpha',
      phone: '9876543212',
    });
    staffB = await Staff.create({
      userId: userStaffB._id,
      clinicId: clinicB._id,
      fullName: 'Staff Beta',
      phone: '9876543213',
    });

    testAppointmentA = await Appointment.create({
      patientId: patientA._id,
      doctorId: doctorA._id,
      clinicId: clinicA._id,
      specialtyId: specialty._id,
      appointmentDate: '2026-10-30',
      timeSlot: { startTime: '10:00', endTime: '10:15' },
      status: 'BOOKED',
    });

    const testQueueEntryA = await QueueEntry.create({
      clinicId: clinicA._id,
      doctorId: doctorA._id,
      patientId: patientA._id,
      appointmentId: testAppointmentA._id,
      queueDate: '2026-10-30',
      tokenNumber: 1,
      source: 'ONLINE',
      status: 'COMPLETED',
    });

    testInvoiceA = await Invoice.create({
      patientId: patientA._id,
      clinicId: clinicA._id,
      doctorId: doctorA._id,
      queueEntryId: testQueueEntryA._id,
      invoiceNumber: 'INV-SEC-001',
      invoiceDate: '2026-10-30',
      consultationFee: 500,
      totalPayableAmount: 500,
      status: 'ISSUED',
    });

    testNotificationA = await Notification.create({
      patientId: patientA._id,
      title: 'Doctor is Calling',
      message: 'Please proceed to Consultation Room 1.',
      type: 'PATIENT_CALLED',
      isRead: false,
    });

    console.log('   Data fixtures successfully created.\n');

    // =========================================================================
    // SECTION 1: AUTHENTICATION & CREDENTIAL SECURITY
    // =========================================================================
    console.log('3. Running Section 1: Authentication & Credential Security...');

    // Test 1: Password is never returned in login response
    {
      const req = createMockReq({ body: { email: 'sec_pat_a@qflow.org', password: 'SecurePassword#2026' } });
      const res = createMockRes();
      await loginUser(req, res, () => {});
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.user.password, undefined, 'Password must never be returned in login response');
      console.log('  [PASS 1] Password hash is strictly excluded from login response');
    }

    // Test 2: Password is never returned in register response
    {
      const req = createMockReq({
        body: {
          email: 'sec_new_patient@qflow.org',
          password: 'Password#2026',
          fullName: 'New Safe Patient',
          phone: '9876500001',
        },
      });
      const res = createMockRes();
      await registerPatient(req, res, () => {});
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.user.password, undefined, 'Password must never be returned in register response');
      console.log('  [PASS 2] Password hash is strictly excluded from registration response');
    }

    // Test 3: Password is never returned in getMe response
    {
      const req = createMockReq({
        user: { _id: userPatientA._id, email: userPatientA.email, role: 'PATIENT', isActive: true, patientId: patientA._id },
      });
      const res = createMockRes();
      await getMe(req, res, () => {});
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.user.password, undefined, 'Password must never be returned in getMe response');
      console.log('  [PASS 3] Password hash is strictly excluded from getMe user profile');
    }

    // Test 4: Suspended / Inactive account is rejected with 403
    {
      await User.updateOne({ _id: userPatientB._id }, { isActive: false });
      const token = generateToken({ id: userPatientB._id, role: 'PATIENT' });
      const req = createMockReq({ headers: { authorization: `Bearer ${token}` } });
      const res = createMockRes();
      await protect(req, res, () => {});
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.message.includes('suspended') || res.body.message.includes('inactive'), true);
      // Restore active state
      await User.updateOne({ _id: userPatientB._id }, { isActive: true });
      console.log('  [PASS 4] Inactive/suspended account is blocked with 403 Forbidden');
    }

    // =========================================================================
    // SECTION 2: MULTI-TENANT ROLE & IDOR BOUNDARY ENFORCEMENT
    // =========================================================================
    console.log('\n4. Running Section 2: Multi-Tenant Role & IDOR Boundary Enforcement...');

    // Test 5: Patient cannot view another patient's appointment (IDOR Protection)
    {
      const req = createMockReq({
        user: { _id: userPatientB._id, role: 'PATIENT', patientId: patientB._id },
        params: { id: testAppointmentA._id.toString() },
      });
      const res = createMockRes();
      await getAppointmentById(req, res, () => {});
      assert.strictEqual(res.statusCode, 403, 'Patient B must not view Patient A appointment');
      console.log('  [PASS 5] Patient IDOR blocked: cannot view another patient\'s appointment (403)');
    }

    // Test 6: Patient cannot view another patient's invoice (IDOR Protection)
    {
      const req = createMockReq({
        user: { _id: userPatientB._id, role: 'PATIENT', patientId: patientB._id },
        params: { id: testInvoiceA._id.toString() },
      });
      const res = createMockRes();
      await getPatientInvoiceById(req, res);
      assert.strictEqual(res.statusCode, 403, 'Patient B must not view Patient A invoice');
      console.log('  [PASS 6] Patient IDOR blocked: cannot view another patient\'s invoice (403)');
    }

    // Test 7: Patient cannot mark another patient's notification as read (IDOR Protection)
    {
      const req = createMockReq({
        user: { _id: userPatientB._id, role: 'PATIENT', patientId: patientB._id },
        params: { id: testNotificationA._id.toString() },
      });
      const res = createMockRes();
      await markNotificationRead(req, res, () => {});
      assert.strictEqual(res.statusCode, 404, 'Patient B cannot mutate Patient A notification');
      console.log('  [PASS 7] Patient IDOR blocked: cannot access or update another patient\'s notification');
    }

    // Test 8: Doctor A cannot cancel Doctor B's appointment
    {
      const apptDoctorB = await Appointment.create({
        patientId: patientB._id,
        doctorId: doctorB._id,
        clinicId: clinicB._id,
        specialtyId: specialty._id,
        appointmentDate: '2026-10-30',
        timeSlot: { startTime: '11:00', endTime: '11:15' },
        status: 'BOOKED',
      });

      const req = createMockReq({
        user: { _id: userDoctorA._id, role: 'DOCTOR', doctorId: doctorA._id },
        params: { id: apptDoctorB._id.toString() },
        body: { cancellationReason: 'Doctor A unauthorized cancellation' },
      });
      const res = createMockRes();
      await cancelAppointment(req, res, () => {});
      assert.strictEqual(res.statusCode, 403, 'Doctor A must not cancel Doctor B appointment');
      console.log('  [PASS 8] Doctor boundary enforced: cannot cancel another doctor\'s appointment (403)');
    }

    // Test 9: Staff A cannot view appointments outside assigned Clinic A
    {
      const apptClinicB = await Appointment.create({
        patientId: patientB._id,
        doctorId: doctorB._id,
        clinicId: clinicB._id,
        specialtyId: specialty._id,
        appointmentDate: '2026-10-30',
        timeSlot: { startTime: '14:00', endTime: '14:15' },
        status: 'BOOKED',
      });

      const req = createMockReq({
        user: { _id: userStaffA._id, role: 'STAFF', staffId: staffA._id, staffClinicId: clinicA._id },
        params: { id: apptClinicB._id.toString() },
      });
      const res = createMockRes();
      await getAppointmentById(req, res, () => {});
      assert.strictEqual(res.statusCode, 403, 'Staff A must not view Clinic B appointment');
      console.log('  [PASS 9] Staff clinic boundary enforced: cannot view appointment outside clinic (403)');
    }

    // Test 10: Non-admin role blocked by authorize('ADMIN')
    {
      const req = createMockReq({ user: { _id: userStaffA._id, role: 'STAFF' } });
      const res = createMockRes();
      let nextCalled = false;
      authorize('ADMIN')(req, res, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 403);
      console.log('  [PASS 10] Server-side RBAC: Non-admin role is rejected with 403 on admin resource');
    }

    // =========================================================================
    // SECTION 3: REGULAR EXPRESSION INJECTION (ReDoS) MITIGATION
    // =========================================================================
    console.log('\n5. Running Section 3: Regular Expression Injection (ReDoS) Defense...');

    // Test 11: Special characters like ( or [ or + in search do not crash regex
    {
      const req = createMockReq({
        user: { _id: userStaffA._id, role: 'STAFF', staffClinicId: clinicA._id },
        body: { query: 'Special+Char)' },
      });
      const res = createMockRes();
      await searchPatients(req, res, () => {});
      assert.strictEqual(res.statusCode, 200, 'Regex metacharacters must be safely escaped');
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.count >= 1, true);
      assert.strictEqual(res.body.patients[0].fullName, 'Alice Patient A (Special+Char)');
      console.log('  [PASS 11] Regex metacharacters in patient search safely escaped without crash');
    }

    // Test 12: Invalid unescaped regex syntax does not throw MongoDB regex compile error
    {
      const req = createMockReq({
        user: { _id: userStaffA._id, role: 'STAFF', staffClinicId: clinicA._id },
        body: { query: '[[[(((' },
      });
      const res = createMockRes();
      await searchPatients(req, res, () => {});
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.count, 0);
      console.log('  [PASS 12] Malformed brackets/parentheses safely handled as literal strings');
    }

    // =========================================================================
    // SECTION 4: HTTP SECURITY HEADERS & FINGERPRINTING DEFENSE
    // =========================================================================
    console.log('\n6. Running Section 4: Security Headers & Technology Masking...');

    // Test 13: Standard security headers applied
    {
      const req = createMockReq();
      const res = createMockRes();
      res.setHeader('X-Powered-By', 'Express');
      let nextCalled = false;
      securityHeaders(req, res, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.getHeader('X-Frame-Options'), 'DENY');
      assert.strictEqual(res.getHeader('X-Content-Type-Options'), 'nosniff');
      assert.strictEqual(res.getHeader('X-XSS-Protection'), '1; mode=block');
      assert.strictEqual(res.getHeader('Referrer-Policy'), 'strict-origin-when-cross-origin');
      assert.strictEqual(res.getHeader('Permissions-Policy'), 'camera=(), microphone=(), geolocation=()');
      assert.strictEqual(res.getHeader('X-Powered-By'), undefined, 'X-Powered-By header must be removed');
      console.log('  [PASS 13] Security headers applied and X-Powered-By Express fingerprint stripped');
    }

    // Test 14: Strict-Transport-Security applied in production
    {
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const req = createMockReq();
      const res = createMockRes();
      securityHeaders(req, res, () => {});
      assert.strictEqual(res.getHeader('Strict-Transport-Security'), 'max-age=31536000; includeSubDomains');
      process.env.NODE_ENV = prevEnv;
      console.log('  [PASS 14] Strict-Transport-Security (HSTS) enforced in production environment');
    }

    // =========================================================================
    // SECTION 5: GLOBAL ERROR HANDLING & SENSITIVE INFORMATION MASKING
    // =========================================================================
    console.log('\n7. Running Section 5: Global Error Handling & Information Disclosure Masking...');

    // Test 15: Mongoose CastError returns 400 Bad Request instead of 500
    {
      const castErr = new Error('Cast to ObjectId failed for value "invalid-id"');
      castErr.name = 'CastError';
      castErr.value = 'invalid-id';
      const req = createMockReq();
      const res = createMockRes();
      errorHandler(castErr, req, res, () => {});
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message.includes('Invalid identifier format'), true);
      console.log('  [PASS 15] Mongoose CastError gracefully transformed to 400 Bad Request');
    }

    // Test 16: Mongoose ValidationError returns 400 Bad Request
    {
      const valErr = new Error('Validation failed');
      valErr.name = 'ValidationError';
      valErr.errors = {
        email: { message: 'Email is required' },
        fullName: { message: 'Full name is required' },
      };
      const req = createMockReq();
      const res = createMockRes();
      errorHandler(valErr, req, res, () => {});
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.message.includes('Email is required'), true);
      console.log('  [PASS 16] Mongoose ValidationError gracefully transformed to 400 Bad Request');
    }

    // Test 17: MongoDB E11000 duplicate key returns 409 Conflict
    {
      const dupErr = new Error('E11000 duplicate key error');
      dupErr.code = 11000;
      dupErr.keyValue = { email: 'duplicate@qflow.org' };
      const req = createMockReq();
      const res = createMockRes();
      errorHandler(dupErr, req, res, () => {});
      assert.strictEqual(res.statusCode, 409);
      assert.strictEqual(res.body.message.includes('Duplicate field value'), true);
      console.log('  [PASS 17] MongoDB duplicate key error (E11000) transformed to 409 Conflict');
    }

    // Test 18: Unhandled 500 error in production masks internal database exception message
    {
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const internalDbErr = new Error('MongoServerError: bad auth : authentication failed on database qflow-cluster.mongodb.net');
      const req = createMockReq();
      const res = createMockRes();
      errorHandler(internalDbErr, req, res, () => {});
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.message, 'Internal Server Error', 'Internal driver/host details must be masked');
      assert.strictEqual(res.body.stack, undefined, 'Stack trace must be omitted in production');
      process.env.NODE_ENV = prevEnv;
      console.log('  [PASS 18] Internal 500 database exceptions strictly masked as "Internal Server Error" in production');
    }

    // =========================================================================
    // SECTION 6: RATE LIMITING & BRUTE FORCE PROTECTION
    // =========================================================================
    console.log('\n8. Running Section 6: Rate Limiting & Abuse Prevention...');

    // Test 19: Auth rate limiter blocks after reaching limit
    {
      const customRateLimiter = authRateLimiter;
      const testIp = '198.51.100.42';
      let lastRes;

      // Send 30 requests (the limit)
      for (let i = 0; i < 30; i++) {
        const req = createMockReq({ ip: testIp });
        const res = createMockRes();
        customRateLimiter(req, res, () => {});
        lastRes = res;
      }
      assert.strictEqual(lastRes.statusCode, 200);
      assert.strictEqual(lastRes.getHeader('X-RateLimit-Remaining'), 0);

      // 31st request should be rejected with 429
      const blockedReq = createMockReq({ ip: testIp });
      const blockedRes = createMockRes();
      let blockedNext = false;
      customRateLimiter(blockedReq, blockedRes, () => { blockedNext = true; });

      assert.strictEqual(blockedNext, false);
      assert.strictEqual(blockedRes.statusCode, 429);
      assert.strictEqual(blockedRes.body.success, false);
      assert.strictEqual(blockedRes.getHeader('Retry-After') > 0, true);
      console.log('  [PASS 19] Auth rate limiter triggers 429 Too Many Requests with Retry-After header');
    }

    // =========================================================================
    // SECTION 7: PRODUCTION ENVIRONMENT & DATABASE SAFEGUARDS
    // =========================================================================
    console.log('\n9. Running Section 7: Production Environment & Database Safeguards...');

    // Test 20: validateEnvironment rejects missing JWT_SECRET
    {
      assert.throws(
        () => validateEnvironment({ NODE_ENV: 'production', MONGODB_URI: 'mongodb://localhost:27017/qflow' }),
        /JWT_SECRET is missing/
      );
      console.log('  [PASS 20] Startup check fails fast if JWT_SECRET is missing');
    }

    // Test 21: validateEnvironment rejects weak / short JWT_SECRET in production
    {
      assert.throws(
        () =>
          validateEnvironment({
            NODE_ENV: 'production',
            JWT_SECRET: 'short_key',
            MONGODB_URI: 'mongodb://localhost:27017/qflow',
          }),
        /JWT_SECRET is too short for production/
      );
      console.log('  [PASS 21] Startup check rejects weak JWT_SECRET (< 32 characters) in production');
    }

    // Test 22: validateEnvironment rejects placeholder default secrets in production
    {
      assert.throws(
        () =>
          validateEnvironment({
            NODE_ENV: 'production',
            JWT_SECRET: 'your_secure_random_jwt_secret_key_minimum_32_characters',
            MONGODB_URI: 'mongodb://localhost:27017/qflow',
          }),
        /known default\/insecure placeholder/
      );
      console.log('  [PASS 22] Startup check rejects known default placeholder secrets in production');
    }

    // Test 23: validateEnvironment accepts valid production configuration
    {
      const validConfig = validateEnvironment({
        NODE_ENV: 'production',
        JWT_SECRET: 'a_very_strong_production_secret_key_exceeding_32_chars_2026',
        MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/qflow?retryWrites=true&w=majority',
        PORT: 5000,
      });
      assert.strictEqual(validConfig.valid, true);
      assert.strictEqual(validConfig.nodeEnv, 'production');
      console.log('  [PASS 23] Startup check passes valid production credentials and environment');
    }

    // Test 24: Protected database guard identifies qflow
    {
      assert.strictEqual(isProtectedDatabase('qflow'), true);
      assert.strictEqual(isProtectedDatabase('QFLOW'), true);
      assert.strictEqual(isProtectedDatabase('qflow_test'), false);
      assert.strictEqual(parseDatabaseName('mongodb+srv://user:pass@cluster.mongodb.net/qflow?retryWrites=true'), 'qflow');
      console.log('  [PASS 24] Database protection guard correctly classifies production/development database');
    }

    // Test 25: isTestExecutionContext detects test scripts automatically
    {
      const testArgs = ['node', 'src/server/scripts/patientWorkflowPhase4.test.js'];
      const prevArgs = process.argv;
      process.argv = testArgs;
      assert.strictEqual(isTestExecutionContext(), true, 'Must detect *.test.js in command arguments');
      process.argv = prevArgs;
      console.log('  [PASS 25] Test execution context automatically detects all *.test.js scripts');
    }

    // Test 26: Staging environment targeting persistent dev database 'qflow' is rejected
    {
      assert.throws(
        () =>
          validateEnvironment({
            NODE_ENV: 'staging',
            JWT_SECRET: 'staging_secret_key_exceeding_32_characters_long_2026',
            MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/qflow?retryWrites=true&w=majority',
          }),
        /FATAL ISOLATION VIOLATION: Staging environment cannot target the persistent development database "qflow"/
      );
      console.log('  [PASS 26] Staging configuration targeting dev DB "qflow" is rejected with isolation violation');
    }

    // Test 27: Staging environment targeting dedicated 'qflow_staging' database is accepted
    {
      const stagingConfig = validateEnvironment({
        NODE_ENV: 'staging',
        JWT_SECRET: 'staging_secret_key_exceeding_32_characters_long_2026',
        MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/qflow_staging?retryWrites=true&w=majority',
        PORT: 5000,
      });
      assert.strictEqual(stagingConfig.valid, true);
      assert.strictEqual(stagingConfig.nodeEnv, 'staging');
      console.log('  [PASS 27] Staging configuration with dedicated "qflow_staging" database passes cleanly');
    }

    console.log('\n======================================================================');
    console.log('  Phase 7 Production Security Test Results: 27/27 Passed (100%)');
    console.log('======================================================================\n');
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (replSet) {
      await replSet.stop();
      console.log('Isolated in-memory MongoDB replica set stopped cleanly.');
    }
  }
}

runProductionSecurityPhase7Tests().catch((err) => {
  console.error('\n❌ TEST RUNNER FAILURE:', err);
  process.exit(1);
});
