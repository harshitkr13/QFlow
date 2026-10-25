import mongoose from 'mongoose';
import { Clinic, Doctor, QueueEntry } from '../models/index.js';

const getFormattedDateIST = (dateObj = new Date()) => {
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  return new Intl.DateTimeFormat('en-CA', options).format(dateObj);
};

/**
 * @desc    Get Public Queue Display (Anonymous, Privacy-Preserved for TV Monitors)
 * @route   GET /api/public/queue/display
 * @access  Public
 */
export const getPublicQueueDisplay = async (req, res, next) => {
  try {
    const rawClinicId = req.query.clinicId;
    const rawDoctorId = req.query.doctorId;

    const clinicId = typeof rawClinicId === 'string' ? rawClinicId.trim() : rawClinicId;
    const doctorId = typeof rawDoctorId === 'string' ? rawDoctorId.trim() : rawDoctorId;

    if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ success: false, message: 'Valid clinicId query parameter is required' });
    }

    const clinic = await Clinic.findOne({ _id: clinicId, isActive: true });
    if (!clinic) {
      return res.status(404).json({ success: false, message: 'Clinic not found or inactive' });
    }

    let doctor = null;
    if (doctorId && doctorId !== 'null' && doctorId !== 'undefined') {
      if (!mongoose.Types.ObjectId.isValid(doctorId)) {
        return res.status(400).json({ success: false, message: 'Invalid doctorId format' });
      }
      doctor = await Doctor.findOne({ _id: doctorId, clinicId: clinic._id });
      if (!doctor) {
        return res.status(404).json({ success: false, message: 'Doctor not found or does not belong to this clinic' });
      }
    } else {
      doctor = (await Doctor.findOne({ clinicId: clinic._id, isActive: true })) || (await Doctor.findOne({ clinicId: clinic._id }));
    }

    const todayIST = getFormattedDateIST();

    const isQueuePaused = Boolean(doctor && doctor.isQueuePaused && doctor.queuePausedDate === todayIST);
    const queuePauseReason = isQueuePaused ? (doctor.queuePauseReason || 'Doctor queue paused') : null;

    // Serving patient token filter
    const activeServingFilter = {
      clinicId: clinic._id,
      queueDate: todayIST,
      status: { $in: ['CALLED', 'IN_CONSULTATION'] },
    };
    if (doctorId && doctorId !== 'null' && doctorId !== 'undefined' && doctor) {
      activeServingFilter.doctorId = doctor._id;
    }

    let currentServingToken = null;
    let servingState = 'IDLE';

    const activeServingEntry = await QueueEntry.findOne(activeServingFilter)
      .sort({ status: -1, updatedAt: -1 }); // IN_CONSULTATION before CALLED

    if (activeServingEntry) {
      currentServingToken = activeServingEntry.tokenNumber;
      servingState = activeServingEntry.status;
    }

    // Called token
    let calledToken = null;
    if (servingState === 'CALLED' && activeServingEntry) {
      calledToken = activeServingEntry.tokenNumber;
    }

    // Waiting queue tokens filter
    const waitingFilter = {
      clinicId: clinic._id,
      queueDate: todayIST,
      status: 'WAITING',
    };
    if (doctorId && doctorId !== 'null' && doctorId !== 'undefined' && doctor) {
      waitingFilter.doctorId = doctor._id;
    }

    const waitingEntries = await QueueEntry.find(waitingFilter)
      .sort({
        priorityWeight: 1,
        effectiveSlotMinutes: 1,
        joinedAt: 1,
        tokenNumber: 1,
      })
      .select('tokenNumber priority source');

    const nextWaitingTokens = waitingEntries.slice(0, 10).map((e) => e.tokenNumber);
    const totalWaitingCount = waitingEntries.length;

    return res.status(200).json({
      success: true,
      clinicName: clinic.name,
      currentServingToken,
      servingState,
      calledToken,
      totalWaiting: totalWaitingCount,
      totalWaitingCount,
      nextWaitingTokens,
      nextTokens: nextWaitingTokens,
      doctor: doctor
        ? {
            _id: doctor._id,
            fullName: doctor.fullName,
            operationalStatus: doctor.operationalStatus,
            isQueuePaused,
            queuePauseReason,
          }
        : null,
      display: {
        currentServingToken,
        servingState,
        calledToken,
        nextWaitingTokens,
        totalWaitingCount,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};
