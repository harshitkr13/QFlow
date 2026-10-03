/**
 * Feature Extraction Utility for QFlow AI/ML Intelligence Layer.
 * Extracts operational features from historical QueueEntry, Appointment, Doctor, Patient, and Clinic records.
 * STRICT PRIVACY RULE: Excludes all patient PII, medical symptoms, diagnosis, and prescription data.
 */

/**
 * Extracts a normalized numerical feature vector from a QueueEntry and associated context.
 *
 * Feature Vector schema:
 * [0] dayOfWeek (0-6, normalized to 0-1)
 * [1] hourOfDay (0-23, normalized to 0-1)
 * [2] sourceIsOnline (1 for ONLINE, 0 for WALK_IN)
 * [3] priorityIsUrgent (1 for URGENT, 0 for NORMAL)
 * [4] queuePosition (1-indexed position in queue)
 * [5] effectiveSlotMinutes (normalized to 0-1 over 1440 mins)
 * [6] doctorAvgDuration (configured avg consultation duration)
 * [7] patientAge (derived from DOB, default 35 if unavailable)
 * [8] isWeekend (1 for Sat/Sun, 0 otherwise)
 * [9] rejoinCount (number of times rejoined)
 */
export function extractDurationFeatures(queueEntry, doctor, patient = null, activeWaitingCount = 0) {
  const joinedDate = queueEntry.joinedAt ? new Date(queueEntry.joinedAt) : new Date();
  
  const dayOfWeek = joinedDate.getDay();
  const hourOfDay = joinedDate.getHours() + joinedDate.getMinutes() / 60;
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6) ? 1 : 0;
  
  const sourceIsOnline = queueEntry.source === 'ONLINE' ? 1 : 0;
  const priorityIsUrgent = (queueEntry.priority === 'URGENT' || queueEntry.priorityWeight === 0) ? 1 : 0;
  
  const effectiveSlot = queueEntry.effectiveSlotMinutes || (joinedDate.getHours() * 60 + joinedDate.getMinutes());
  const docAvgDuration = doctor?.avgConsultationTimeMin || 15;
  
  let patientAge = 35;
  if (patient && patient.dateOfBirth) {
    const dob = new Date(patient.dateOfBirth);
    const ageDiffMs = Date.now() - dob.getTime();
    const ageDate = new Date(ageDiffMs);
    patientAge = Math.abs(ageDate.getUTCFullYear() - 1970);
  }

  const rejoinCount = queueEntry.rejoinCount || 0;

  return [
    dayOfWeek / 6.0,                  // Feature 0: Day of week [0, 1]
    hourOfDay / 24.0,                 // Feature 1: Hour of day [0, 1]
    sourceIsOnline,                   // Feature 2: Binary ONLINE flag
    priorityIsUrgent,                 // Feature 3: Binary URGENT flag
    Math.min(activeWaitingCount, 50) / 50.0, // Feature 4: Normalized Queue Depth
    effectiveSlot / 1440.0,           // Feature 5: Effective slot minutes [0, 1]
    Math.min(docAvgDuration, 60) / 60.0,     // Feature 6: Doctor baseline avg
    Math.min(patientAge, 100) / 100.0,       // Feature 7: Patient age [0, 1]
    isWeekend,                        // Feature 8: Binary weekend flag
    Math.min(rejoinCount, 5) / 5.0    // Feature 9: Rejoin count [0, 1]
  ];
}

/**
 * Calculates actual consultation duration in minutes from a completed QueueEntry.
 * Returns null if timestamps are missing or invalid.
 */
export function calculateActualDurationMinutes(queueEntry) {
  if (!queueEntry || queueEntry.status !== 'COMPLETED') return null;

  const startTime = queueEntry.consultationStartedAt || queueEntry.calledAt;
  const endTime = queueEntry.completedAt;

  if (!startTime || !endTime) return null;

  const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
  const durationMins = durationMs / (1000 * 60);

  // Filter out negative or unrealistic outliers (> 180 mins)
  if (isNaN(durationMins) || durationMins <= 0.5 || durationMins > 180) {
    return null;
  }

  return Math.round(durationMins * 10) / 10;
}

/**
 * Extracts features for No-Show Risk Scoring from an Appointment.
 */
export function extractNoShowFeatures(appointment, patientHistory = { total: 0, noShows: 0 }) {
  const apptDate = appointment.appointmentDate ? new Date(appointment.appointmentDate) : new Date();
  const bookedAt = appointment.bookedAt ? new Date(appointment.bookedAt) : new Date();
  
  // Lead time in hours between booking and scheduled date
  const leadTimeHours = Math.max(0, (apptDate.getTime() - bookedAt.getTime()) / (1000 * 60 * 60));
  const dayOfWeek = apptDate.getDay();
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6) ? 1 : 0;
  
  const pastNoShowRatio = patientHistory.total > 0 ? (patientHistory.noShows / patientHistory.total) : 0.05;

  return {
    leadTimeHours,
    dayOfWeek,
    isWeekend,
    pastNoShowRatio,
    hasPastNoShows: patientHistory.noShows > 0 ? 1 : 0
  };
}
