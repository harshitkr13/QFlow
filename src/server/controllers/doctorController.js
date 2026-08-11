import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Doctor, Clinic, Specialty, DoctorSchedule } from '../models/index.js';

/**
 * @desc    Patient Doctor Discovery with Geospatial Proximity & Filters (Stage 1)
 * @route   GET /api/doctors/discover
 * @access  Public / Protected
 */
export const discoverDoctors = async (req, res, next) => {
  try {
    const {
      specialtyId,
      latitude,
      longitude,
      radiusKm = 25,
      doctorGender,
      minRating,
      minExperience,
      maxFee,
      sort,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({ success: false, message: 'Page must be a positive integer >= 1' });
    }
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res.status(400).json({ success: false, message: 'Limit must be a positive integer between 1 and 50' });
    }

    if ((latitude !== undefined && longitude === undefined) || (latitude === undefined && longitude !== undefined)) {
      return res.status(400).json({ success: false, message: 'Both latitude and longitude must be provided together' });
    }

    if (specialtyId && !mongoose.Types.ObjectId.isValid(specialtyId)) {
      return res.status(400).json({ success: false, message: 'Invalid specialtyId format' });
    }

    if (doctorGender && !['MALE', 'FEMALE', 'OTHER'].includes(doctorGender)) {
      return res.status(400).json({ success: false, message: 'Invalid doctorGender. Allowed values: MALE, FEMALE, OTHER' });
    }

    if (minRating !== undefined) {
      const ratingVal = parseFloat(minRating);
      if (isNaN(ratingVal) || ratingVal < 0 || ratingVal > 5) {
        return res.status(400).json({ success: false, message: 'minRating must be a number between 0 and 5' });
      }
    }

    if (minExperience !== undefined) {
      const expVal = parseInt(minExperience, 10);
      if (isNaN(expVal) || expVal < 0) {
        return res.status(400).json({ success: false, message: 'minExperience cannot be negative' });
      }
    }

    if (maxFee !== undefined) {
      const feeVal = parseFloat(maxFee);
      if (isNaN(feeVal) || feeVal < 0) {
        return res.status(400).json({ success: false, message: 'maxFee cannot be negative' });
      }
    }

    if (sort && !['nearest', 'rating', 'experience'].includes(sort)) {
      return res.status(400).json({ success: false, message: 'Invalid sort parameter. Allowed: nearest, rating, experience' });
    }

    const hasCoords = latitude !== undefined && longitude !== undefined;
    let latNum, lngNum, radNum;

    if (hasCoords) {
      latNum = parseFloat(latitude);
      lngNum = parseFloat(longitude);
      radNum = parseFloat(radiusKm);

      if (isNaN(latNum) || latNum < -90 || latNum > 90) {
        return res.status(400).json({ success: false, message: 'Latitude must be a number between -90 and 90' });
      }
      if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
        return res.status(400).json({ success: false, message: 'Longitude must be a number between -180 and 180' });
      }
      if (isNaN(radNum) || radNum <= 0 || radNum > 100) {
        return res.status(400).json({ success: false, message: 'radiusKm must be a number between 0 and 100' });
      }
    }

    let pipeline = [];

    if (hasCoords) {
      pipeline.push({
        $geoNear: {
          near: { type: 'Point', coordinates: [lngNum, latNum] },
          distanceField: 'distanceMeters',
          maxDistance: radNum * 1000,
          spherical: true,
          query: { isActive: true },
        },
      });

      pipeline.push(
        {
          $lookup: {
            from: 'doctors',
            localField: '_id',
            foreignField: 'clinicId',
            as: 'doctor',
          },
        },
        { $unwind: '$doctor' },
        {
          $lookup: {
            from: 'users',
            localField: 'doctor.userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $lookup: {
            from: 'specialties',
            localField: 'doctor.specialtyId',
            foreignField: '_id',
            as: 'specialty',
          },
        },
        { $unwind: '$specialty' }
      );

      const matchStage = {
        'user.isActive': true,
        'specialty.isActive': true,
      };

      if (specialtyId) matchStage['specialty._id'] = new mongoose.Types.ObjectId(specialtyId);
      if (doctorGender) matchStage['doctor.gender'] = doctorGender;
      if (minRating !== undefined) matchStage['doctor.averageRating'] = { $gte: parseFloat(minRating) };
      if (minExperience !== undefined) matchStage['doctor.experienceYears'] = { $gte: parseInt(minExperience, 10) };
      if (maxFee !== undefined) matchStage['doctor.consultationFee'] = { $lte: parseFloat(maxFee) };

      pipeline.push({ $match: matchStage });

      const selectedSort = sort || 'nearest';
      if (selectedSort === 'nearest') {
        pipeline.push({ $sort: { distanceMeters: 1, 'doctor.averageRating': -1, 'doctor._id': 1 } });
      } else if (selectedSort === 'rating') {
        pipeline.push({ $sort: { 'doctor.averageRating': -1, 'doctor.totalReviews': -1, distanceMeters: 1, 'doctor._id': 1 } });
      } else if (selectedSort === 'experience') {
        pipeline.push({ $sort: { 'doctor.experienceYears': -1, 'doctor.averageRating': -1, 'doctor._id': 1 } });
      }
    } else {
      pipeline.push(
        {
          $lookup: {
            from: 'clinics',
            localField: 'clinicId',
            foreignField: '_id',
            as: 'clinic',
          },
        },
        { $unwind: '$clinic' },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $lookup: {
            from: 'specialties',
            localField: 'specialtyId',
            foreignField: '_id',
            as: 'specialty',
          },
        },
        { $unwind: '$specialty' }
      );

      const matchStage = {
        'user.isActive': true,
        'clinic.isActive': true,
        'specialty.isActive': true,
      };

      if (specialtyId) matchStage['specialty._id'] = new mongoose.Types.ObjectId(specialtyId);
      if (doctorGender) matchStage['gender'] = doctorGender;
      if (minRating !== undefined) matchStage['averageRating'] = { $gte: parseFloat(minRating) };
      if (minExperience !== undefined) matchStage['experienceYears'] = { $gte: parseInt(minExperience, 10) };
      if (maxFee !== undefined) matchStage['consultationFee'] = { $lte: parseFloat(maxFee) };

      pipeline.push({ $match: matchStage });

      const selectedSort = sort || 'rating';
      if (selectedSort === 'experience') {
        pipeline.push({ $sort: { experienceYears: -1, averageRating: -1, _id: 1 } });
      } else {
        pipeline.push({ $sort: { averageRating: -1, totalReviews: -1, _id: 1 } });
      }
    }

    pipeline.push({
      $facet: {
        metadata: [{ $count: 'totalCount' }],
        data: [
          { $skip: (pageNum - 1) * limitNum },
          { $limit: limitNum },
          {
            $project: {
              _id: hasCoords ? '$doctor._id' : '$_id',
              fullName: hasCoords ? '$doctor.fullName' : '$fullName',
              photoUrl: hasCoords ? '$doctor.photoUrl' : '$photoUrl',
              gender: hasCoords ? '$doctor.gender' : '$gender',
              experienceYears: hasCoords ? '$doctor.experienceYears' : '$experienceYears',
              consultationFee: hasCoords ? '$doctor.consultationFee' : '$consultationFee',
              averageRating: hasCoords ? '$doctor.averageRating' : '$averageRating',
              totalReviews: hasCoords ? '$doctor.totalReviews' : '$totalReviews',
              averageConsultationDurationMinutes: hasCoords
                ? '$doctor.averageConsultationDurationMinutes'
                : '$averageConsultationDurationMinutes',
              specialty: {
                _id: '$specialty._id',
                name: '$specialty.name',
                code: '$specialty.code',
                iconName: '$specialty.iconName',
              },
              clinic: {
                _id: hasCoords ? '$_id' : '$clinic._id',
                name: hasCoords ? '$name' : '$clinic.name',
                city: hasCoords ? '$address.city' : '$clinic.address.city',
                address: hasCoords ? '$address' : '$clinic.address',
              },
              distanceKm: hasCoords ? { $round: [{ $divide: ['$distanceMeters', 1000] }, 1] } : null,
            },
          },
        ],
      },
    });

    const aggregateResult = hasCoords ? await Clinic.aggregate(pipeline) : await Doctor.aggregate(pipeline);
    const result = aggregateResult[0];

    const totalCount = result.metadata.length > 0 ? result.metadata[0].totalCount : 0;
    const totalPages = Math.ceil(totalCount / limitNum) || 1;

    return res.status(200).json({
      success: true,
      count: result.data.length,
      totalCount,
      totalPages,
      currentPage: pageNum,
      doctors: result.data,
    });
  } catch (error) {
    next(error);
  }
};

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
 * @desc    Get single doctor profile by ID (Stage 2)
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

    const schedule = await DoctorSchedule.findOne({ doctorId: doctor._id, isActive: true });

    return res.status(200).json({
      success: true,
      doctor: {
        _id: doctor._id,
        fullName: doctor.fullName,
        gender: doctor.gender,
        qualifications: doctor.qualifications,
        experienceYears: doctor.experienceYears,
        consultationFee: doctor.consultationFee,
        averageConsultationDurationMinutes: doctor.averageConsultationDurationMinutes,
        averageRating: doctor.averageRating,
        totalReviews: doctor.totalReviews,
        photoUrl: doctor.photoUrl,
        clinic: doctor.clinicId,
        specialty: doctor.specialtyId,
        schedule: schedule ? schedule.weeklyHours : [],
      },
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
