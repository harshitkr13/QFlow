import QueueEntry from '../models/QueueEntry.js';
import Doctor from '../models/Doctor.js';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';
import Clinic from '../models/Clinic.js';

import {
  extractDurationFeatures,
  calculateActualDurationMinutes,
  extractNoShowFeatures
} from '../utils/mlFeatureExtractor.js';

import {
  RidgeRegression,
  predictEWMA,
  scoreNoShowRisk,
  detectOperationalAnomalies,
  classifyCongestion
} from '../utils/mlModelEngine.js';

/**
 * In-Memory Model Cache for Ridge Regression Coefficients per Doctor
 */
const modelCache = new Map();

/**
 * Trains or retrieves a Ridge Regression duration predictor for a given doctor.
 */
async function getOrTrainDoctorModel(doctorId) {
  if (modelCache.has(doctorId.toString())) {
    return modelCache.get(doctorId.toString());
  }

  // Fetch last 100 completed queue entries for this doctor
  const completedEntries = await QueueEntry.find({
    doctorId,
    status: 'COMPLETED',
    completedAt: { $ne: null }
  })
    .sort({ completedAt: -1 })
    .limit(100)
    .populate('patientId')
    .lean();

  const doctor = await Doctor.findById(doctorId).lean();

  const X = [];
  const y = [];
  const recentDurations = [];

  for (const entry of completedEntries) {
    const duration = calculateActualDurationMinutes(entry);
    if (duration !== null) {
      recentDurations.push(duration);
      const features = extractDurationFeatures(entry, doctor, entry.patientId, 0);
      X.push(features);
      y.push(duration);
    }
  }

  const ewmaAvg = predictEWMA(recentDurations, 0.3, doctor?.avgConsultationTimeMin || 15);

  let ridgeModel = null;
  if (X.length >= 5) {
    ridgeModel = new RidgeRegression(0.1);
    const success = ridgeModel.fit(X, y);
    if (!success) ridgeModel = null;
  }

  const modelMeta = {
    doctorId: doctorId.toString(),
    ridgeModel,
    ewmaAvg,
    docAvgConfigured: doctor?.avgConsultationTimeMin || 15,
    sampleCount: X.length,
    lastTrainedAt: new Date()
  };

  modelCache.set(doctorId.toString(), modelMeta);
  return modelMeta;
}

/**
 * Predicts expected consultation duration for a single QueueEntry with Multi-Level Fallback.
 */
