const BASE = '/api'

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) opts.body = JSON.stringify(body)
  const r = await fetch(BASE + path, opts)
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }))
    throw new Error(err.detail || r.statusText)
  }
  if (r.status === 204) return null
  return r.json()
}

export const api = {
  // trackers
  getTrackers: () => req('GET', '/trackers'),
  createTracker: (data) => req('POST', '/trackers', data),
  updateTracker: (id, data) => req('PATCH', `/trackers/${id}`, data),
  deleteTracker: (id) => req('DELETE', `/trackers/${id}`),
  checkTracker: (id) => req('POST', `/trackers/${id}/check`),
  checkAll: () => req('POST', '/trackers/check-all'),

  // dashboard
  getDashboardStats: () => req('GET', '/dashboard/stats'),
  getRatioHistory: (id, days = 30) => req('GET', `/dashboard/ratio-history/${id}?days=${days}`),

  // settings
  getSettings: () => req('GET', '/settings'),
  updateSettings: (data) => req('PATCH', '/settings', data),
  testDiscord: () => req('POST', '/settings/test-discord'),

  // notifications
  getNotifications: (limit = 50) => req('GET', `/notifications?limit=${limit}`),

  // prowlarr
  getProwlarrIndexers: () => req('GET', '/prowlarr/indexers'),
  getProwlarrStatus: () => req('GET', '/prowlarr/status'),
  getUnlinkedTrackers: () => req('GET', '/prowlarr/trackers-unlinked'),
  assignProwlarrId: (prowlarrId, trackerId) => req('POST', '/prowlarr/assign', { prowlarr_id: prowlarrId, tracker_id: trackerId }),
  unassignProwlarrId: (trackerId) => req('DELETE', `/prowlarr/assign/${trackerId}`),
  syncProwlarrPriorities: () => req('POST', '/prowlarr/sync-priorities'),
  autoTransmissionPriorities: () => req('POST', '/transmission/auto-priorities'),
  resetTransmissionPriorities: () => req('POST', '/transmission/reset-priorities'),
}
