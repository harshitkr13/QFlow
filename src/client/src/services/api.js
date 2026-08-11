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
