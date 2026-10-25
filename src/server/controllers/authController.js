import bcrypt from 'bcryptjs';
import { User, Patient, Doctor, Staff } from '../models/index.js';
import { generateToken } from '../utils/jwt.js';

/**
 * @desc    Public self-registration for Patient accounts
 * @route   POST /api/auth/register
 * @access  Public
 */
export const registerPatient = async (req, res, next) => {
  try {
    const { email, password, fullName, phone, gender, dateOfBirth, address } = req.body;

    // Validate required fields
    if (!email || !password || !fullName || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, password, fullName, and phone number',
      });
    }

    // Password length validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check for duplicate email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email address is already registered',
      });
    }

    // Force role to PATIENT (prevent privilege escalation)
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email: normalizedEmail,
      password: hashedPassword,
      role: 'PATIENT',
      isActive: true,
    });

    try {
      const patient = await Patient.create({
        userId: user._id,
        fullName: fullName.trim(),
        phone: phone.trim(),
        gender: gender || 'PREFER_NOT_TO_SAY',
        dateOfBirth: dateOfBirth || null,
        address: address || undefined,
      });

      const token = generateToken({ id: user._id, role: user.role });

      return res.status(201).json({
        success: true,
        message: 'Patient registered successfully',
        token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          patientId: patient._id,
        },
      });
    } catch (patientError) {
      // Rollback User creation if Patient creation fails
      await User.findByIdAndDelete(user._id);
      throw patientError;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate user & get token (Login)
 * @route   POST /api/auth/login
 * @access  Public
 */
export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive or suspended',
      });
    }

    // Resolve profile details
    let patientId = null;
    let doctorId = null;
    let staffId = null;
    let clinicId = null;
    let fullName = null;
    let clinic = null;
    let profile = null;

    if (user.role === 'PATIENT') {
      const patient = await Patient.findOne({ userId: user._id });
      if (patient) {
        patientId = patient._id;
        fullName = patient.fullName;
        profile = patient;
      }
    } else if (user.role === 'DOCTOR') {
      const doctor = await Doctor.findOne({ userId: user._id }).populate('clinicId', 'name code address phone');
      if (doctor) {
        doctorId = doctor._id;
        clinicId = doctor.clinicId?._id || doctor.clinicId;
        clinic = doctor.clinicId?.name ? { _id: doctor.clinicId._id, name: doctor.clinicId.name, code: doctor.clinicId.code } : null;
        fullName = doctor.fullName;
        profile = doctor;
      }
    } else if (user.role === 'STAFF') {
      const staff = await Staff.findOne({ userId: user._id }).populate('clinicId', 'name code address phone');
      if (staff) {
        staffId = staff._id;
        clinicId = staff.clinicId?._id || staff.clinicId;
        clinic = staff.clinicId?.name ? { _id: staff.clinicId._id, name: staff.clinicId.name, code: staff.clinicId.code } : null;
        fullName = staff.fullName;
        profile = staff;
      }
    } else if (user.role === 'ADMIN') {
      fullName = 'System Administrator';
    }

    const token = generateToken({ id: user._id, role: user.role });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        fullName: fullName || user.email.split('@')[0],
        patientId,
        doctorId,
        staffId,
        clinicId,
        clinic,
        profile,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current logged in user details
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = async (req, res, next) => {
  try {
    const profile = req.user.patientProfile || req.user.doctorProfile || req.user.staffProfile || null;
    const fullName = profile?.fullName || (req.user.role === 'ADMIN' ? 'System Administrator' : req.user.email?.split('@')[0]);
    const clinic = profile?.clinicId?.name
      ? { _id: profile.clinicId._id, name: profile.clinicId.name, code: profile.clinicId.code }
      : null;

    return res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        email: req.user.email,
        role: req.user.role,
        fullName,
        isActive: req.user.isActive,
        patientId: req.user.patientId || null,
        doctorId: req.user.doctorId || null,
        staffId: req.user.staffId || null,
        staffClinicId: req.user.staffClinicId || null,
        clinic,
        profile,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user / clear token on client
 * @route   POST /api/auth/logout
 * @access  Private
 */
export const logoutUser = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};
