import mongoose from 'mongoose';
import { Appointment, Doctor, Clinic, Specialty, DoctorSchedule, Patient, Staff } from '../models/index.js';

/**
 * Helper to format a Date object into YYYY-MM-DD in India Standard Time (IST, UTC+05:30)
 */
const getFormattedDateIST = (dateObj = new Date()) => {
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-CA', options); // returns YYYY-MM-DD
  return formatter.format(dateObj);
};

/**
 * Helper to format current time HH:mm in IST
 */
const getFormattedTimeIST = (dateObj = new Date()) => {
  const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false };
  const formatter = new Intl.DateTimeFormat('en-GB', options);
  return formatter.format(dateObj);
};

/**
 * Helper to convert "HH:mm" to total minutes from midnight
 */
const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Helper to convert minutes from midnight to "HH:mm"
 */
const minutesToTime = (totalMinutes) => {
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const m = (totalMinutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

/**
 * Helper to get Day of Week string (MONDAY..SUNDAY)
 */
const getDayOfWeekName = (dateStr) => {
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return days[d.getDay()];
};

/**
 * @desc    Get Doctor Availability & Available Time Slots for a Date (Stage 3)
 * @route   GET /api/doctors/:id/availability
 * @access  Public / Protected
 */
export const getDoctorAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid doctor ID format' });
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: 'Date must be provided in YYYY-MM-DD format' });
    }

    const todayIST = getFormattedDateIST();
    if (date < todayIST) {
      return res.status(400).json({ success: false, message: 'Cannot query availability for past dates' });
    }

    const doctor = await Doctor.findById(id).populate('clinicId').populate('specialtyId');
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    if (!doctor.clinicId || !doctor.clinicId.isActive) {
      return res.status(404).json({ success: false, message: 'Doctor clinic is inactive or not found' });
    }

    if (!doctor.specialtyId || !doctor.specialtyId.isActive) {
      return res.status(404).json({ success: false, message: 'Doctor specialty is inactive or not found' });
    }

    const schedule = await DoctorSchedule.findOne({
      doctorId: doctor._id,
      clinicId: doctor.clinicId._id,
      isActive: true,
    });

    const dayOfWeek = getDayOfWeekName(date);
    const dayConfig = schedule
      ? schedule.weeklyHours.find((d) => d.dayOfWeek === dayOfWeek)
      : null;

    if (!dayConfig || !dayConfig.isWorkingDay || !dayConfig.shifts || dayConfig.shifts.length === 0) {
      return res.status(200).json({
        success: true,
        doctorId: doctor._id,
        doctorName: doctor.fullName,
        clinicId: doctor.clinicId._id,
        clinicName: doctor.clinicId.name,
        date,
        dayOfWeek,
        isWorkingDay: false,
        consultationDurationMinutes: doctor.averageConsultationDurationMinutes || 15,
        workingShifts: [],
        breaks: [],
        availableSlots: [],
        totalAvailableSlots: 0,
      });
    }

    const duration = doctor.averageConsultationDurationMinutes || 15;
    const candidateSlots = [];
    const breaks = dayConfig.breaks || [];

    // Generate Candidate Slots for each shift
    for (const shift of dayConfig.shifts) {
      let currentStart = timeToMinutes(shift.startTime);
      const shiftEnd = timeToMinutes(shift.endTime);

      while (currentStart + duration <= shiftEnd) {
        const slotStartMin = currentStart;
        const slotEndMin = currentStart + duration;

        // Check break overlap
        const overlapsBreak = breaks.some((b) => {
          const bStart = timeToMinutes(b.startTime);
          const bEnd = timeToMinutes(b.endTime);
          return slotStartMin < bEnd && slotEndMin > bStart;
        });

        if (!overlapsBreak) {
          candidateSlots.push({
            startTime: minutesToTime(slotStartMin),
            endTime: minutesToTime(slotEndMin),
          });
        }
        currentStart += duration;
      }
    }

    // Filter out past slots for Today
    let filteredCandidateSlots = candidateSlots;
    if (date === todayIST) {
      const currentTimeStr = getFormattedTimeIST();
      const currentMin = timeToMinutes(currentTimeStr) + 30; // 30 min cutoff
      filteredCandidateSlots = candidateSlots.filter(
        (s) => timeToMinutes(s.startTime) > currentMin
      );
    }

    // Fetch existing active appointments
    const activeAppointments = await Appointment.find({
      doctorId: doctor._id,
      appointmentDate: date,
      status: { $in: ['BOOKED', 'CHECKED_IN'] },
    }).select('timeSlot.startTime');

    const bookedStartTimes = new Set(activeAppointments.map((a) => a.timeSlot.startTime));
    const availableSlots = filteredCandidateSlots.filter(
      (s) => !bookedStartTimes.has(s.startTime)
    );

    return res.status(200).json({
      success: true,
      doctorId: doctor._id,
      doctorName: doctor.fullName,
      clinicId: doctor.clinicId._id,
      clinicName: doctor.clinicId.name,
      date,
      dayOfWeek,
      isWorkingDay: true,
      consultationDurationMinutes: duration,
      workingShifts: dayConfig.shifts,
      breaks,
      availableSlots,
      totalAvailableSlots: availableSlots.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Book a new Appointment (Stage 3)
 * @route   POST /api/appointments
 * @access  Private (PATIENT)
 */
export const createAppointment = async (req, res, next) => {
  try {
    if (!req.user || !req.user.patientId) {
      return res.status(403).json({
        success: false,
        message: 'Only registered patients can book appointments',
      });
    }

    const { doctorId, appointmentDate, timeSlot } = req.body;

    if (!doctorId || !appointmentDate || !timeSlot || !timeSlot.startTime || !timeSlot.endTime) {
      return res.status(400).json({
        success: false,
        message: 'Please provide doctorId, appointmentDate, and timeSlot ({ startTime, endTime })',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: 'Invalid doctorId format' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
      return res.status(400).json({ success: false, message: 'appointmentDate must be in YYYY-MM-DD format' });
    }

    const todayIST = getFormattedDateIST();
    if (appointmentDate < todayIST) {
      return res.status(400).json({ success: false, message: 'Cannot book appointments for past dates' });
    }

    // Verify Patient existence & active account
    const patient = await Patient.findById(req.user.patientId).populate('userId');
    if (!patient || !patient.userId || !patient.userId.isActive) {
      return res.status(403).json({ success: false, message: 'Patient profile or user account is inactive' });
    }

    // Check Max Active Bookings limit (Max 3 BOOKED appointments)
    const activeBookingCount = await Appointment.countDocuments({
      patientId: patient._id,
      status: 'BOOKED',
    });
    if (activeBookingCount >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Maximum active appointments limit reached (3 active BOOKED appointments allowed)',
      });
    }

    // Verify Doctor existence, active account, clinic, specialty
    const doctor = await Doctor.findById(doctorId).populate('clinicId').populate('specialtyId');
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    if (!doctor.clinicId || !doctor.clinicId.isActive) {
      return res.status(400).json({ success: false, message: 'Doctor clinic is inactive' });
    }

    if (!doctor.specialtyId || !doctor.specialtyId.isActive) {
      return res.status(400).json({ success: false, message: 'Doctor specialty is inactive' });
    }

    // Verify Slot Existence in Schedule
    const schedule = await DoctorSchedule.findOne({
      doctorId: doctor._id,
      clinicId: doctor.clinicId._id,
      isActive: true,
    });

    const dayOfWeek = getDayOfWeekName(appointmentDate);
    const dayConfig = schedule ? schedule.weeklyHours.find((d) => d.dayOfWeek === dayOfWeek) : null;

    if (!dayConfig || !dayConfig.isWorkingDay || !dayConfig.shifts || dayConfig.shifts.length === 0) {
      return res.status(400).json({ success: false, message: 'Doctor is not available on selected date' });
    }

    // Create Appointment
    const newAppointment = new Appointment({
      clinicId: doctor.clinicId._id,
      doctorId: doctor._id,
      patientId: patient._id,
      specialtyId: doctor.specialtyId._id,
      appointmentDate,
      timeSlot: {
        startTime: timeSlot.startTime,
        endTime: timeSlot.endTime,
      },
      status: 'BOOKED',
    });

    await newAppointment.save();

    return res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      appointment: newAppointment,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'The selected time slot is no longer available. Please choose another slot.',
      });
    }
    next(error);
  }
};

