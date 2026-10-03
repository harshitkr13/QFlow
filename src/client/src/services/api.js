/**
 * API service helper for HTTP requests to Express backend.
 */
const API_BASE_URL = '/api';

export const fetchHealthStatus = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message || 'Failed to connect to backend server' };
  }
};

export const fetchUnknownRoute = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/unknown-test-route`);
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message || 'Failed to communicate with server' };
  }
};

export const fetchSpecialties = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/specialties`);
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const discoverDoctors = async (params = {}) => {
  try {
    const query = new URLSearchParams();
    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        query.append(key, params[key]);
      }
    });
    const response = await fetch(`${API_BASE_URL}/doctors/discover?${query.toString()}`);
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const fetchDoctorProfile = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/doctors/${id}`);
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const fetchDoctorAvailability = async (doctorId, date) => {
  try {
    const response = await fetch(`${API_BASE_URL}/doctors/${doctorId}/availability?date=${date}`);
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const createAppointment = async (bookingData, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(bookingData),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const fetchMyAppointments = async (token, params = {}) => {
  try {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/appointments/me?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const fetchAppointmentById = async (id, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/appointments/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const cancelAppointment = async (id, token, cancellationReason) => {
  try {
    const response = await fetch(`${API_BASE_URL}/appointments/${id}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ cancellationReason }),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const checkInAppointment = async (id, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/appointments/${id}/check-in`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

// Patient Live Queue Experience (Phase 09)
export const getPatientLiveQueue = async (token, appointmentId = null) => {
  try {
    let url = `${API_BASE_URL}/patient/queue/live`;
    if (appointmentId) {
      url += `?appointmentId=${encodeURIComponent(appointmentId)}`;
    }
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

// Phase 10 APIs (Public Display, Ratings & Notifications)
export const fetchPublicQueueDisplay = async (clinicId, doctorId = null) => {
  try {
    let url = `${API_BASE_URL}/public/queue/display?clinicId=${encodeURIComponent(clinicId)}`;
    if (doctorId) {
      url += `&doctorId=${encodeURIComponent(doctorId)}`;
    }
    const response = await fetch(url);
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const submitPatientRating = async (queueEntryId, rating, reviewText, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/patient/ratings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ queueEntryId, rating, reviewText }),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const fetchDoctorRatings = async (doctorId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/doctors/${doctorId}/ratings`);
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const fetchPatientNotifications = async (token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/patient/notifications`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const markNotificationRead = async (notificationId, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/patient/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const markNotificationAsRead = markNotificationRead;

// Staff Queue Operations (Phase 07)
export const searchStaffPatients = async (searchData, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/staff/queue/patients/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(searchData),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const createWalkInPatient = async (patientData, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/staff/queue/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(patientData),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const registerWalkIn = async (walkInData, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/staff/queue/walk-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(walkInData),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const fetchTodayStaffQueue = async (token, params = {}) => {
  try {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/staff/queue/today?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

// Phase 08 Queue Engine API Helpers
export const callNextPatient = async (doctorId, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/staff/queue/call-next`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ doctorId }),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const startConsultation = async (id, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/staff/queue/${id}/start`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const completeConsultation = async (id, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/staff/queue/${id}/complete`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const skipPatient = async (id, reason, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/staff/queue/${id}/skip`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const markNoShow = async (id, reason, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/staff/queue/${id}/no-show`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const rejoinPatient = async (id, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/staff/queue/${id}/rejoin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const pauseQueue = async (doctorId, reason, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/staff/queue/pause`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ doctorId, reason }),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const resumeQueue = async (doctorId, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/staff/queue/resume`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ doctorId }),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const cancelQueueEntry = async (id, reason, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/staff/queue/${id}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

// Phase 11 Billing & Analytics API Helpers
export const fetchPatientInvoices = async (token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/patient/invoices`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const fetchPatientInvoiceById = async (id, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/patient/invoices/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const initiatePatientPayment = async (paymentData, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/patient/payments/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(paymentData),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const fetchStaffBillingSummary = async (clinicId, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/staff/billing/summary?clinicId=${clinicId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const processStaffRefund = async (refundData, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/staff/billing/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(refundData),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const fetchStaffDailyAnalytics = async (clinicId, date, token) => {
  try {
    const query = new URLSearchParams({ clinicId, date: date || '' }).toString();
    const response = await fetch(`${API_BASE_URL}/staff/analytics/daily?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const fetchDoctorMeAnalytics = async (token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/doctors/me/analytics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const fetchAdminAnalyticsSummary = async (token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/analytics/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

// Phase 12 Intelligence API Helpers
export const fetchPatientQueuePrediction = async (token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/patient/queue/prediction`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const fetchStaffQueueIntelligence = async (token, clinicId = null) => {
  try {
    let url = `${API_BASE_URL}/staff/intelligence/queue`;
    if (clinicId) url += `?clinicId=${encodeURIComponent(clinicId)}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const fetchStaffAnomalies = async (token, clinicId = null) => {
  try {
    let url = `${API_BASE_URL}/staff/intelligence/anomalies`;
    if (clinicId) url += `?clinicId=${encodeURIComponent(clinicId)}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const fetchDoctorOwnIntelligence = async (token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/doctor/intelligence/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const fetchAdminIntelligenceSummary = async (token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/intelligence/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

// Phase 13 Client API Helpers (Auth, Notifications & Doctor Workspace)
export const loginUser = async (credentials) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const registerUser = async (userData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const updateDoctorSelfStatus = async (statusData, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/doctors/me/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(statusData),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const fetchDoctorOwnAppointments = async (token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/doctors/me/appointments`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

// Phase 14 Client API Helpers (Operational Resilience, Triage, Transfer & Day-End Settlement)
export const selfCheckInAppointment = async (appointmentId, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/appointments/${appointmentId}/self-check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const triageQueueEntry = async (queueEntryId, triageData, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/staff/queue/${queueEntryId}/triage`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(triageData),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const transferQueueDoctor = async (queueEntryId, transferData, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/staff/queue/${queueEntryId}/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(transferData),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const fetchReconciliationPreview = async (date, token, clinicId = null) => {
  try {
    const query = new URLSearchParams();
    if (date) query.append('date', date);
    if (clinicId) query.append('clinicId', clinicId);

    const response = await fetch(`${API_BASE_URL}/staff/reconciliation/daily-preview?${query.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const closeClinicDay = async (closeData, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/staff/reconciliation/close-day`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(closeData),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};

export const fetchDailySettlements = async (params = {}, token) => {
  try {
    const query = new URLSearchParams();
    if (params.date) query.append('date', params.date);
    if (params.clinicId) query.append('clinicId', params.clinicId);

    const response = await fetch(`${API_BASE_URL}/staff/reconciliation/history?${query.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
};




