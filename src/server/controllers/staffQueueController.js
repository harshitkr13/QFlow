import mongoose from 'mongoose';
import { QueueEntry } from '../models/QueueEntry.js';
import { QueueCounter } from '../models/QueueCounter.js';
import { QueueHistory } from '../models/QueueHistory.js';
import { Patient } from '../models/Patient.js';
import { Doctor } from '../models/Doctor.js';
import { Appointment } from '../models/Appointment.js';

/**
 * Helper: Format Date string to 'YYYY-MM-DD' in Asia/Kolkata (IST)
 */
const getFormattedDateIST = (dateObj = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(dateObj); // Returns 'YYYY-MM-DD'
};

/**
 * Helper: Operational Access Control for STAFF, ADMIN, and DOCTOR
 */
const verifyOperationalAccess = async (req, targetClinicId, targetDoctorId) => {
  const userId = req.user._id || req.user.id;
  if (req.user.role === 'ADMIN') {
    return { authorized: true };
  }
  if (req.user.role === 'STAFF') {
    if (!req.user.staffClinicId) {
      return { authorized: false, status: 403, message: 'Staff profile is not assigned to a clinic' };
    }
    if (targetClinicId && req.user.staffClinicId.toString() !== targetClinicId.toString()) {
      return { authorized: false, status: 403, message: 'Forbidden: Staff cannot access queue operations for another clinic' };
    }
    return { authorized: true };
  }
  if (req.user.role === 'DOCTOR') {
    const doctor = await Doctor.findOne({ userId });
    if (!doctor) {
      return { authorized: false, status: 403, message: 'Doctor profile not found' };
    }
    if (targetDoctorId && doctor._id.toString() !== targetDoctorId.toString()) {
      return { authorized: false, status: 403, message: 'Forbidden: Doctor can only manage their own operational queue' };
    }
    return { authorized: true, doctor };
  }
  return { authorized: false, status: 403, message: 'Forbidden: Unauthorized role for queue operations' };
};

/**
 * @desc    Search Patients by phone (prefix match) or fullName (partial match)
 * @route   POST /api/staff/queue/patients/search
 * @access  Private (STAFF, ADMIN, DOCTOR)
 */
export const searchPatients = async (req, res, next) => {
  try {
    const access = await verifyOperationalAccess(req);
    if (!access.authorized) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const rawQuery = req.body?.query || req.body?.phone || req.body?.name || req.query?.query || req.query?.phone || req.query?.name;
    if (!rawQuery || typeof rawQuery !== 'string' || rawQuery.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long',
      });
    }

    const cleanQuery = rawQuery.trim();
    const searchFilter = {
      $or: [
        { phone: { $regex: `^${cleanQuery}`, $options: 'i' } },
        { fullName: { $regex: cleanQuery, $options: 'i' } },
      ],
    };

    const patients = await Patient.find(searchFilter)
      .select('fullName phone gender dateOfBirth address location userId createdAt')
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
 * @access  Private (STAFF, ADMIN, DOCTOR)
 */
export const createWalkInPatient = async (req, res, next) => {
  try {
    const access = await verifyOperationalAccess(req);
    if (!access.authorized) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const { fullName, phone, gender, dateOfBirth, address } = req.body;

    if (!fullName || !phone || !gender) {
      return res.status(400).json({
        success: false,
        message: 'Full name, phone number, and gender are required for walk-in patient creation',
      });
    }

    const cleanPhone = phone.trim();
    const existingPatient = await Patient.findOne({ phone: cleanPhone });
    if (existingPatient) {
      return res.status(409).json({
        success: false,
        message: 'A patient with this phone number already exists in the system',
        patient: existingPatient,
      });
    }

    const patient = await Patient.create({
      userId: null,
      fullName: fullName.trim(),
      phone: cleanPhone,
      gender,
      dateOfBirth: dateOfBirth || null,
      address: address || null,
    });

    return res.status(201).json({
      success: true,
      message: 'Walk-in patient profile created successfully',
      patient,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A patient with this phone number already exists in the system',
      });
    }
    next(error);
  }
};

