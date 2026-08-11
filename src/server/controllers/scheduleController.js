import { DoctorSchedule, Doctor } from '../models/index.js';

const VALID_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Helper to convert "HH:mm" to total minutes for comparisons
 */
const timeToMinutes = (timeStr) => {
  if (!timeStr || !TIME_REGEX.test(timeStr)) return -1;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Validate weekly schedule structure & interval bounds
 */
export const validateWeeklyHours = (weeklyHours) => {
  if (!Array.isArray(weeklyHours) || weeklyHours.length === 0) {
    return 'weeklyHours must be a non-empty array of daily schedule objects';
  }

  for (const dayObj of weeklyHours) {
    if (!dayObj.dayOfWeek || !VALID_DAYS.includes(dayObj.dayOfWeek.toUpperCase())) {
      return `Invalid or missing dayOfWeek: ${dayObj.dayOfWeek}`;
    }

    if (dayObj.isWorkingDay) {
      if (!Array.isArray(dayObj.shifts) || dayObj.shifts.length === 0) {
        return `Working day ${dayObj.dayOfWeek} must have at least one shift`;
      }

      // Sort shifts by start time
      const parsedShifts = [];
      for (const shift of dayObj.shifts) {
        const startMins = timeToMinutes(shift.startTime);
        const endMins = timeToMinutes(shift.endTime);
        if (startMins < 0 || endMins < 0) {
          return `Invalid time format in shift for ${dayObj.dayOfWeek}. Expected HH:mm (00:00-23:59)`;
        }
        if (startMins >= endMins) {
          return `Shift start time (${shift.startTime}) must be strictly earlier than end time (${shift.endTime}) on ${dayObj.dayOfWeek}`;
        }
        parsedShifts.push({ startMins, endMins, startTime: shift.startTime, endTime: shift.endTime });
      }

      parsedShifts.sort((a, b) => a.startMins - b.startMins);

      // Check shift overlap
      for (let i = 0; i < parsedShifts.length - 1; i++) {
        if (parsedShifts[i].endMins > parsedShifts[i + 1].startMins) {
          return `Overlapping shifts detected on ${dayObj.dayOfWeek}: [${parsedShifts[i].startTime}-${parsedShifts[i].endTime}] and [${parsedShifts[i + 1].startTime}-${parsedShifts[i + 1].endTime}]`;
        }
      }

      // Validate breaks
      if (Array.isArray(dayObj.breaks)) {
        const parsedBreaks = [];
        for (const b of dayObj.breaks) {
          const startMins = timeToMinutes(b.startTime);
          const endMins = timeToMinutes(b.endTime);
          if (startMins < 0 || endMins < 0) {
            return `Invalid time format in break for ${dayObj.dayOfWeek}`;
          }
          if (startMins >= endMins) {
            return `Break start time (${b.startTime}) must be strictly earlier than end time (${b.endTime}) on ${dayObj.dayOfWeek}`;
          }

          // Check if break falls inside at least one working shift
          const insideShift = parsedShifts.some((s) => startMins >= s.startMins && endMins <= s.endMins);
          if (!insideShift) {
            return `Break [${b.startTime}-${b.endTime}] on ${dayObj.dayOfWeek} must be within working shift hours`;
          }

          parsedBreaks.push({ startMins, endMins, startTime: b.startTime, endTime: b.endTime });
        }

        parsedBreaks.sort((a, b) => a.startMins - b.startMins);
        for (let i = 0; i < parsedBreaks.length - 1; i++) {
          if (parsedBreaks[i].endMins > parsedBreaks[i + 1].startMins) {
            return `Overlapping breaks detected on ${dayObj.dayOfWeek}: [${parsedBreaks[i].startTime}-${parsedBreaks[i].endTime}] and [${parsedBreaks[i + 1].startTime}-${parsedBreaks[i + 1].endTime}]`;
          }
        }
      }
    }
  }

  return null;
};

/**
 * @desc    Get doctor recurring schedule by Doctor ID
 * @route   GET /api/doctors/:id/schedule
 * @access  Public / Protected
 */
export const getDoctorSchedule = async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    let schedule = await DoctorSchedule.findOne({ doctorId: doctor._id, isActive: true });
    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Doctor schedule not configured yet',
      });
    }

    return res.status(200).json({
      success: true,
      schedule,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Doctor update own schedule (Doctor only)
 * @route   PUT /api/doctors/me/schedule
 * @access  Private (DOCTOR)
 */
export const updateScheduleSelf = async (req, res, next) => {
  try {
    if (!req.user || !req.user.doctorId) {
      return res.status(403).json({
        success: false,
        message: 'Doctor profile not found for this account',
      });
    }

    const { weeklyHours } = req.body;
    const errorMsg = validateWeeklyHours(weeklyHours);
    if (errorMsg) {
      return res.status(400).json({ success: false, message: errorMsg });
    }

    const doctor = await Doctor.findById(req.user.doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    let schedule = await DoctorSchedule.findOne({ doctorId: doctor._id, isActive: true });
    if (schedule) {
      schedule.weeklyHours = weeklyHours;
      await schedule.save();
    } else {
      schedule = await DoctorSchedule.create({
        doctorId: doctor._id,
        clinicId: doctor.clinicId,
        weeklyHours,
        isActive: true,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Schedule updated successfully',
      schedule,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Admin update doctor schedule (Admin only)
 * @route   PUT /api/admin/doctors/:id/schedule
 * @access  Private (ADMIN)
 */
export const updateScheduleAdmin = async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const { weeklyHours } = req.body;
    const errorMsg = validateWeeklyHours(weeklyHours);
    if (errorMsg) {
      return res.status(400).json({ success: false, message: errorMsg });
    }

    let schedule = await DoctorSchedule.findOne({ doctorId: doctor._id, isActive: true });
    if (schedule) {
      schedule.weeklyHours = weeklyHours;
      await schedule.save();
    } else {
      schedule = await DoctorSchedule.create({
        doctorId: doctor._id,
        clinicId: doctor.clinicId,
        weeklyHours,
        isActive: true,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Doctor schedule updated by admin successfully',
      schedule,
    });
  } catch (error) {
    next(error);
  }
};