export async function predictConsultationDuration(queueEntry, doctor = null) {
  try {
    if (!doctor) {
      doctor = await Doctor.findById(queueEntry.doctorId).lean();
    }

    const docAvg = doctor?.avgConsultationTimeMin || 15;
    const modelMeta = await getOrTrainDoctorModel(queueEntry.doctorId);

    let predictedMins = null;
    let predictionMethod = 'DOCTOR_AVERAGE';

    // Level 1: Ridge Regression (if trained and valid)
    if (modelMeta.ridgeModel && modelMeta.sampleCount >= 5) {
      const patient = queueEntry.patientId && queueEntry.patientId.dateOfBirth
        ? queueEntry.patientId
        : await Patient.findById(queueEntry.patientId).lean();

      const features = extractDurationFeatures(queueEntry, doctor, patient, 0);
      const ridgePred = modelMeta.ridgeModel.predict(features);

      // Bounds sanity check: must be between 3 and 90 mins
      if (ridgePred !== null && !isNaN(ridgePred) && ridgePred >= 3 && ridgePred <= 90) {
        predictedMins = Math.round(ridgePred * 10) / 10;
        predictionMethod = 'RIDGE_REGRESSION';
      }
    }

    // Level 2: EWMA Fallback (if Ridge failed or insufficient samples)
    if (predictedMins === null && modelMeta.sampleCount > 0) {
      if (modelMeta.ewmaAvg >= 3 && modelMeta.ewmaAvg <= 90) {
        predictedMins = modelMeta.ewmaAvg;
        predictionMethod = 'EWMA_BASELINE';
      }
    }

    // Level 3: Configured Doctor Average Fallback
    if (predictedMins === null || isNaN(predictedMins) || predictedMins <= 0) {
      predictedMins = docAvg;
      predictionMethod = 'DOCTOR_AVERAGE';
    }

    return {
      predictedDurationMinutes: predictedMins,
      predictionMethod,
      confidence: predictionMethod === 'RIDGE_REGRESSION' ? 'HIGH' : (predictionMethod === 'EWMA_BASELINE' ? 'MEDIUM' : 'BASELINE'),
      isEstimated: true,
      sampleCount: modelMeta.sampleCount,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    // Total Error Fallback
    const fallbackAvg = doctor?.avgConsultationTimeMin || 15;
    return {
      predictedDurationMinutes: fallbackAvg,
      predictionMethod: 'DOCTOR_AVERAGE',
      confidence: 'BASELINE',
      isEstimated: true,
      sampleCount: 0,
      generatedAt: new Date().toISOString()
    };
  }
}

/**
 * Predicts patient wait-time with 100% Phase 09 Deterministic Fallback Guardrail.
 */
export async function predictPatientWaitTime(queueEntry, doctor = null) {
  const defaultDocAvg = doctor?.avgConsultationTimeMin || 15;

  // Compute Phase 09 Deterministic Wait (Primary Fallback)
  let deterministicWaitMin = 0;
  let peopleAheadCount = 0;

  try {
    if (!doctor) {
      doctor = await Doctor.findById(queueEntry.doctorId).lean();
    }

    // 1. Fetch active IN_CONSULTATION entry
    const activeEntry = await QueueEntry.findOne({
      doctorId: queueEntry.doctorId,
      queueDate: queueEntry.queueDate,
      status: 'IN_CONSULTATION'
    }).lean();

    let activeRemainderMin = 0;
    if (activeEntry && activeEntry.consultationStartedAt) {
      const elapsedMins = (Date.now() - new Date(activeEntry.consultationStartedAt).getTime()) / (1000 * 60);
      activeRemainderMin = Math.max(0, (doctor?.avgConsultationTimeMin || 15) - elapsedMins);
    }

    // 2. Compute people ahead ordered by Phase 08 HYBRID rules
    const hybridFilter = {
      doctorId: queueEntry.doctorId,
      queueDate: queueEntry.queueDate,
      status: 'WAITING'
    };

    const allWaiting = await QueueEntry.find(hybridFilter)
      .sort({ priorityWeight: 1, effectiveSlotMinutes: 1, joinedAt: 1, tokenNumber: 1 })
      .lean();

    const targetIdx = allWaiting.findIndex(e => e._id.toString() === queueEntry._id.toString());
    peopleAheadCount = targetIdx >= 0 ? targetIdx : 0;

    deterministicWaitMin = Math.round(peopleAheadCount * defaultDocAvg + activeRemainderMin);

    // If entry is not WAITING (e.g. CALLED or IN_CONSULTATION), wait is 0
    if (queueEntry.status !== 'WAITING') {
      return {
        estimatedWaitMinutes: 0,
        deterministicWaitMinutes: 0,
        peopleAhead: 0,
        predictionMethod: 'DETERMINISTIC_PHASE09',
        confidence: 'HIGH',
        isEstimated: false,
        isFallback: false,
        lastUpdated: new Date().toISOString()
      };
    }

    // 3. Attempt ML Prediction
    let predictedWaitMin = 0;
    let mlSuccess = true;

    for (let i = 0; i < peopleAheadCount; i++) {
      const aheadEntry = allWaiting[i];
      const durationResult = await predictConsultationDuration(aheadEntry, doctor);
      if (durationResult && durationResult.predictedDurationMinutes > 0) {
        predictedWaitMin += durationResult.predictedDurationMinutes;
      } else {
        predictedWaitMin += defaultDocAvg;
      }
    }
    predictedWaitMin += activeRemainderMin;
    predictedWaitMin = Math.round(predictedWaitMin);

    // Sanity Checks on ML Output
    if (isNaN(predictedWaitMin) || predictedWaitMin < 0 || predictedWaitMin > 480) {
      mlSuccess = false;
    }

    if (mlSuccess) {
      return {
        estimatedWaitMinutes: predictedWaitMin,
        deterministicWaitMinutes: deterministicWaitMin,
        peopleAhead: peopleAheadCount,
        predictionMethod: 'ML_ASSISTED',
        confidence: 'HIGH',
        isEstimated: true,
        isFallback: false,
        lastUpdated: new Date().toISOString()
      };
    }
  } catch (err) {
    // Exception Fallback
  }

  // 100% Deterministic Phase 09 Fallback
  return {
    estimatedWaitMinutes: deterministicWaitMin,
    deterministicWaitMinutes: deterministicWaitMin,
    peopleAhead: peopleAheadCount,
    predictionMethod: 'DETERMINISTIC_PHASE09',
    confidence: 'BASELINE',
    isEstimated: true,
    isFallback: true,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Computes Staff Queue Intelligence for a given clinic.
 */
export async function getClinicQueueIntelligence(clinicId) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const doctors = await Doctor.find({ clinicId, isActive: true }).lean();
  const doctorIds = doctors.map(d => d._id);

  const activeQueue = await QueueEntry.find({
    clinicId,
    queueDate: todayStr,
    status: { $in: ['WAITING', 'CALLED', 'IN_CONSULTATION'] }
  })
    .sort({ priorityWeight: 1, effectiveSlotMinutes: 1, joinedAt: 1, tokenNumber: 1 })
    .populate('patientId')
    .lean();

  const waitingCount = activeQueue.filter(q => q.status === 'WAITING').length;
  const activeCount = activeQueue.filter(q => q.status === 'IN_CONSULTATION' || q.status === 'CALLED').length;

  const docAvgMap = new Map();
  doctors.forEach(d => docAvgMap.set(d._id.toString(), d.avgConsultationTimeMin || 15));

  const congestion = classifyCongestion(waitingCount, activeCount, 15);

  // Compute anomalies for doctors
  const anomalies = [];
  for (const doc of doctors) {
    const activeDocEntry = activeQueue.find(q => q.doctorId.toString() === doc._id.toString() && q.status === 'IN_CONSULTATION');
    let activeDurationMin = 0;
    if (activeDocEntry && activeDocEntry.consultationStartedAt) {
      activeDurationMin = (Date.now() - new Date(activeDocEntry.consultationStartedAt).getTime()) / (1000 * 60);
    }

    const docAnomalies = detectOperationalAnomalies({
      activeConsultationDurationMin: Math.round(activeDurationMin),
      docAvgDurationMin: doc.avgConsultationTimeMin || 15,
      waitingCount: activeQueue.filter(q => q.doctorId.toString() === doc._id.toString() && q.status === 'WAITING').length,
      consecutiveNoShows: 0,
      hourlyWalkInCount: 0,
      historicalHourlyWalkInAvg: 5,
      doctorStatus: doc.operationalStatus || 'AVAILABLE',
      lastCallTimeMs: activeDocEntry ? new Date(activeDocEntry.calledAt || Date.now()).getTime() : null
    });

    docAnomalies.forEach(a => anomalies.push({ ...a, doctorId: doc._id, doctorName: doc.userId?.name || 'Doctor' }));
  }

  return {
    clinicId: clinicId.toString(),
    date: todayStr,
    activeQueueCount: activeQueue.length,
    waitingCount,
    activeCount,
    congestionLevel: congestion.level,
    estimatedWorkloadMins: congestion.estimatedWorkloadMins,
    description: congestion.description,
    anomalies,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Computes Advisory No-Show Risk for an Appointment.
 */
export async function getAppointmentNoShowAdvisory(appointmentId) {
  const appointment = await Appointment.findById(appointmentId).lean();
  if (!appointment) return null;

  // Calculate past patient history
  const pastAppts = await Appointment.find({
    patientId: appointment.patientId,
    status: { $in: ['COMPLETED', 'NO_SHOW'] }
  }).lean();

  const total = pastAppts.length;
  const noShows = pastAppts.filter(a => a.status === 'NO_SHOW').length;

  const features = extractNoShowFeatures(appointment, { total, noShows });
  const riskResult = scoreNoShowRisk(features);

  return {
    appointmentId: appointment._id.toString(),
    patientId: appointment.patientId.toString(),
    appointmentDate: appointment.appointmentDate,
    slotTime: appointment.slotTime,
    status: appointment.status,
    ...riskResult
  };
}