/**
 * @desc    Register Walk-In Patient into Operational Queue
 * @route   POST /api/staff/queue/walk-in
 * @access  Private (STAFF, ADMIN, DOCTOR)
 */
export const registerWalkIn = async (req, res, next) => {
  try {
    const { patientId, doctorId } = req.body;

    if (!patientId || !doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID and Doctor ID are required for walk-in registration',
      });
    }

    const doctor = await Doctor.findById(doctorId).populate('clinicId');
    if (!doctor || !doctor.clinicId) {
      return res.status(404).json({
        success: false,
        message: 'Target Doctor or Clinic not found',
      });
    }

    const access = await verifyOperationalAccess(req, doctor.clinicId._id, doctor._id);
    if (!access.authorized) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient record not found',
      });
    }

    const queueDate = getFormattedDateIST();

    const existingActive = await QueueEntry.findOne({
      doctorId: doctor._id,
      patientId: patient._id,
      queueDate,
      status: { $in: ['WAITING', 'CALLED', 'IN_CONSULTATION'] },
    });

    if (existingActive) {
      return res.status(409).json({
        success: false,
        message: 'Patient is already in the active queue for this doctor today',
        queueEntry: existingActive,
      });
    }

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

    const now = new Date();
    const formatterHour = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false });
    const formatterMin = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', minute: 'numeric' });
    const currentHour = parseInt(formatterHour.format(now), 10);
    const currentMin = parseInt(formatterMin.format(now), 10);
    const effectiveSlotMinutes = currentHour * 60 + currentMin;

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
            priority: 'NORMAL',
            priorityWeight: 1,
            effectiveSlotMinutes,
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
 * @desc    Get Today's Operational Queue for Staff/Admin/Doctor (Hybrid Ordered)
 * @route   GET /api/staff/queue/today
 * @access  Private (STAFF, ADMIN, DOCTOR)
 */
