const BASE = '/api';

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server error (${res.status}) — please try again`);
  }
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

export const api = {
  // Auth
  getMe:            ()                         => req('GET',  '/auth/me'),
  login:            (username, password)       => req('POST', '/auth/login', { username, password }),
  logout:           ()                         => req('POST', '/auth/logout'),
  changePassword:   (current_password, new_password) => req('PUT', '/auth/password', { current_password, new_password }),

  // Boxes
  getBoxes:      ()                => req('GET',    '/boxes'),
  getBox:        (id)              => req('GET',    `/boxes/${id}`),
  createBox:     (body)            => req('POST',   '/boxes', body),
  updateBox:     (id, body)        => req('PUT',    `/boxes/${id}`, body),
  deleteBox:     (id)              => req('DELETE', `/boxes/${id}`),
  getBoxHistory: (id)              => req('GET',    `/boxes/${id}/history`),
  revertBox:     (id, versionId)   => req('POST',   `/boxes/${id}/revert/${versionId}`),
  emptyBox:      (id)              => req('POST',   `/boxes/${id}/empty`),

  // Tubes
  getTubes:           ()                    => req('GET',    '/tubes'),
  bulkAssignTubes:    (tubeIds, boxId)     => req('POST',   '/tubes/bulk-assign', { tube_ids: tubeIds, box_id: boxId }),
  getTube:        (id)             => req('GET',    `/tubes/${id}`),
  createTube:     (body)           => req('POST',   '/tubes', body),
  updateTube:     (id, body)       => req('PUT',    `/tubes/${id}`, body),
  deleteTube:     (id)             => req('DELETE', `/tubes/${id}`),
  getTubeHistory: (id)             => req('GET',    `/tubes/${id}/history`),
  revertTube:     (id, versionId)  => req('POST',   `/tubes/${id}/revert/${versionId}`),

  // Admin
  getPythonAnywhereStats: () => req('GET', '/admin/pythonanywhere'),
  getBackups:             () => req('GET', '/admin/backups'),
  createBackup:           () => req('POST', '/admin/backups'),
  backupDownloadUrl:      (name) => `${BASE}/admin/backups/${encodeURIComponent(name)}`,

  // Users
  getUsers:    ()      => req('GET',    '/users'),
  createUser:  (body)  => req('POST',   '/users', body),
  deleteUser:  (id)    => req('DELETE', `/users/${id}`),

  // Cores
  getCores:       ()                => req('GET',    '/cores'),
  getCore:        (id)              => req('GET',    `/cores/${id}`),
  createCore:     (body)            => req('POST',   '/cores', body),
  updateCore:     (id, body)        => req('PUT',    `/cores/${id}`, body),
  deleteCore:     (id)              => req('DELETE', `/cores/${id}`),
  getCoreHistory: (id)              => req('GET',    `/cores/${id}/history`),
  revertCore:     (id, versionId)   => req('POST',   `/cores/${id}/revert/${versionId}`),

  // Locations
  getLocations:    ()           => req('GET',    '/locations'),
  getLocation:     (id)         => req('GET',    `/locations/${id}`),
  createLocation:  (body)       => req('POST',   '/locations', body),
  updateLocation:  (id, body)   => req('PUT',    `/locations/${id}`, body),
  deleteLocation:  (id)         => req('DELETE', `/locations/${id}`),

  // Utilities
  scan:    (barcode) => req('GET', `/scan/${encodeURIComponent(barcode)}`),
  search:  (q)       => req('GET', `/search?q=${encodeURIComponent(q)}`),
};
