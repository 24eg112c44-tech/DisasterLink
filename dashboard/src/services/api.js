const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `API request failed with status ${response.status}`);
  }
  return body;
}

export async function fetchReports({ page = 1, limit = 100, status = '', search = '' } = {}) {
  const params = new URLSearchParams();
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));
  if (status && status !== 'All') params.set('status', status);
  if (search && search.trim()) params.set('search', search.trim());
  return request(`/sos?${params.toString()}`);
}

export function fetchSingleReport(reportId) {
  return request(`/sos/${encodeURIComponent(reportId)}`);
}

export function fetchStats() {
  return request('/stats');
}

export function fetchHealth() {
  return request('/health');
}

export function createReport(data) {
  return request('/sos', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function syncBatch(reports) {
  return request('/sos/sync', {
    method: 'POST',
    body: JSON.stringify({ reports }),
  });
}

export function updateStatus(id, status) {
  return request(`/sos/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