export const getTodayQueue = async (req, res, next) => {
  try {
    const access = await verifyOperationalAccess(req);
    if (!access.authorized) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    let clinicId;
    let doctorIdFilter = req.query.doctorId;

    if (req.user.role === 'STAFF') {
      if (!req.user.staffClinicId) {
        return res.status(403).json({ success: false, message: 'Staff profile is not assigned to a clinic' });
      }
      clinicId = req.user.staffClinicId;
    } else if (req.user.role === 'ADMIN') {
      clinicId = req.query.clinicId || req.user.staffClinicId;
    } else if (req.user.role === 'DOCTOR') {
      const doctor = await Doctor.findOne({ userId: req.user._id || req.user.id });
      if (!doctor) {
        return res.status(403).json({ success: false, message: 'Doctor profile not found' });
      }
      doctorIdFilter = doctor._id.toString();
      clinicId = doctor.clinicId;
    }

    const queueDate = getFormattedDateIST();
    const baseFilter = { queueDate };
    if (clinicId) baseFilter.clinicId = clinicId;
    if (doctorIdFilter) baseFilter.doctorId = doctorIdFilter;

    // Fetch WAITING entries with HYBRID sorting: priorityWeight ASC, effectiveSlotMinutes ASC, joinedAt ASC, tokenNumber ASC
    const waitingEntries = await QueueEntry.find({ ...baseFilter, status: 'WAITING' })
      .populate('patientId', 'fullName phone gender')
      .populate('doctorId', 'fullName photoUrl')
      .populate('appointmentId', 'timeSlot status')
      .sort({ priorityWeight: 1, effectiveSlotMinutes: 1, joinedAt: 1, tokenNumber: 1 });

    // Fetch active entries (CALLED, IN_CONSULTATION)
    const activeEntries = await QueueEntry.find({ ...baseFilter, status: { $in: ['CALLED', 'IN_CONSULTATION'] } })
      .populate('patientId', 'fullName phone gender')
      .populate('doctorId', 'fullName photoUrl')
      .populate('appointmentId', 'timeSlot status')
      .sort({ joinedAt: 1 });

    // Fetch SKIPPED entries
    const skippedEntries = await QueueEntry.find({ ...baseFilter, status: 'SKIPPED' })
      .populate('patientId', 'fullName phone gender')
      .populate('doctorId', 'fullName photoUrl')
      .populate('appointmentId', 'timeSlot status')
      .sort({ skippedAt: -1, tokenNumber: 1 });

    // Fetch completed/terminal entries
    const terminalEntries = await QueueEntry.find({ ...baseFilter, status: { $in: ['COMPLETED', 'NO_SHOW', 'CANCELLED'] } })
      .populate('patientId', 'fullName phone gender')
      .populate('doctorId', 'fullName photoUrl')
      .populate('appointmentId', 'timeSlot status')
      .sort({ updatedAt: -1 });

    // Combine into complete operational list
    const queueEntries = [...activeEntries, ...waitingEntries, ...skippedEntries, ...terminalEntries];

    // Fetch doctor queue pause details if doctorIdFilter provided
    let doctorQueueStatus = { isQueuePaused: false, queuePausedAt: null, queuePauseReason: null };
    if (doctorIdFilter) {
      const doc = await Doctor.findById(doctorIdFilter).select('isQueuePaused queuePausedAt queuePauseReason queuePausedDate');
      if (doc && doc.isQueuePaused && doc.queuePausedDate === queueDate) {
        doctorQueueStatus = {
          isQueuePaused: true,
          queuePausedAt: doc.queuePausedAt,
          queuePauseReason: doc.queuePauseReason,
        };
      }
    }

    return res.status(200).json({
      success: true,
      count: queueEntries.length,
      queueDate,
      doctorQueueStatus,
      queueEntries,
      waitingEntries,
      activeEntries,
      skippedEntries,
      terminalEntries,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Call Next Patient in Queue (Atomic Claim)
 * @route   POST /api/staff/queue/call-next
 * @access  Private (STAFF, ADMIN, DOCTOR)
 */
export const callNextPatient = async (req, res, next) => {
  try {
    const { doctorId } = req.body;
    if (!doctorId) {
      return res.status(400).json({ success: false, message: 'Doctor ID is required to call next patient' });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const access = await verifyOperationalAccess(req, doctor.clinicId, doctor._id);
    if (!access.authorized) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const queueDate = getFormattedDateIST();

    // Check Decision 008: Block call-next if doctor queue is paused today
    if (doctor.isQueuePaused && doctor.queuePausedDate === queueDate) {
      return res.status(400).json({
        success: false,
        message: 'Queue is currently paused for this doctor',
        reason: doctor.queuePauseReason,
      });
    }

    // Check Decision 003 Invariant: Maximum 1 CALLED or IN_CONSULTATION patient per doctor today
    const activePatient = await QueueEntry.findOne({
      doctorId: doctor._id,
      queueDate,
      status: { $in: ['CALLED', 'IN_CONSULTATION'] },
    }).populate('patientId', 'fullName');

    if (activePatient) {
      return res.status(400).json({
        success: false,
        message: `Doctor already has an active patient (${activePatient.status}): ${activePatient.patientId?.fullName || 'Patient'}`,
        activePatient: {
          _id: activePatient._id,
          tokenNumber: activePatient.tokenNumber,
          status: activePatient.status,
          patientName: activePatient.patientId?.fullName,
        },
      });
    }

    // Find top candidate in WAITING queue using HYBRID sort criteria
    const topCandidate = await QueueEntry.findOne({
      doctorId: doctor._id,
      queueDate,
      status: 'WAITING',
    }).sort({ priorityWeight: 1, effectiveSlotMinutes: 1, joinedAt: 1, tokenNumber: 1 });

    if (!topCandidate) {
      return res.status(404).json({
        success: false,
        message: 'No patients currently waiting in queue',
      });
    }

    // Atomic claim: Transition WAITING -> CALLED
    const queueEntry = await QueueEntry.findOneAndUpdate(
      { _id: topCandidate._id, status: 'WAITING' },
      { status: 'CALLED', calledAt: new Date() },
      { new: true }
    ).populate('patientId', 'fullName phone gender');

    if (!queueEntry) {
      return res.status(409).json({
        success: false,
        message: 'Patient status changed concurrently by another operator, please retry',
      });
    }

    const performedBy = req.user._id || req.user.id;
    await QueueHistory.create({
      queueEntryId: queueEntry._id,
      doctorId: doctor._id,
      clinicId: doctor.clinicId,
      action: 'CALL_NEXT',
      previousState: 'WAITING',
      newState: 'CALLED',
      performedBy,
      userRole: req.user.role,
      reason: 'Called next patient to consultation room',
      timestamp: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: 'Patient called successfully',
      queueEntry,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Start Doctor Consultation (CALLED -> IN_CONSULTATION)
 * @route   PATCH /api/staff/queue/:id/start
 * @access  Private (STAFF, ADMIN, DOCTOR)
 */
export const startConsultation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existingEntry = await QueueEntry.findById(id);
    if (!existingEntry) {
      return res.status(404).json({ success: false, message: 'Queue entry not found' });
    }

    const access = await verifyOperationalAccess(req, existingEntry.clinicId, existingEntry.doctorId);
    if (!access.authorized) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    // Decision 003 Invariant: Verify doctor has no other IN_CONSULTATION patient
    const otherInConsultation = await QueueEntry.findOne({
      doctorId: existingEntry.doctorId,
      queueDate: existingEntry.queueDate,
      _id: { $ne: existingEntry._id },
      status: 'IN_CONSULTATION',
    });

    if (otherInConsultation) {
      return res.status(400).json({
        success: false,
        message: 'Doctor is already in consultation with another patient',
      });
    }

    // Atomic transition: CALLED -> IN_CONSULTATION
    const queueEntry = await QueueEntry.findOneAndUpdate(
      { _id: existingEntry._id, status: 'CALLED' },
      { status: 'IN_CONSULTATION', consultationStartedAt: new Date() },
      { new: true }
    ).populate('patientId', 'fullName phone gender');

    if (!queueEntry) {
      return res.status(400).json({
        success: false,
        message: 'Patient must be in CALLED status to start consultation',
      });
    }

    const performedBy = req.user._id || req.user.id;
    await QueueHistory.create({
      queueEntryId: queueEntry._id,
      doctorId: queueEntry.doctorId,
      clinicId: queueEntry.clinicId,
      action: 'START_CONSULTATION',
      previousState: 'CALLED',
      newState: 'IN_CONSULTATION',
      performedBy,
      userRole: req.user.role,
      reason: 'Started clinical consultation',
      timestamp: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: 'Consultation started successfully',
      queueEntry,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Complete Consultation & Sync Appointment (IN_CONSULTATION -> COMPLETED)
 * @route   PATCH /api/staff/queue/:id/complete
 * @access  Private (STAFF, ADMIN, DOCTOR)
 */
export const completeConsultation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existingEntry = await QueueEntry.findById(id);
    if (!existingEntry) {
      return res.status(404).json({ success: false, message: 'Queue entry not found' });
    }

    const access = await verifyOperationalAccess(req, existingEntry.clinicId, existingEntry.doctorId);
    if (!access.authorized) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    if (existingEntry.status !== 'IN_CONSULTATION') {
      return res.status(400).json({
        success: false,
        message: 'Patient must be IN_CONSULTATION to complete consultation',
      });
    }

    // Session Transaction: Synchronize QueueEntry + Appointment completion
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const queueEntry = await QueueEntry.findOneAndUpdate(
        { _id: existingEntry._id, status: 'IN_CONSULTATION' },
        { status: 'COMPLETED', completedAt: new Date() },
        { session, new: true }
      ).populate('patientId', 'fullName phone gender');

      if (!queueEntry) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Patient status changed concurrently or is not IN_CONSULTATION',
        });
      }

      if (queueEntry.appointmentId) {
        await Appointment.updateOne(
          { _id: queueEntry.appointmentId },
          { status: 'COMPLETED' },
          { session }
        );
      }

      const performedBy = req.user._id || req.user.id;
      await QueueHistory.create(
        [
          {
            queueEntryId: queueEntry._id,
            doctorId: queueEntry.doctorId,
            clinicId: queueEntry.clinicId,
            action: 'COMPLETE',
            previousState: 'IN_CONSULTATION',
            newState: 'COMPLETED',
            performedBy,
            userRole: req.user.role,
            reason: 'Completed consultation successfully',
            timestamp: new Date(),
          },
        ],
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: 'Consultation completed successfully',
        queueEntry,
      });
    } catch (txError) {
      await session.abortTransaction();
      session.endSession();
      throw txError;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Skip Patient (CALLED or WAITING with reason -> SKIPPED)
 * @route   PATCH /api/staff/queue/:id/skip
 * @access  Private (STAFF, ADMIN, DOCTOR)
 */
export const skipPatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const existingEntry = await QueueEntry.findById(id);
    if (!existingEntry) {
      return res.status(404).json({ success: false, message: 'Queue entry not found' });
    }

    const access = await verifyOperationalAccess(req, existingEntry.clinicId, existingEntry.doctorId);
    if (!access.authorized) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    if (!['CALLED', 'WAITING'].includes(existingEntry.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot skip patient currently in ${existingEntry.status} state`,
      });
    }

    // Decision 005 Policy: Skipping WAITING patient requires an explicit reason
    if (existingEntry.status === 'WAITING' && (!reason || reason.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'An explicit operational reason is required to skip a WAITING patient',
      });
    }

    const previousState = existingEntry.status;
    const queueEntry = await QueueEntry.findOneAndUpdate(
      { _id: existingEntry._id, status: { $in: ['CALLED', 'WAITING'] } },
      { status: 'SKIPPED', skippedAt: new Date() },
      { new: true }
    ).populate('patientId', 'fullName phone gender');

    if (!queueEntry) {
      return res.status(400).json({
        success: false,
        message: 'Patient status changed concurrently',
      });
    }

    const performedBy = req.user._id || req.user.id;
    await QueueHistory.create({
      queueEntryId: queueEntry._id,
      doctorId: queueEntry.doctorId,
      clinicId: queueEntry.clinicId,
      action: 'SKIP',
      previousState,
      newState: 'SKIPPED',
      performedBy,
      userRole: req.user.role,
      reason: reason || 'Patient skipped during queue execution',
      timestamp: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: 'Patient skipped successfully',
      queueEntry,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark Patient No-Show & Sync Appointment (CALLED or WAITING -> NO_SHOW)
 * @route   PATCH /api/staff/queue/:id/no-show
 * @access  Private (STAFF, ADMIN, DOCTOR)
 */
export const markNoShow = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const existingEntry = await QueueEntry.findById(id).populate('appointmentId');
    if (!existingEntry) {
      return res.status(404).json({ success: false, message: 'Queue entry not found' });
    }

    const access = await verifyOperationalAccess(req, existingEntry.clinicId, existingEntry.doctorId);
    if (!access.authorized) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    if (!['CALLED', 'WAITING'].includes(existingEntry.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot mark no-show for patient in ${existingEntry.status} state`,
      });
    }

    // Decision 006 Policy: Marking WAITING online appointment as NO_SHOW requires slot expiration check or explicit reason
    if (existingEntry.status === 'WAITING' && existingEntry.appointmentId) {
      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'An explicit reason is required to mark a WAITING appointment as NO_SHOW',
        });
      }
    }

    const previousState = existingEntry.status;

    // Session Transaction: Synchronize QueueEntry + Appointment NO_SHOW
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const queueEntry = await QueueEntry.findOneAndUpdate(
        { _id: existingEntry._id, status: { $in: ['CALLED', 'WAITING'] } },
        { status: 'NO_SHOW' },
        { session, new: true }
      ).populate('patientId', 'fullName phone gender');

      if (!queueEntry) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Patient status changed concurrently',
        });
      }

      if (queueEntry.appointmentId) {
        await Appointment.updateOne(
          { _id: queueEntry.appointmentId },
          { status: 'NO_SHOW' },
          { session }
        );
      }

      const performedBy = req.user._id || req.user.id;
      await QueueHistory.create(
        [
          {
            queueEntryId: queueEntry._id,
            doctorId: queueEntry.doctorId,
            clinicId: queueEntry.clinicId,
            action: 'NO_SHOW',
            previousState,
            newState: 'NO_SHOW',
            performedBy,
            userRole: req.user.role,
            reason: reason || 'Patient marked no-show',
            timestamp: new Date(),
          },
        ],
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: 'Patient marked as no-show successfully',
        queueEntry,
      });
    } catch (txError) {
      await session.abortTransaction();
      session.endSession();
      throw txError;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Rejoin Skipped Patient to WAITING Queue (Allocate New Token per Decision 002)
 * @route   POST /api/staff/queue/:id/rejoin
 * @access  Private (STAFF, ADMIN, DOCTOR)
 */
export const rejoinPatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existingEntry = await QueueEntry.findById(id);
    if (!existingEntry) {
      return res.status(404).json({ success: false, message: 'Queue entry not found' });
    }

    const access = await verifyOperationalAccess(req, existingEntry.clinicId, existingEntry.doctorId);
    if (!access.authorized) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    if (existingEntry.status !== 'SKIPPED') {
      return res.status(400).json({
        success: false,
        message: `Only SKIPPED patients can rejoin the queue. Current status: ${existingEntry.status}`,
      });
    }

    if (existingEntry.rejoinCount >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Maximum rejoin limit (3) exceeded for this patient',
      });
    }

    const queueDate = getFormattedDateIST();

    // Decision 002 Policy: Allocate NEW token number via QueueCounter.$inc for rejoin
    const counter = await QueueCounter.findOneAndUpdate(
      {
        clinicId: existingEntry.clinicId,
        doctorId: existingEntry.doctorId,
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

    const newTokenNumber = counter.lastTokenNumber;

    const now = new Date();
    const formatterHour = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false });
    const formatterMin = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', minute: 'numeric' });
    const currentHour = parseInt(formatterHour.format(now), 10);
    const currentMin = parseInt(formatterMin.format(now), 10);
    const effectiveSlotMinutes = currentHour * 60 + currentMin;

    // Atomic state update: SKIPPED -> WAITING
    const queueEntry = await QueueEntry.findOneAndUpdate(
      { _id: existingEntry._id, status: 'SKIPPED' },
      {
        status: 'WAITING',
        tokenNumber: newTokenNumber,
        effectiveSlotMinutes,
        rejoinedAt: new Date(),
        $inc: { rejoinCount: 1 },
      },
      { new: true }
    ).populate('patientId', 'fullName phone gender');

    if (!queueEntry) {
      return res.status(400).json({
        success: false,
        message: 'Patient status changed concurrently',
      });
    }

    const performedBy = req.user._id || req.user.id;
    await QueueHistory.create({
      queueEntryId: queueEntry._id,
      doctorId: queueEntry.doctorId,
      clinicId: queueEntry.clinicId,
      action: 'REJOIN',
      previousState: 'SKIPPED',
      newState: 'WAITING',
      performedBy,
      userRole: req.user.role,
      reason: `Rejoined skipped patient with new Token #${newTokenNumber}`,
      timestamp: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: `Patient rejoined queue successfully with Token #${newTokenNumber}`,
      queueEntry,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Pause Doctor Queue (Date-Scoped per Decision 008)
 * @route   PATCH /api/staff/queue/pause
 * @access  Private (STAFF, ADMIN, DOCTOR)
 */
export const pauseQueue = async (req, res, next) => {
  try {
    const { doctorId, reason } = req.body;
    if (!doctorId) {
      return res.status(400).json({ success: false, message: 'Doctor ID is required to pause queue' });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const access = await verifyOperationalAccess(req, doctor.clinicId, doctor._id);
    if (!access.authorized) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const queueDate = getFormattedDateIST();

    doctor.isQueuePaused = true;
    doctor.queuePausedAt = new Date();
    doctor.queuePauseReason = reason || 'Queue paused by staff';
    doctor.queuePausedDate = queueDate;
    await doctor.save();

    const performedBy = req.user._id || req.user.id;
    await QueueHistory.create({
      queueEntryId: null,
      doctorId: doctor._id,
      clinicId: doctor.clinicId,
      action: 'PAUSE_QUEUE',
      previousState: 'ACTIVE',
      newState: 'PAUSED',
      performedBy,
      userRole: req.user.role,
      reason: reason || 'Doctor queue paused',
      timestamp: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: 'Doctor queue paused successfully',
      isQueuePaused: true,
      queuePausedAt: doctor.queuePausedAt,
      queuePauseReason: doctor.queuePauseReason,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resume Doctor Queue (Date-Scoped per Decision 008)
 * @route   PATCH /api/staff/queue/resume
 * @access  Private (STAFF, ADMIN, DOCTOR)
 */
export const resumeQueue = async (req, res, next) => {
  try {
    const { doctorId } = req.body;
    if (!doctorId) {
      return res.status(400).json({ success: false, message: 'Doctor ID is required to resume queue' });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const access = await verifyOperationalAccess(req, doctor.clinicId, doctor._id);
    if (!access.authorized) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const queueDate = getFormattedDateIST();

    doctor.isQueuePaused = false;
    doctor.queuePausedAt = null;
    doctor.queuePauseReason = null;
    doctor.queuePausedDate = queueDate;
    await doctor.save();

    const performedBy = req.user._id || req.user.id;
    await QueueHistory.create({
      queueEntryId: null,
      doctorId: doctor._id,
      clinicId: doctor.clinicId,
      action: 'RESUME_QUEUE',
      previousState: 'PAUSED',
      newState: 'ACTIVE',
      performedBy,
      userRole: req.user.role,
      reason: 'Doctor queue resumed',
      timestamp: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: 'Doctor queue resumed successfully',
      isQueuePaused: false,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel Queue Entry & Sync Appointment (WAITING/CALLED -> CANCELLED)
 * @route   PATCH /api/staff/queue/:id/cancel
 * @access  Private (STAFF, ADMIN, DOCTOR)
 */
export const cancelQueueEntry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const existingEntry = await QueueEntry.findById(id);
    if (!existingEntry) {
      return res.status(404).json({ success: false, message: 'Queue entry not found' });
    }

    const access = await verifyOperationalAccess(req, existingEntry.clinicId, existingEntry.doctorId);
    if (!access.authorized) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    if (!['WAITING', 'CALLED'].includes(existingEntry.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel queue entry in ${existingEntry.status} state`,
      });
    }

    const previousState = existingEntry.status;

    // Session Transaction: Synchronize QueueEntry + Appointment cancellation
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const queueEntry = await QueueEntry.findOneAndUpdate(
        { _id: existingEntry._id, status: { $in: ['WAITING', 'CALLED'] } },
        { status: 'CANCELLED' },
        { session, new: true }
      ).populate('patientId', 'fullName phone gender');

      if (!queueEntry) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Patient status changed concurrently',
        });
      }

      if (queueEntry.appointmentId) {
        await Appointment.updateOne(
          { _id: queueEntry.appointmentId },
          { status: 'CANCELLED', cancellationReason: reason || 'Cancelled by staff queue management' },
          { session }
        );
      }

      const performedBy = req.user._id || req.user.id;
      await QueueHistory.create(
        [
          {
            queueEntryId: queueEntry._id,
            doctorId: queueEntry.doctorId,
            clinicId: queueEntry.clinicId,
            action: 'CANCEL',
            previousState,
            newState: 'CANCELLED',
            performedBy,
            userRole: req.user.role,
            reason: reason || 'Queue entry cancelled by staff',
            timestamp: new Date(),
          },
        ],
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: 'Queue entry cancelled successfully',
        queueEntry,
      });
    } catch (txError) {
      await session.abortTransaction();
      session.endSession();
      throw txError;
    }
  } catch (error) {
    next(error);
  }
};
