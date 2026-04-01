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
  getTrackers: () => req('GET', '/trackers'),
  createTracker: (data) => req('POST', '/trackers', data),
  updateTracker: (id, data) => req('PATCH', `/trackers/${id}`, data),
  deleteTracker: (id) => req('DELETE', `/trackers/${id}`),
  checkTracker: (id) => req('POST', `/trackers/${id}/check`),
  checkAll: () => req('POST', '/trackers/check-all'),

  getDashboardStats: () => req('GET', '/dashboard/stats'),
  getRatioHistory: (id, days = 30) => req('GET', `/dashboard/ratio-history/${id}?days=${days}`),

  getSettings: () => req('GET', '/settings'),
  updateSettings: (data) => req('PATCH', '/settings', data),
  testDiscord: () => req('POST', '/settings/test-discord'),
  testTransmission: () => req('POST', '/settings/test-transmission'),

  getNotifications: (limit = 50) => req('GET', `/notifications?limit=${limit}`),

  getProwlarrIndexers: () => req('GET', '/prowlarr/indexers'),
  getProwlarrStatus: () => req('GET', '/prowlarr/status'),
  getUnlinkedTrackers: () => req('GET', '/prowlarr/trackers-unlinked'),
  assignProwlarrId: (prowlarrId, trackerId) => req('POST', '/prowlarr/assign', { prowlarr_id: prowlarrId, tracker_id: trackerId }),
  unassignProwlarrId: (trackerId) => req('DELETE', `/prowlarr/assign/${trackerId}`),
  syncProwlarrPriorities: () => req('POST', '/prowlarr/sync-priorities'),
  getIndexerStats: () => req('GET', '/prowlarr/indexer-stats'),

  getTransmissionTorrents: (tracker) => req('GET', `/transmission/torrents${tracker ? '?tracker=' + tracker : ''}`),
  getTransmissionStats: () => req('GET', '/transmission/stats'),
  getTransmissionRecommendations: () => req('GET', '/transmission/recommendations'),
  transmissionAction: (ids, action) => req('POST', '/transmission/action', { ids, action }),
  autoTransmissionPriorities: () => req('POST', '/transmission/auto-priorities'),
  resetTransmissionPriorities: () => req('POST', '/transmission/reset-priorities'),

  exportBackup: () => req('GET', '/backup/export'),
  importBackup: (data) => req('POST', '/backup/import', data),
}
