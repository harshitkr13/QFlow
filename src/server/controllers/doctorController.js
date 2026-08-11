import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Doctor, Clinic, Specialty } from '../models/index.js';

/**
 * @desc    Onboard new Doctor User + Profile atomically (Admin only)
 * @route   POST /api/admin/doctors
 * @access  Private (ADMIN)
 */
export const onboardDoctor = async (req, res, next) => {
  try {
    const {
      email,
      password,
      fullName,
      gender,
      qualifications,
      experienceYears,
      consultationFee,
      averageConsultationDurationMinutes,
      clinicId,
      specialtyId,
      photoUrl,
    } = req.body;

    if (!email || !password || !fullName || !gender || !qualifications || !clinicId || !specialtyId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, password, fullName, gender, qualifications, clinicId, and specialtyId',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    if (typeof experienceYears === 'number' && experienceYears < 0) {
      return res.status(400).json({
        success: false,
        message: 'Experience years cannot be negative',
      });
    }

    if (typeof consultationFee === 'number' && consultationFee < 0) {
      return res.status(400).json({
        success: false,
        message: 'Consultation fee cannot be negative',
      });
    }

    // Verify Clinic & Specialty existence
    const clinicExists = await Clinic.findById(clinicId);
    if (!clinicExists) {
      return res.status(404).json({
        success: false,
        message: `Clinic with ID "${clinicId}" not found`,
      });
    }

    const specialtyExists = await Specialty.findById(specialtyId);
    if (!specialtyExists) {
      return res.status(404).json({
        success: false,
        message: `Specialty with ID "${specialtyId}" not found`,
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email address is already registered',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Mongoose transaction session
    const session = await mongoose.startSession();
    let userRecord = null;
    let doctorRecord = null;

    try {
      session.startTransaction();

      const createdUsers = await User.create(
        [
          {
            email: normalizedEmail,
            password: hashedPassword,
            role: 'DOCTOR',
            isActive: true,
          },
        ],
        { session }
      );
      userRecord = createdUsers[0];

      const createdDoctors = await Doctor.create(
        [
          {
            userId: userRecord._id,
            clinicId,
            specialtyId,
            fullName: fullName.trim(),
            gender,
            qualifications: Array.isArray(qualifications)
              ? qualifications.map((q) => q.trim())
              : [qualifications.trim()],
            experienceYears: experienceYears || 0,
            consultationFee: consultationFee || 0,
            averageConsultationDurationMinutes: averageConsultationDurationMinutes || 15,
            operationalStatus: 'AVAILABLE',
            photoUrl: photoUrl || null,
          },
        ],
        { session }
      );
      doctorRecord = createdDoctors[0];

      await session.commitTransaction();
      session.endSession();
    } catch (transactionError) {
      await session.abortTransaction();
      session.endSession();

      // Non-replica set transaction fallback cleanup
      if (userRecord && userRecord._id) {
        await User.findByIdAndDelete(userRecord._id);
      }
      throw transactionError;
    }

    return res.status(201).json({
      success: true,
      message: 'Doctor onboarded successfully',
      doctor: doctorRecord,
      user: {
        id: userRecord._id,
        email: userRecord.email,
        role: userRecord.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get doctors list with optional clinic / specialty filters
 * @route   GET /api/doctors
 * @access  Public / Protected
 */
export const getDoctors = async (req, res, next) => {
  try {
    const { clinicId, specialtyId } = req.query;
    const filter = {};

    if (clinicId) filter.clinicId = clinicId;
    if (specialtyId) filter.specialtyId = specialtyId;

    const doctors = await Doctor.find(filter)
      .populate('clinicId', 'name address location phone queuePolicy isActive')
      .populate('specialtyId', 'name code description iconName')
      .sort({ fullName: 1 });

    return res.status(200).json({
      success: true,
      count: doctors.length,
      doctors,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single doctor profile by ID
 * @route   GET /api/doctors/:id
 * @access  Public / Protected
 */
export const getDoctorById = async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.params.id)
      .populate('clinicId', 'name address location phone queuePolicy isActive')
      .populate('specialtyId', 'name code description iconName');

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found',
      });
    }

    return res.status(200).json({
      success: true,
      doctor,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Doctor self-service profile update (Doctor only)
 *          ONLY allows bio, photoUrl, averageConsultationDurationMinutes
 * @route   PATCH /api/doctors/me
 * @access  Private (DOCTOR)
 */
export const updateDoctorSelf = async (req, res, next) => {
  try {
    if (!req.user || !req.user.doctorId) {
      return res.status(403).json({
        success: false,
        message: 'Doctor profile not found for this account',
      });
    }

    const doctor = await Doctor.findById(req.user.doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found',
      });
    }

    // Explicit Whitelist Enforcement
    const { photoUrl, averageConsultationDurationMinutes, fullName } = req.body;

    if (photoUrl !== undefined) doctor.photoUrl = photoUrl ? photoUrl.trim() : null;
    if (averageConsultationDurationMinutes !== undefined) {
      if (typeof averageConsultationDurationMinutes !== 'number' || averageConsultationDurationMinutes < 1) {
        return res.status(400).json({
          success: false,
          message: 'Average consultation duration must be a positive number',
        });
      }
      doctor.averageConsultationDurationMinutes = averageConsultationDurationMinutes;
    }
    if (fullName !== undefined) doctor.fullName = fullName.trim();

    await doctor.save();

    return res.status(200).json({
      success: true,
      message: 'Doctor profile updated successfully',
      doctor,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Admin doctor management (Qualifications, fee, clinic, specialty, active state)
 * @route   PATCH /api/admin/doctors/:id
 * @access  Private (ADMIN)
 */
export const updateDoctorAdmin = async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found',
      });
    }

    const {
      fullName,
      gender,
      qualifications,
      experienceYears,
      consultationFee,
      averageConsultationDurationMinutes,
      clinicId,
      specialtyId,
      photoUrl,
      isActive,
    } = req.body;

    if (clinicId) {
      const clinicExists = await Clinic.findById(clinicId);
      if (!clinicExists) {
        return res.status(404).json({ success: false, message: 'Clinic not found' });
      }
      doctor.clinicId = clinicId;
    }

    if (specialtyId) {
      const specialtyExists = await Specialty.findById(specialtyId);
      if (!specialtyExists) {
        return res.status(404).json({ success: false, message: 'Specialty not found' });
      }
      doctor.specialtyId = specialtyId;
    }

    if (fullName) doctor.fullName = fullName.trim();
    if (gender) doctor.gender = gender;
    if (qualifications) {
      doctor.qualifications = Array.isArray(qualifications)
        ? qualifications.map((q) => q.trim())
        : [qualifications.trim()];
    }
    if (experienceYears !== undefined) {
      if (typeof experienceYears !== 'number' || experienceYears < 0) {
        return res.status(400).json({ success: false, message: 'Experience years cannot be negative' });
      }
      doctor.experienceYears = experienceYears;
    }
    if (consultationFee !== undefined) {
      if (typeof consultationFee !== 'number' || consultationFee < 0) {
        return res.status(400).json({ success: false, message: 'Consultation fee cannot be negative' });
      }
      doctor.consultationFee = consultationFee;
    }
    if (averageConsultationDurationMinutes !== undefined) {
      doctor.averageConsultationDurationMinutes = averageConsultationDurationMinutes;
    }
    if (photoUrl !== undefined) doctor.photoUrl = photoUrl ? photoUrl.trim() : null;

    if (typeof isActive === 'boolean') {
      await User.findByIdAndUpdate(doctor.userId, { isActive });
    }

    await doctor.save();

    return res.status(200).json({
      success: true,
      message: 'Doctor updated by admin successfully',
      doctor,
    });
  } catch (error) {
    next(error);
  }
};
