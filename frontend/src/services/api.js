let rawBase = (import.meta.env.VITE_API_BASE_URL || '/api').trim();
if (rawBase.endsWith('/')) rawBase = rawBase.slice(0, -1);
if (rawBase.startsWith('http') && !rawBase.endsWith('/api')) {
  rawBase = `${rawBase}/api`;
}
const API_BASE = rawBase;

function getHeaders(isFormData = false) {
  const token = localStorage.getItem('token');
  const headers = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, options);

  // If token is invalid or expired
  if (response.status === 401) {
    localStorage.removeItem('token');
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }

  let data;
  try {
    data = await response.json();
  } catch {
    data = { error: response.statusText || 'Request failed' };
  }

  if (!response.ok) {
    const error = new Error(data.error || 'An unexpected error occurred');
    error.status = response.status;
    error.code = data.code;
    error.details = data;
    throw error;
  }

  return data;
}

// Auth API
export async function login(email, password) {
  return request('/auth/login', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ email, password })
  });
}

export async function register(fullName, email, password, company) {
  return request('/auth/register', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ fullName, email, password, company })
  });
}

export async function getMe() {
  return request('/auth/me', {
    headers: getHeaders()
  });
}

export async function logoutApi() {
  try {
    await request('/auth/logout', {
      method: 'POST',
      headers: getHeaders()
    });
  } catch (_) {
    // Discard locally even if remote logout fails
  }
  localStorage.removeItem('token');
}

// Inspections API
export async function getInspections() {
  return request('/inspections', {
    headers: getHeaders()
  });
}

export async function getInspection(id) {
  return request(`/inspections/${id}`, {
    headers: getHeaders()
  });
}

export async function createInspection(data) {
  return request('/inspections', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
}

export async function scanQuick(formData) {
  return request('/inspections/scan-quick', {
    method: 'POST',
    headers: getHeaders(true),
    body: formData
  });
}

export async function scanBatch(formData) {
  return request('/inspections/scan-batch', {
    method: 'POST',
    headers: getHeaders(true),
    body: formData
  });
}

export async function getRecentFindings() {
  return request('/inspections/findings/recent', {
    headers: getHeaders()
  });
}

export async function addFinding(inspectionId, formData) {
  return request(`/inspections/${inspectionId}/findings`, {
    method: 'POST',
    headers: getHeaders(true),
    body: formData
  });
}

export async function updateFinding(inspectionId, findingId, data) {
  return request(`/inspections/${inspectionId}/findings/${findingId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
}

export async function deleteFinding(inspectionId, findingId) {
  return request(`/inspections/${inspectionId}/findings/${findingId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
}

export async function updateInspectionStatus(id, status) {
  return request(`/inspections/${id}/status`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ status })
  });
}

export async function deleteInspection(id) {
  return request(`/inspections/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
}
