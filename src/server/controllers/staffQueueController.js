import mongoose from 'mongoose';
import { Patient, Doctor, Clinic, QueueEntry, QueueCounter, QueueHistory, Staff } from '../models/index.js';

/**
 * Helper to format date string YYYY-MM-DD in Asia/Kolkata timezone
 */
const getFormattedDateIST = (dateObj = new Date()) => {
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  return new Intl.DateTimeFormat('en-CA', options).format(dateObj);
};

/**
 * @desc    Search existing Patients by phone or name
 * @route   POST /api/staff/queue/patients/search
 * @access  Private (STAFF, ADMIN)
 */
export const searchPatients = async (req, res, next) => {
  try {
    const { phone, name } = req.body;
    const filter = {};

    if (phone && phone.trim().length >= 3) {
      filter.phone = new RegExp(`^${phone.trim()}`);
    } else if (name && name.trim().length >= 2) {
      filter.fullName = new RegExp(name.trim(), 'i');
    } else {
      return res.status(400).json({
        success: false,
        message: 'Please provide phone (at least 3 digits) or name (at least 2 letters) to search',
      });
    }

    const patients = await Patient.find(filter)
      .select('_id fullName phone gender dateOfBirth')
      .limit(20);

    return res.status(200).json({
      success: true,
      count: patients.length,
      patients,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create Walk-In Patient Profile (userId = null)
 * @route   POST /api/staff/queue/patients
 * @access  Private (STAFF, ADMIN)
 */
export const createWalkInPatient = async (req, res, next) => {
  try {
    const { fullName, phone, gender, dateOfBirth, address } = req.body;

    if (!fullName || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Please provide fullName and phone number',
      });
    }

    const newPatient = new Patient({
      userId: null, // Decoupled authentication profile
      fullName,
      phone,
      gender: gender || 'PREFER_NOT_TO_SAY',
      dateOfBirth: dateOfBirth || null,
      address: address || {},
    });

    await newPatient.save();

    return res.status(201).json({
      success: true,
      message: 'Walk-in patient profile created successfully',
      patient: {
        _id: newPatient._id,
        fullName: newPatient.fullName,
        phone: newPatient.phone,
        gender: newPatient.gender,
        dateOfBirth: newPatient.dateOfBirth,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A patient profile with this phone number already exists',
      });
    }
    next(error);
  }
};

/**
 * @desc    Register Walk-In Queue Entry & Allocate Token Atomically
 * @route   POST /api/staff/queue/walk-in
 * @access  Private (STAFF, ADMIN)
 */
export const registerWalkIn = async (req, res, next) => {
  try {
    const { doctorId, patientId, clinicId: bodyClinicId, priority } = req.body;

    if (!doctorId || !patientId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide doctorId and patientId',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(doctorId) || !mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ success: false, message: 'Invalid doctorId or patientId format' });
    }

    // Resolve Clinic Scope
    let clinicId;
    if (req.user.role === 'STAFF') {
      if (!req.user.staffClinicId) {
        return res.status(403).json({ success: false, message: 'Staff profile is not assigned to a clinic' });
      }
      clinicId = req.user.staffClinicId;
    } else if (req.user.role === 'ADMIN') {
      clinicId = bodyClinicId || req.user.staffClinicId;
      if (!clinicId) {
        return res.status(400).json({ success: false, message: 'Admin must specify clinicId for walk-in registration' });
      }
    } else {
      return res.status(403).json({ success: false, message: 'Only staff and admin can register walk-ins' });
    }

    // Validate Doctor and Clinic Assignment
    const doctor = await Doctor.findById(doctorId).populate('clinicId');
    if (!doctor || !doctor.clinicId || !doctor.clinicId.isActive) {
      return res.status(404).json({ success: false, message: 'Doctor or associated clinic not found or inactive' });
    }

    if (!doctor.clinicId._id.equals(clinicId)) {
      return res.status(403).json({ success: false, message: 'Doctor is not assigned to the specified clinic' });
    }

    // Validate Patient existence
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const queueDate = getFormattedDateIST();

    // Check duplicate active queue entry
    const existingActive = await QueueEntry.findOne({
      doctorId: doctor._id,
      patientId: patient._id,
      queueDate,
      status: { $in: ['WAITING', 'CALLED', 'IN_CONSULTATION'] },
    });
    if (existingActive) {
      return res.status(409).json({
        success: false,
        message: 'Patient already has an active queue entry for this doctor today',
      });
    }

    // DECISION 002: Atomic QueueCounter Token Allocation (Outside Transaction)
    const counter = await QueueCounter.findOneAndUpdate(
      {
        clinicId: doctor.clinicId._id,
        doctorId: doctor._id,
        date: queueDate,
      },
      {
        $inc: { lastTokenNumber: 1 },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    const tokenNumber = counter.lastTokenNumber;

    // Start Session Transaction for QueueEntry + QueueHistory
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const [queueEntry] = await QueueEntry.create(
        [
          {
            clinicId: doctor.clinicId._id,
            doctorId: doctor._id,
            patientId: patient._id,
            appointmentId: null,
            queueDate,
            tokenNumber,
            source: 'WALK_IN',
            priority: priority === 'URGENT' ? 'URGENT' : 'NORMAL',
            status: 'WAITING',
            joinedAt: new Date(),
          },
        ],
        { session }
      );

      const performedBy = req.user._id || req.user.id;
      await QueueHistory.create(
        [
          {
            queueEntryId: queueEntry._id,
            doctorId: doctor._id,
            clinicId: doctor.clinicId._id,
            action: 'CHECK_IN',
            previousState: null,
            newState: 'WAITING',
            performedBy,
            userRole: req.user.role,
            reason: 'Walk-in registration at reception',
            timestamp: new Date(),
          },
        ],
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      return res.status(201).json({
        success: true,
        message: 'Walk-in registered successfully',
        queueEntry: {
          _id: queueEntry._id,
          tokenNumber: queueEntry.tokenNumber,
          queueDate: queueEntry.queueDate,
          source: queueEntry.source,
          status: queueEntry.status,
          joinedAt: queueEntry.joinedAt,
          doctorName: doctor.fullName,
          patientName: patient.fullName,
        },
      });
    } catch (txError) {
      await session.abortTransaction();
      session.endSession();

      if (txError.code === 11000 || txError.code === 112 || (txError.errorLabelSet && txError.errorLabelSet.has('TransientTransactionError'))) {
        return res.status(409).json({
          success: false,
          message: 'Patient already has an active queue entry or token conflict',
        });
      }
      throw txError;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Today's Operational Queue for Staff/Admin Clinic
 * @route   GET /api/staff/queue/today
 * @access  Private (STAFF, ADMIN)
 */
export const getTodayQueue = async (req, res, next) => {
  try {
    let clinicId;
    if (req.user.role === 'STAFF') {
      if (!req.user.staffClinicId) {
        return res.status(403).json({ success: false, message: 'Staff profile is not assigned to a clinic' });
      }
      clinicId = req.user.staffClinicId;
    } else if (req.user.role === 'ADMIN') {
      clinicId = req.query.clinicId || req.user.staffClinicId;
    }

    const queueDate = getFormattedDateIST();
    const filter = { queueDate };
    if (clinicId) filter.clinicId = clinicId;
    if (req.query.doctorId) filter.doctorId = req.query.doctorId;

    const queueEntries = await QueueEntry.find(filter)
      .populate('patientId', 'fullName phone gender')
      .populate('doctorId', 'fullName photoUrl')
      .sort({ tokenNumber: 1 });

    return res.status(200).json({
      success: true,
      count: queueEntries.length,
      queueDate,
      queueEntries,
    });
  } catch (error) {
    next(error);
  }
};
