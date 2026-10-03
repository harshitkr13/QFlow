import QueueEntry from '../models/QueueEntry.js';
import Patient from '../models/Patient.js';
import Doctor from '../models/Doctor.js';
import Appointment from '../models/Appointment.js';
import Clinic from '../models/Clinic.js';

import {
  predictPatientWaitTime,
  predictConsultationDuration,
  getClinicQueueIntelligence,
  getAppointmentNoShowAdvisory
} from '../services/intelligenceService.js';

/**
 * GET /api/patient/queue/prediction
 * Authenticated Patient reads predicted wait time for active queue entry today.
 */
export async function getPatientQueuePrediction(req, res) {
  try {
    const patient = await Patient.findOne({ userId: req.user._id });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found.' });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const queueEntry = await QueueEntry.findOne({
      patientId: patient._id,
      queueDate: todayStr,
      status: { $in: ['WAITING', 'CALLED', 'IN_CONSULTATION'] }
    })
      .populate('doctorId')
      .populate('clinicId');

    if (!queueEntry) {
      return res.status(200).json({
        success: true,
        data: {
          hasActiveQueueEntry: false,
          message: 'No active queue entry found for today.'
        }
      });
    }

    const doctor = await Doctor.findById(queueEntry.doctorId).lean();
    const waitResult = await predictPatientWaitTime(queueEntry, doctor);

    return res.status(200).json({
      success: true,
      data: {
        hasActiveQueueEntry: true,
        queueEntryId: queueEntry._id,
        tokenNumber: queueEntry.tokenNumber,
        status: queueEntry.status,
        queueDate: queueEntry.queueDate,
        doctorName: doctor?.userId?.name || 'Doctor',
        clinicName: queueEntry.clinicId?.name || 'Clinic',
        ...waitResult
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/staff/intelligence/queue
 * Authenticated Staff/Admin reads clinic queue congestion intelligence.
 */
export async function getStaffQueueIntelligence(req, res) {
  try {
    let clinicId = req.query.clinicId;

    if (req.user.role === 'STAFF') {
      if (!req.user.staffClinicId) {
        return res.status(403).json({ success: false, message: 'Staff user has no assigned clinic.' });
      }
      clinicId = req.user.staffClinicId.toString();
    } else if (!clinicId) {
      const firstClinic = await Clinic.findOne({ isActive: true }).lean();
      clinicId = firstClinic ? firstClinic._id.toString() : null;
    }

    if (!clinicId) {
      return res.status(400).json({ success: false, message: 'Clinic ID is required.' });
    }

    const intelligence = await getClinicQueueIntelligence(clinicId);
    return res.status(200).json({ success: true, data: intelligence });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/staff/intelligence/anomalies
 * Authenticated Staff/Admin reads operational queue anomalies for assigned clinic.
 */
export async function getStaffAnomalies(req, res) {
  try {
    let clinicId = req.query.clinicId;

    if (req.user.role === 'STAFF') {
      if (!req.user.staffClinicId) {
        return res.status(403).json({ success: false, message: 'Staff user has no assigned clinic.' });
      }
      clinicId = req.user.staffClinicId.toString();
    } else if (!clinicId) {
      const firstClinic = await Clinic.findOne({ isActive: true }).lean();
      clinicId = firstClinic ? firstClinic._id.toString() : null;
    }

    if (!clinicId) {
      return res.status(400).json({ success: false, message: 'Clinic ID is required.' });
    }

    const intelligence = await getClinicQueueIntelligence(clinicId);
    return res.status(200).json({
      success: true,
      data: {
        clinicId,
        anomalies: intelligence.anomalies || [],
        count: intelligence.anomalies?.length || 0,
        lastChecked: new Date().toISOString()
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/staff/intelligence/doctor/:id
 * Authenticated Staff/Admin reads consultation duration trends for a doctor.
 */
export async function getStaffDoctorIntelligence(req, res) {
  try {
    const doctorId = req.params.id;
    const doctor = await Doctor.findById(doctorId).lean();

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    // IDOR Check: Staff can only query doctors in their assigned clinic
    if (req.user.role === 'STAFF' && doctor.clinicId.toString() !== req.user.staffClinicId?.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to doctor in another clinic.' });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const completedEntries = await QueueEntry.find({
      doctorId,
      queueDate: todayStr,
      status: 'COMPLETED'
    }).lean();

    const sampleQueueEntry = {
      doctorId,
      joinedAt: new Date(),
      source: 'ONLINE',
      priority: 'NORMAL',
      effectiveSlotMinutes: 540
    };

    const durationPrediction = await predictConsultationDuration(sampleQueueEntry, doctor);

    return res.status(200).json({
      success: true,
      data: {
        doctorId: doctor._id.toString(),
        configuredAvgDurationMin: doctor.avgConsultationTimeMin || 15,
        todayCompletedCount: completedEntries.length,
        durationPrediction
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/doctor/intelligence/me
 * Authenticated Doctor reads own duration trends & workload forecast.
 */
export async function getDoctorOwnIntelligence(req, res) {
  try {
    const doctor = await Doctor.findOne({ userId: req.user._id }).lean();
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found.' });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const activeQueue = await QueueEntry.find({
      doctorId: doctor._id,
      queueDate: todayStr,
      status: { $in: ['WAITING', 'CALLED', 'IN_CONSULTATION'] }
    }).lean();

    const completedEntries = await QueueEntry.find({
      doctorId: doctor._id,
      queueDate: todayStr,
      status: 'COMPLETED'
    }).lean();

    const sampleQueueEntry = {
      doctorId: doctor._id,
      joinedAt: new Date(),
      source: 'ONLINE',
      priority: 'NORMAL',
      effectiveSlotMinutes: 540
    };

    const durationPrediction = await predictConsultationDuration(sampleQueueEntry, doctor);

    return res.status(200).json({
      success: true,
      data: {
        doctorId: doctor._id.toString(),
        configuredAvgDurationMin: doctor.avgConsultationTimeMin || 15,
        todayCompletedCount: completedEntries.length,
        todayWaitingCount: activeQueue.filter(q => q.status === 'WAITING').length,
        durationPrediction,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/admin/intelligence/summary
 * Authenticated Admin reads platform-level ML and operational status.
 */
export async function getAdminIntelligenceSummary(req, res) {
  try {
    const totalClinics = await Clinic.countDocuments({ isActive: true });
    const totalDoctors = await Doctor.countDocuments({ isActive: true });
    const todayStr = new Date().toISOString().slice(0, 10);

    const todayEntries = await QueueEntry.countDocuments({ queueDate: todayStr });
    const completedEntries = await QueueEntry.countDocuments({ queueDate: todayStr, status: 'COMPLETED' });

    return res.status(200).json({
      success: true,
      data: {
        platformStatus: 'OPERATIONAL',
        mlModelType: 'RIDGE_REGRESSION_WITH_EWMA_FALLBACK',
        activeClinics: totalClinics,
        activeDoctors: totalDoctors,
        todayTotalQueueEntries: todayEntries,
        todayCompletedConsultations: completedEntries,
        safetyGuardrailsActive: true,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/staff/intelligence/no-show/:appointmentId
 * Authenticated Staff/Admin reads no-show advisory risk score.
 */
export async function getAppointmentNoShowAdvisoryController(req, res) {
  try {
    const appointmentId = req.params.appointmentId;
    const appointment = await Appointment.findById(appointmentId).lean();
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    if (req.user.role === 'STAFF' && appointment.clinicId.toString() !== req.user.staffClinicId?.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to appointment in another clinic.' });
    }

    const advisory = await getAppointmentNoShowAdvisory(appointmentId);
    return res.status(200).json({ success: true, data: advisory });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
