import { User, Patient, Doctor, Staff } from '../models/index.js';
import { verifyToken } from '../utils/jwt.js';

/**
 * Protect middleware: Verifies JWT Bearer token and attaches authenticated user context.
 */
export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no authentication token provided',
    });
  }

  try {
    const decoded = verifyToken(token);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account associated with this token no longer exists',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive or suspended',
      });
    }

    req.user = user;

    // Resolve domain profile references based on role
    if (user.role === 'PATIENT') {
      const patient = await Patient.findOne({ userId: user._id });
      if (patient) {
        req.user.patientId = patient._id;
        req.user.patientProfile = patient;
      }
    } else if (user.role === 'DOCTOR') {
      const doctor = await Doctor.findOne({ userId: user._id });
      if (doctor) {
        req.user.doctorId = doctor._id;
        req.user.doctorProfile = doctor;
      }
    } else if (user.role === 'STAFF') {
      const staff = await Staff.findOne({ userId: user._id });
      if (staff) {
        req.user.staffId = staff._id;
        req.user.staffClinicId = staff.clinicId;
        req.user.staffProfile = staff;
      }
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token invalid or expired',
    });
  }
};

/**
 * Authorize middleware wrapper for Role-Based Access Control (RBAC).
 * @param  {...String} roles - Permitted roles (e.g. 'PATIENT', 'STAFF', 'DOCTOR', 'ADMIN').
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role [${req.user ? req.user.role : 'GUEST'}] is not authorized to access this resource`,
      });
    }
    next();
  };
};

/**
 * Patient Ownership Middleware: Ensures a Patient accesses only their own resources.
 * @param {Function} getTargetPatientId - Function returning target Patient ID from request.
 */
export const requirePatientOwnership = (getTargetPatientId) => {
  return (req, res, next) => {
    if (req.user.role === 'ADMIN') return next();

    const targetPatientId = getTargetPatientId(req);
    if (!targetPatientId || !req.user.patientId || !req.user.patientId.equals(targetPatientId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to access another patient\'s resources',
      });
    }
    next();
  };
};

/**
 * Doctor Ownership Middleware: Ensures a Doctor modifies only their own profile/schedule/status.
 * @param {Function} getTargetDoctorId - Function returning target Doctor ID from request.
 */
export const requireDoctorOwnership = (getTargetDoctorId) => {
  return (req, res, next) => {
    if (req.user.role === 'ADMIN') return next();

    const targetDoctorId = getTargetDoctorId(req);
    if (!targetDoctorId || !req.user.doctorId || !req.user.doctorId.equals(targetDoctorId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to modify another doctor\'s resources',
      });
    }
    next();
  };
};

/**
 * Staff Clinic Scope Middleware: Ensures Staff operates resources belonging only to their assigned clinic.
 * @param {Function} getTargetClinicId - Function returning target Clinic ID from request.
 */
export const requireStaffClinicScope = (getTargetClinicId) => {
  return (req, res, next) => {
    if (req.user.role === 'ADMIN') return next();

    const targetClinicId = getTargetClinicId(req);
    if (!targetClinicId || !req.user.staffClinicId || !req.user.staffClinicId.equals(targetClinicId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Staff is not authorized to operate resources outside their assigned clinic',
      });
    }
    next();
  };
};
