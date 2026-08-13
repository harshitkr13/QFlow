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
