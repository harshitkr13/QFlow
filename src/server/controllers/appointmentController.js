import mongoose from 'mongoose';
import { Appointment, Doctor, DoctorSchedule, Patient, QueueCounter, QueueEntry, QueueHistory } from '../models/index.js';

/**
 * Helper to format date YYYY-MM-DD in Asia/Kolkata timezone
 */
const getFormattedDateIST = (dateObj = new Date()) => {
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  return new Intl.DateTimeFormat('en-CA', options).format(dateObj);
};

/**
 * Helper to format time HH:mm in Asia/Kolkata timezone
 */
const getFormattedTimeIST = (dateObj = new Date()) => {
  const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false };
  return new Intl.DateTimeFormat('en-GB', options).format(dateObj);
};

/**
 * Helper to convert time string HH:mm to minutes from midnight
 */
const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Helper to convert minutes from midnight to time string HH:mm
 */
const minutesToTime = (totalMinutes) => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/**
 * Helper to check if time is within a shift range and NOT in any break interval
 */
const isTimeInShiftAndNotBreak = (timeMin, duration, shift, breaks) => {
  const slotEndMin = timeMin + duration;
  const shiftStart = timeToMinutes(shift.startTime);
  const shiftEnd = timeToMinutes(shift.endTime);

  if (timeMin < shiftStart || slotEndMin > shiftEnd) {
    return false;
  }

  for (const brk of breaks) {
    const breakStart = timeToMinutes(brk.startTime);
    const breakEnd = timeToMinutes(brk.endTime);
    // If slot overlaps with break interval
    if (timeMin < breakEnd && slotEndMin > breakStart) {
      return false;
    }
  }

  return true;
};

/**
 * @desc    Get Available Booking Slots for a Doctor on a Specific Date
 * @route   GET /api/doctors/:id/availability
 * @access  Public (Guest, Patient, Staff, Doctor, Admin)
 */
