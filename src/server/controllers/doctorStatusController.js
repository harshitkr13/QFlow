import { Doctor } from '../models/index.js';

const ALLOWED_STATUSES = ['AVAILABLE', 'BUSY', 'ON_BREAK', 'UNAVAILABLE', 'OFFLINE'];

/**
 * @desc    Get live operational status of a doctor
 * @route   GET /api/doctors/:id/status
 * @access  Protected
 */
export const getDoctorStatus = async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.params.id).select('fullName operationalStatus statusExpectedResumeTime clinicId');
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    return res.status(200).json({
      success: true,
      doctorId: doctor._id,
      operationalStatus: doctor.operationalStatus,
      statusExpectedResumeTime: doctor.statusExpectedResumeTime,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Doctor update own live operational status (Doctor only)
 * @route   PATCH /api/doctors/me/status
 * @access  Private (DOCTOR)
 */
export const updateStatusSelf = async (req, res, next) => {
  try {
    if (!req.user || !req.user.doctorId) {
      return res.status(403).json({
        success: false,
        message: 'Doctor profile not found for this account',
      });
    }

    const { operationalStatus, statusExpectedResumeTime } = req.body;
    if (!operationalStatus || !ALLOWED_STATUSES.includes(operationalStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid operationalStatus. Allowed values: ${ALLOWED_STATUSES.join(', ')}`,
      });
    }

    const doctor = await Doctor.findById(req.user.doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }

    doctor.operationalStatus = operationalStatus;
    doctor.statusExpectedResumeTime = statusExpectedResumeTime || null;
    await doctor.save();

    return res.status(200).json({
      success: true,
      message: 'Operational status updated successfully',
      doctorId: doctor._id,
      operationalStatus: doctor.operationalStatus,
      statusExpectedResumeTime: doctor.statusExpectedResumeTime,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Staff update doctor operational status (Staff assigned clinic scope)
 * @route   PATCH /api/staff/doctors/:id/status
 * @access  Private (STAFF, ADMIN)
 */
export const updateStatusStaff = async (req, res, next) => {
  try {
    const { operationalStatus, statusExpectedResumeTime } = req.body;
    if (!operationalStatus || !ALLOWED_STATUSES.includes(operationalStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid operationalStatus. Allowed values: ${ALLOWED_STATUSES.join(', ')}`,
      });
    }

    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    // STRICT STAFF CLINIC SCOPE VERIFICATION
    if (req.user.role === 'STAFF') {
      if (!req.user.staffClinicId || !req.user.staffClinicId.equals(doctor.clinicId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Staff is not authorized to update doctors outside assigned clinic',
        });
      }
    }

    doctor.operationalStatus = operationalStatus;
    doctor.statusExpectedResumeTime = statusExpectedResumeTime || null;
    await doctor.save();

    return res.status(200).json({
      success: true,
      message: 'Doctor operational status updated by staff successfully',
      doctorId: doctor._id,
      operationalStatus: doctor.operationalStatus,
      statusExpectedResumeTime: doctor.statusExpectedResumeTime,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Admin update doctor operational status (Admin only)
 * @route   PATCH /api/admin/doctors/:id/status
 * @access  Private (ADMIN)
 */
export const updateStatusAdmin = async (req, res, next) => {
  try {
    const { operationalStatus, statusExpectedResumeTime } = req.body;
    if (!operationalStatus || !ALLOWED_STATUSES.includes(operationalStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid operationalStatus. Allowed values: ${ALLOWED_STATUSES.join(', ')}`,
      });
    }

    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    doctor.operationalStatus = operationalStatus;
    doctor.statusExpectedResumeTime = statusExpectedResumeTime || null;
    await doctor.save();

    return res.status(200).json({
      success: true,
      message: 'Doctor operational status updated by admin successfully',
      doctorId: doctor._id,
      operationalStatus: doctor.operationalStatus,
      statusExpectedResumeTime: doctor.statusExpectedResumeTime,
    });
  } catch (error) {
    next(error);
  }
};