/**
 * @desc    Get Patient's own appointments
 * @route   GET /api/appointments/me
 * @access  Private (PATIENT)
 */
export const getMyAppointments = async (req, res, next) => {
  try {
    if (!req.user || !req.user.patientId) {
      return res.status(403).json({ success: false, message: 'Patient profile not found' });
    }

    const { status, type } = req.query;
    const filter = { patientId: req.user.patientId };

    if (status) {
      filter.status = status;
    } else if (type === 'upcoming') {
      filter.status = { $in: ['BOOKED', 'CHECKED_IN'] };
    } else if (type === 'past') {
      filter.status = { $in: ['COMPLETED', 'CANCELLED', 'NO_SHOW'] };
    }

    const appointments = await Appointment.find(filter)
      .populate('clinicId', 'name address phone')
      .populate('doctorId', 'fullName photoUrl qualifications consultationFee')
      .populate('specialtyId', 'name code')
      .sort({ appointmentDate: -1, 'timeSlot.startTime': 1 });

    return res.status(200).json({
      success: true,
      count: appointments.length,
      appointments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Single Appointment Detail
 * @route   GET /api/appointments/:id
 * @access  Private (PATIENT owner, DOCTOR owner, STAFF clinic, ADMIN)
 */
export const getAppointmentById = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid appointment ID format' });
    }

    const appointment = await Appointment.findById(req.params.id)
      .populate('clinicId', 'name address phone')
      .populate('doctorId', 'fullName photoUrl qualifications consultationFee')
      .populate('patientId', 'fullName gender dateOfBirth contactNumber')
      .populate('specialtyId', 'name code');

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // Role-based Ownership Checks
    if (req.user.role === 'PATIENT') {
      if (!req.user.patientId || !appointment.patientId._id.equals(req.user.patientId)) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this appointment' });
      }
    } else if (req.user.role === 'DOCTOR') {
      if (!req.user.doctorId || !appointment.doctorId._id.equals(req.user.doctorId)) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this appointment' });
      }
    } else if (req.user.role === 'STAFF') {
      if (!req.user.staffClinicId || !appointment.clinicId._id.equals(req.user.staffClinicId)) {
        return res.status(403).json({ success: false, message: 'Not authorized to view appointments outside assigned clinic' });
      }
    }

    return res.status(200).json({
      success: true,
      appointment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Doctor's own appointments
 * @route   GET /api/doctors/me/appointments
 * @access  Private (DOCTOR)
 */
export const getDoctorAppointments = async (req, res, next) => {
  try {
    if (!req.user || !req.user.doctorId) {
      return res.status(403).json({ success: false, message: 'Doctor profile not found' });
    }

    const { date, status } = req.query;
    const filter = { doctorId: req.user.doctorId };

    if (date) filter.appointmentDate = date;
    if (status) filter.status = status;

    const appointments = await Appointment.find(filter)
      .populate('patientId', 'fullName gender dateOfBirth contactNumber')
      .populate('clinicId', 'name address')
      .sort({ appointmentDate: 1, 'timeSlot.startTime': 1 });

    return res.status(200).json({
      success: true,
      count: appointments.length,
      appointments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Staff Clinic appointments
 * @route   GET /api/staff/appointments
 * @access  Private (STAFF)
 */
export const getStaffAppointments = async (req, res, next) => {
  try {
    if (!req.user || !req.user.staffClinicId) {
      return res.status(403).json({ success: false, message: 'Staff clinic assignment not found' });
    }

    const { doctorId, date, status } = req.query;
    const filter = { clinicId: req.user.staffClinicId };

    if (doctorId) filter.doctorId = doctorId;
    if (date) filter.appointmentDate = date;
    if (status) filter.status = status;

    const appointments = await Appointment.find(filter)
      .populate('doctorId', 'fullName photoUrl')
      .populate('patientId', 'fullName gender contactNumber')
      .sort({ appointmentDate: 1, 'timeSlot.startTime': 1 });

    return res.status(200).json({
      success: true,
      count: appointments.length,
      appointments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel an Appointment
 * @route   PATCH /api/appointments/:id/cancel
 * @access  Private (PATIENT owner, DOCTOR owner, STAFF clinic, ADMIN)
 */
export const cancelAppointment = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid appointment ID format' });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: `Appointment is already in terminal state "${appointment.status}" and cannot be cancelled`,
      });
    }

    // Role Ownership & Cutoff Checks
    if (req.user.role === 'PATIENT') {
      if (!req.user.patientId || !appointment.patientId.equals(req.user.patientId)) {
        return res.status(403).json({ success: false, message: 'Not authorized to cancel this appointment' });
      }
      if (appointment.status === 'CHECKED_IN') {
        return res.status(400).json({ success: false, message: 'Checked-in appointments cannot be self-cancelled by patient' });
      }
    } else if (req.user.role === 'DOCTOR') {
      if (!req.user.doctorId || !appointment.doctorId.equals(req.user.doctorId)) {
        return res.status(403).json({ success: false, message: 'Not authorized to cancel this appointment' });
      }
    } else if (req.user.role === 'STAFF') {
      if (!req.user.staffClinicId || !appointment.clinicId.equals(req.user.staffClinicId)) {
        return res.status(403).json({ success: false, message: 'Staff cannot cancel appointments outside assigned clinic' });
      }
    }

    appointment.status = 'CANCELLED';
    appointment.cancelledAt = new Date();
    appointment.cancellationReason = req.body.cancellationReason || 'Cancelled by user';

    await appointment.save();

    return res.status(200).json({
      success: true,
      message: 'Appointment cancelled successfully',
      appointment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Staff Check-In Appointment (BOOKED -> CHECKED_IN)
 * @route   PATCH /api/appointments/:id/check-in
 * @access  Private (STAFF in same clinic, ADMIN)
 */
export const checkInAppointment = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid appointment ID format' });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (req.user.role === 'STAFF') {
      if (!req.user.staffClinicId || !appointment.clinicId.equals(req.user.staffClinicId)) {
        return res.status(403).json({
          success: false,
          message: 'Staff cannot check in appointments outside assigned clinic',
        });
      }
    }

    if (appointment.status !== 'BOOKED') {
      return res.status(400).json({
        success: false,
        message: `Only BOOKED appointments can be checked in (current status: "${appointment.status}")`,
      });
    }

    const todayIST = getFormattedDateIST();
    if (appointment.appointmentDate !== todayIST) {
      return res.status(400).json({
        success: false,
        message: `Check-in is only allowed on the scheduled date (${appointment.appointmentDate})`,
      });
    }

    appointment.status = 'CHECKED_IN';
    appointment.checkedInAt = new Date();
    await appointment.save();

    return res.status(200).json({
      success: true,
      message: 'Patient checked in successfully',
      appointment,
    });
  } catch (error) {
    next(error);
  }
};