export const getDoctorAvailability = async (req, res, next) => {
  try {
    const doctorId = req.params.id;
    const { date } = req.query;

    if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: 'Invalid Doctor ID format' });
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: 'Date query parameter is required in YYYY-MM-DD format' });
    }

    // Reject past dates in Asia/Kolkata
    const todayIST = getFormattedDateIST();
    if (date < todayIST) {
      return res.status(400).json({ success: false, message: 'Availability query for past dates is not permitted' });
    }

    // Verify Doctor & Clinic Active Status
    const doctor = await Doctor.findById(doctorId).populate('clinicId');
    if (!doctor || !doctor.clinicId || !doctor.clinicId.isActive) {
      return res.status(404).json({ success: false, message: 'Doctor or associated clinic not found or inactive' });
    }

    // Get Doctor Schedule
    const schedule = await DoctorSchedule.findOne({ doctorId: doctor._id, isActive: true });
    if (!schedule || !schedule.weeklyHours || schedule.weeklyHours.length === 0) {
      return res.status(200).json({
        success: true,
        doctorId: doctor._id,
        date,
        availableSlots: [],
        message: 'Doctor schedule is not configured',
      });
    }

    // Determine Day of Week (in Asia/Kolkata)
    const targetDateObj = new Date(`${date}T00:00:00+05:30`);
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const dayOfWeek = dayNames[targetDateObj.getUTCDay()];

    const daySchedule = schedule.weeklyHours.find((h) => h.dayOfWeek === dayOfWeek);
    if (!daySchedule || !daySchedule.isWorkingDay || !daySchedule.shifts || daySchedule.shifts.length === 0) {
      return res.status(200).json({
        success: true,
        doctorId: doctor._id,
        date,
        dayOfWeek,
        availableSlots: [],
        message: 'Doctor does not work on this day',
      });
    }

    const duration = doctor.averageConsultationDurationMinutes || 15;
    const allGeneratedSlots = [];

    // Generate slots for each working shift
    for (const shift of daySchedule.shifts) {
      const shiftStartMin = timeToMinutes(shift.startTime);
      const shiftEndMin = timeToMinutes(shift.endTime);

      for (let timeMin = shiftStartMin; timeMin + duration <= shiftEndMin; timeMin += duration) {
        if (isTimeInShiftAndNotBreak(timeMin, duration, shift, daySchedule.breaks || [])) {
          const startTime = minutesToTime(timeMin);
          const endTime = minutesToTime(timeMin + duration);
          allGeneratedSlots.push({ startTime, endTime });
        }
      }
    }

    // Fetch existing active appointments for doctor on date (status: BOOKED or CHECKED_IN)
    const existingAppointments = await Appointment.find({
      doctorId: doctor._id,
      appointmentDate: date,
      status: { $in: ['BOOKED', 'CHECKED_IN'] },
    }).select('timeSlot.startTime timeSlot.endTime');

    const bookedStartTimes = new Set(existingAppointments.map((a) => a.timeSlot.startTime));

    // Filter out already booked slots
    let availableSlots = allGeneratedSlots.filter((slot) => !bookedStartTimes.has(slot.startTime));

    // If date is today, filter out past time slots in Asia/Kolkata
    if (date === todayIST) {
      const currentTimeIST = getFormattedTimeIST();
      const currentMin = timeToMinutes(currentTimeIST);
      availableSlots = availableSlots.filter((slot) => timeToMinutes(slot.startTime) > currentMin);
    }

    return res.status(200).json({
      success: true,
      doctorId: doctor._id,
      doctorName: doctor.fullName,
      date,
      dayOfWeek,
      slotDurationMinutes: duration,
      availableSlotsCount: availableSlots.length,
      availableSlots,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create / Book an Appointment
 * @route   POST /api/appointments
 * @access  Private (PATIENT)
 */
export const createAppointment = async (req, res, next) => {
  try {
    const { doctorId, appointmentDate, timeSlot } = req.body;

    if (!doctorId || !appointmentDate || !timeSlot || !timeSlot.startTime || !timeSlot.endTime) {
      return res.status(400).json({
        success: false,
        message: 'Please provide doctorId, appointmentDate, and timeSlot ({ startTime, endTime })',
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
      return res.status(400).json({ success: false, message: 'appointmentDate must be in YYYY-MM-DD format' });
    }

    const todayIST = getFormattedDateIST();
    if (appointmentDate < todayIST) {
      return res.status(400).json({ success: false, message: 'Booking appointments for past dates is not permitted' });
    }

    // Verify Patient profile exists for user
    let patient = await Patient.findOne({ userId: req.user._id });
    if (!patient) {
      patient = await Patient.findOne({ _id: req.user.patientId });
    }
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found for user account' });
    }

    // Verify Doctor & Clinic Active Status
    const doctor = await Doctor.findById(doctorId).populate('clinicId');
    if (!doctor || !doctor.clinicId || !doctor.clinicId.isActive) {
      return res.status(404).json({ success: false, message: 'Doctor or associated clinic not found or inactive' });
    }

    // Create Appointment with status BOOKED
    const appointment = new Appointment({
      clinicId: doctor.clinicId._id,
      doctorId: doctor._id,
      patientId: patient._id,
      specialtyId: doctor.specialtyId,
      appointmentDate,
      timeSlot,
      status: 'BOOKED',
    });

    await appointment.save();

    return res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      appointment: {
        _id: appointment._id,
        appointmentDate: appointment.appointmentDate,
        timeSlot: appointment.timeSlot,
        status: appointment.status,
        doctorId: doctor._id,
        doctorName: doctor.fullName,
        clinicName: doctor.clinicId.name,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This doctor slot is already booked for the selected date and time',
      });
    }
    next(error);
  }
};

/**
 * @desc    Get Current Patient's Appointments
 * @route   GET /api/appointments/me
 * @access  Private (PATIENT)
 */
export const getMyAppointments = async (req, res, next) => {
  try {
    let patient = await Patient.findOne({ userId: req.user._id });
    if (!patient) {
      patient = await Patient.findOne({ _id: req.user.patientId });
    }
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const { status, date } = req.query;
    const filter = { patientId: patient._id };

    if (status) filter.status = status;
    if (date) filter.appointmentDate = date;

    const appointments = await Appointment.find(filter)
      .populate('doctorId', 'fullName photoUrl consultationFee')
      .populate('clinicId', 'name address phone')
      .populate('specialtyId', 'name')
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
 * @desc    Get Appointment by ID (Owner, Doctor, Staff, Admin)
 * @route   GET /api/appointments/:id
 * @access  Private (PATIENT, DOCTOR, STAFF, ADMIN)
 */
export const getAppointmentById = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patientId', 'fullName phone gender')
      .populate('doctorId', 'fullName photoUrl consultationFee')
      .populate('clinicId', 'name address phone')
      .populate('specialtyId', 'name');

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // Role-based Access Enforcement
    if (req.user.role === 'PATIENT') {
      const patient = await Patient.findOne({ userId: req.user._id });
      if (!patient || !appointment.patientId._id.equals(patient._id)) {
        return res.status(403).json({ success: false, message: 'Unauthorized to view this appointment' });
      }
    } else if (req.user.role === 'DOCTOR') {
      const doctor = await Doctor.findOne({ userId: req.user._id });
      if (!doctor || !appointment.doctorId._id.equals(doctor._id)) {
        return res.status(403).json({ success: false, message: 'Unauthorized to view this appointment' });
      }
    } else if (req.user.role === 'STAFF') {
      if (!req.user.staffClinicId || !appointment.clinicId._id.equals(req.user.staffClinicId)) {
        return res.status(403).json({ success: false, message: 'Staff cannot view appointments outside assigned clinic' });
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
 * @desc    Get Doctor's Appointments
 * @route   GET /api/doctors/me/appointments
 * @access  Private (DOCTOR)
 */
export const getDoctorAppointments = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const doctor = await Doctor.findOne({ userId });
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }

    const { date, status } = req.query;
    const filter = { doctorId: doctor._id };
    if (date) filter.appointmentDate = date;
    if (status) filter.status = status;

    const appointments = await Appointment.find(filter)
      .populate('patientId', 'fullName phone gender dateOfBirth')
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
 * @desc    Get Staff Clinic Appointments
 * @route   GET /api/staff/appointments
 * @access  Private (STAFF, ADMIN)
 */
export const getStaffAppointments = async (req, res, next) => {
  try {
    let clinicId;
    if (req.user.role === 'STAFF') {
      if (!req.user.staffClinicId) {
        return res.status(403).json({ success: false, message: 'Staff profile is not assigned to a clinic' });
      }
      clinicId = req.user.staffClinicId;
    } else if (req.user.role === 'ADMIN') {
      clinicId = req.query.clinicId;
    }

    const { date, status, doctorId } = req.query;
    const filter = {};
    if (clinicId) filter.clinicId = clinicId;
    if (date) filter.appointmentDate = date;
    if (status) filter.status = status;
    if (doctorId) filter.doctorId = doctorId;

    const appointments = await Appointment.find(filter)
      .populate('patientId', 'fullName phone gender')
      .populate('doctorId', 'fullName specialtyId')
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
 * @access  Private (PATIENT, STAFF, ADMIN)
 */
export const cancelAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (appointment.status !== 'BOOKED') {
      return res.status(400).json({
        success: false,
        message: `Appointment cannot be cancelled as it is currently in '${appointment.status}' status`,
      });
    }

    // Role Ownership Validation
    if (req.user.role === 'PATIENT') {
      const userId = req.user._id || req.user.id;
      let patient = await Patient.findOne({ userId });
      if (!patient && req.user.patientId) {
        patient = await Patient.findOne({ _id: req.user.patientId });
      }
      if (!patient || !appointment.patientId.equals(patient._id)) {
        return res.status(403).json({ success: false, message: 'Unauthorized to cancel this appointment' });
      }
    } else if (req.user.role === 'STAFF') {
      if (!req.user.staffClinicId || !appointment.clinicId.equals(req.user.staffClinicId)) {
        return res.status(403).json({ success: false, message: 'Staff cannot cancel appointments outside assigned clinic' });
      }
    }

    appointment.status = 'CANCELLED';
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
 * @desc    Physical Check-In for Online Appointment at Reception (Allocates Token & Creates QueueEntry)
 * @route   PATCH /api/appointments/:id/check-in
 * @access  Private (STAFF, ADMIN)
 */
export const checkInAppointment = async (req, res, next) => {
  try {
    const initialAppt = await Appointment.findById(req.params.id);
    if (!initialAppt) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (initialAppt.status !== 'BOOKED') {
      return res.status(400).json({
        success: false,
        message: `Appointment cannot be checked in as it is currently in '${initialAppt.status}' status`,
      });
    }

    // Role Clinic Scope Validation
    if (req.user.role === 'STAFF') {
      if (!req.user.staffClinicId || !initialAppt.clinicId.equals(req.user.staffClinicId)) {
        return res.status(403).json({
          success: false,
          message: 'Staff cannot check in appointments outside assigned clinic',
        });
      }
    }

    // DECISION 001: Date & Time Window Validation
    const todayIST = getFormattedDateIST();
    if (initialAppt.appointmentDate !== todayIST) {
      return res.status(400).json({
        success: false,
        message: 'Check-in is only permitted on the scheduled appointment date',
      });
    }

    const currentTimeIST = getFormattedTimeIST();
    const currentMin = timeToMinutes(currentTimeIST);
    const slotStartMin = timeToMinutes(initialAppt.timeSlot.startTime);

    if (currentMin < slotStartMin - 60) {
      return res.status(400).json({
        success: false,
        message: 'Check-in window opens 60 minutes before appointment start time',
      });
    }

    if (currentMin > slotStartMin + 60) {
      return res.status(400).json({
        success: false,
        message: 'Check-in period has expired for this appointment',
      });
    }

    // DECISION 007: Atomic State Transition (BOOKED -> CHECKED_IN)
    const appointment = await Appointment.findOneAndUpdate(
      { _id: initialAppt._id, status: 'BOOKED' },
      { status: 'CHECKED_IN', checkedInAt: new Date() },
      { new: true }
    );

    if (!appointment) {
      return res.status(400).json({
        success: false,
        message: 'Appointment is already checked in or cannot be checked in',
      });
    }

    // DECISION 002: Atomic QueueCounter Token Allocation (Outside Transaction)
    const counter = await QueueCounter.findOneAndUpdate(
      {
        clinicId: appointment.clinicId,
        doctorId: appointment.doctorId,
        date: todayIST,
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

    // Start MongoDB Session Transaction for QueueEntry + QueueHistory
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const [queueEntry] = await QueueEntry.create(
        [
          {
            clinicId: appointment.clinicId,
            doctorId: appointment.doctorId,
            patientId: appointment.patientId,
            appointmentId: appointment._id,
            queueDate: todayIST,
            tokenNumber,
            source: 'ONLINE',
            priority: 'NORMAL',
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
            doctorId: appointment.doctorId,
            clinicId: appointment.clinicId,
            action: 'CHECK_IN',
            previousState: null,
            newState: 'WAITING',
            performedBy,
            userRole: req.user.role,
            reason: 'Online appointment checked in at physical reception',
            timestamp: new Date(),
          },
        ],
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: 'Patient checked in successfully',
        appointment,
        queueEntry: {
          _id: queueEntry._id,
          tokenNumber: queueEntry.tokenNumber,
          queueDate: queueEntry.queueDate,
          source: queueEntry.source,
          status: queueEntry.status,
          joinedAt: queueEntry.joinedAt,
        },
      });
    } catch (txError) {
      await session.abortTransaction();
      session.endSession();

      // RECOVERY: Revert Appointment status back to BOOKED so appointment is never left in CHECKED_IN without QueueEntry
      await Appointment.updateOne(
        { _id: appointment._id, status: 'CHECKED_IN' },
        { status: 'BOOKED', checkedInAt: null }
      );

      if (txError.code === 11000 || txError.code === 112 || (txError.errorLabelSet && txError.errorLabelSet.has('TransientTransactionError'))) {
        return res.status(409).json({
          success: false,
          message: 'Queue entry already exists for this appointment or active patient queue slot',
        });
      }
      throw txError;
    }
  } catch (error) {
    next(error);
  }
};
