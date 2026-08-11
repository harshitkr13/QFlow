/**
 * API service helper for HTTP requests to Express backend.
 */
const API_BASE_URL = '/api';

export const fetchHealthStatus = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message || 'Failed to connect to backend server',
    };
  }
};

export const fetchUnknownRoute = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/unknown-test-route`);
    const data = await response.json();
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message || 'Failed to communicate with server',
    };
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
