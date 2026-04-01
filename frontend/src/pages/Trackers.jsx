import React, { useState, useEffect } from 'react'
import { api } from '../hooks/api'

const EMPTY_FORM = {
  name: '', auth_type: 'cookie', threshold: 1.0, enabled: true,
  profile_url: '', manual_cookies: '',
  login_url: '', username: '', password: '',
  api_url: '', api_key: '',
}

function Badge({ cls, children }) {
  const colors = {
    online: 'bg-accent/10 text-accent border border-accent/25',
    error: 'bg-danger/10 text-danger border border-danger/25',
    unknown: 'bg-bg3 text-[var(--text3)] border border-[var(--border)]',
    cookie: 'bg-accent2/10 text-accent2 border border-accent2/25',
    login: 'bg-warn/10 text-warn border border-warn/25',
    api: 'bg-purple-500/10 text-purple-400 border border-purple-500/25',
  }
  return (
    <span className={`text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded ${colors[cls] || colors.unknown}`}>
      {children}
    </span>
  )
}

function TrackerModal({ tracker, onClose, onSave, onSyncPriority }) {
  const [form, setForm] = useState(tracker ? { ...tracker } : { ...EMPTY_FORM })
  const [tab, setTab] = useState(form.auth_type || 'cookie')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setLoading(true)
    try {
      await onSave({ ...form, auth_type: tab })
      onClose()
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const inp = 'w-full bg-bg2 border border-[var(--border)] rounded-lg text-[var(--text1)] text-sm px-3 py-2 outline-none focus:border-accent transition-colors'
  const lbl = 'block text-[10px] text-[var(--text3)] tracking-widest uppercase mb-1.5'

  return (
    <div className="fixed inset-0 bg-black/70 z-[200] flex items-end sm:items-center justify-center" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-bg1 border border-[var(--border2)] rounded-t-xl sm:rounded-xl w-full sm:w-[520px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <p className="text-sm font-bold text-[var(--text1)]">{tracker ? 'Edit tracker' : 'Add tracker'}</p>
          <button onClick={onClose} className="text-[var(--text3)] hover:text-[var(--text1)] text-lg leading-none">&times;</button>
        </div>

        <div className="px-5 py-5">
          <div className="flex border border-[var(--border)] rounded-lg overflow-hidden mb-5">
            {['cookie', 'login', 'api'].map(t => (
              <button key={t} onClick={() => { setTab(t); set('auth_type', t) }}
                className={`flex-1 py-2 text-[11px] tracking-widest uppercase transition-colors ${tab === t ? 'bg-accent/15 text-accent' : 'text-[var(--text2)] hover:text-[var(--text1)]'}`}>
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <label className={lbl}>Tracker name</label>
              <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. HD-Space" />
            </div>

            {(tab === 'cookie' || tab === 'login') && (
              <div>
                <label className={lbl}>Profile URL</label>
                <input className={inp} value={form.profile_url || ''} onChange={e => set('profile_url', e.target.value)} placeholder="https://tracker.example.com/profile.php?id=..." />
              </div>
            )}

            {tab === 'cookie' && (
              <div>
                <label className={lbl}>Cookies</label>
                <textarea className={inp + ' min-h-[80px] resize-y'} value={form.manual_cookies || ''} onChange={e => set('manual_cookies', e.target.value)} placeholder="uid=123; pass=abc; cf_clearance=xyz; ..." />
              </div>
            )}

            {tab === 'login' && <>
              <div>
                <label className={lbl}>Login URL</label>
                <input className={inp} value={form.login_url || ''} onChange={e => set('login_url', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Username</label>
                <input className={inp} value={form.username || ''} onChange={e => set('username', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Password</label>
                <input className={inp} type="password" value={form.password || ''} onChange={e => set('password', e.target.value)} />
              </div>
            </>}

            {tab === 'api' && <>
              <div>
                <label className={lbl}>API URL</label>
                <input className={inp} value={form.api_url || ''} onChange={e => set('api_url', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>API key / Passkey</label>
                <input className={inp} value={form.api_key || ''} onChange={e => set('api_key', e.target.value)} />
              </div>
            </>}

            <div>
              <label className={lbl}>Ratio threshold</label>
              <input className={inp} type="number" step="0.1" min="0" value={form.threshold} onChange={e => set('threshold', parseFloat(e.target.value))} />
            </div>

            {tracker?.prowlarr_id && (
              <div className="border-t border-[var(--border)] pt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className={lbl} style={{ marginBottom: 0 }}>Prowlarr priority</label>
                  <button onClick={async () => { setSyncing(true); await onSyncPriority(); setSyncing(false) }} disabled={syncing}
                    className="text-[10px] text-accent border border-accent/30 px-2 py-0.5 rounded hover:bg-accent/10 disabled:opacity-50">
                    {syncing ? 'Syncing...' : 'Sync to Prowlarr'}
                  </button>
                </div>
                <input className={inp} type="number" min="1" max="100" step="1"
                  value={form.prowlarr_priority ?? ''}
                  onChange={e => set('prowlarr_priority', parseInt(e.target.value))}
                  placeholder="Auto-calculated (1-100)" />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
            <button onClick={onClose} className="px-4 py-2 text-xs border border-[var(--border2)] text-[var(--text2)] rounded-lg hover:text-[var(--text1)]">Cancel</button>
            <button onClick={handleSave} disabled={loading} className="px-5 py-2 text-xs font-bold bg-accent text-black rounded-lg hover:bg-opacity-90 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Trackers({ showToast }) {
  const [trackers, setTrackers] = useState([])
  const [modal, setModal] = useState(null)
  const [checking, setChecking] = useState(new Set())
  const [editingPriority, setEditingPriority] = useState({})
  const [savingPriority, setSavingPriority] = useState(new Set())

  const load = () => api.getTrackers().then(setTrackers).catch(() => {})
  useEffect(() => { load() }, [])

  const handleSave = async (data) => {
    if (data.id) { await api.updateTracker(data.id, data); showToast('Tracker updated') }
    else { await api.createTracker(data); showToast('Tracker added') }
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this tracker?')) return
    await api.deleteTracker(id); showToast('Tracker deleted'); load()
  }

  const handleCheck = async (id) => {
    setChecking(s => new Set(s).add(id))
    try { await api.checkTracker(id); showToast('Check complete'); load() }
    catch (e) { showToast(e.message, 'error') }
    finally { setChecking(s => { const n = new Set(s); n.delete(id); return n }) }
  }

  const handleSyncPriority = async () => {
    try { await api.syncProwlarrPriorities(); showToast('Priorities synced'); load() }
    catch (e) { showToast(e.message, 'error') }
  }

  const handleSavePriority = async (tracker) => {
    const val = editingPriority[tracker.id]
    if (!val || isNaN(val)) return
    setSavingPriority(s => new Set(s).add(tracker.id))
    try {
      await api.updateTracker(tracker.id, { prowlarr_priority: val === '' ? null : parseInt(val) })
      if (tracker.prowlarr_id) await api.syncProwlarrPriorities()
      showToast(`Priority ${val} saved`)
      setEditingPriority(e => { const n = { ...e }; delete n[tracker.id]; return n })
      load()
    } catch (e) { showToast(e.message, 'error') }
    finally { setSavingPriority(s => { const n = new Set(s); n.delete(tracker.id); return n }) }
  }

  const ratioColor = (t) => {
    if (t.current_ratio == null) return 'text-danger'
    if (t.current_ratio < t.threshold) return t.threshold - t.current_ratio < 0.3 ? 'text-warn' : 'text-danger'
    return 'text-accent'
  }

  const prioColor = (p) => {
    if (!p) return 'text-[var(--text3)]'
    if (p <= 20) return 'text-accent'
    if (p <= 35) return 'text-warn'
    return 'text-danger'
  }

  return (
    <div>
      <button onClick={() => setModal('add')}
        className="flex items-center gap-2 text-accent text-xs border border-dashed border-[var(--border2)] px-4 py-2 rounded-lg mb-5 hover:bg-accent/5 transition-colors">
        + Add tracker
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {trackers.map(t => (
          <div key={t.id} className={`bg-bg1 border rounded-xl p-5 transition-colors hover:border-[var(--border2)] ${t.status === 'error' ? 'border-danger/30' : 'border-[var(--border)]'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-[var(--text1)]">{t.name}</p>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  <Badge cls={t.status}>{t.status}</Badge>
                  <Badge cls={t.auth_type}>{t.auth_type}</Badge>
                  {t.prowlarr_id && <Badge cls="api">prowlarr</Badge>}
                </div>
              </div>
            </div>

            <p className={`text-4xl font-bold tracking-tight mb-1 ${ratioColor(t)}`}>
              {t.current_ratio >= 999 ? 'INF' : t.current_ratio?.toFixed(2) ?? 'N/A'}
            </p>

            <div className="flex gap-4 mb-2 flex-wrap">
              <span className="text-[11px] text-[var(--text3)]">UP <span className="text-[var(--text2)]">{t.upload ?? '-'}</span></span>
              <span className="text-[11px] text-[var(--text3)]">DOWN <span className="text-[var(--text2)]">{t.download ?? '-'}</span></span>
            </div>
            <p className="text-[11px] text-[var(--text3)] mb-3">Threshold: <span className="text-[var(--text2)]">{t.threshold.toFixed(1)}</span></p>

            {t.prowlarr_id && (
              <div className="flex items-center gap-2 mb-3 p-2 bg-bg2 rounded-lg border border-[var(--border)]">
                <span className="text-[10px] text-[var(--text3)] uppercase tracking-wider flex-shrink-0">Prowlarr prio</span>
                <input type="number" min="1" max="100"
                  value={editingPriority[t.id] ?? t.prowlarr_priority ?? ''}
                  onChange={e => setEditingPriority(ep => ({ ...ep, [t.id]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSavePriority(t)}
                  placeholder="auto"
                  className={`w-16 bg-transparent border-b text-sm font-bold text-center outline-none transition-colors ${prioColor(editingPriority[t.id] ?? t.prowlarr_priority)} border-[var(--border)]`}
                />
                {editingPriority[t.id] !== undefined && (
                  <button onClick={() => handleSavePriority(t)} disabled={savingPriority.has(t.id)}
                    className="text-[10px] font-bold bg-accent text-black px-2 py-0.5 rounded disabled:opacity-50 flex-shrink-0">
                    {savingPriority.has(t.id) ? '...' : 'Save'}
                  </button>
                )}
                <div className="flex gap-1 ml-auto">
                  {t.prowlarr_priority && (
                    <button onClick={async () => { await api.updateTracker(t.id, { prowlarr_priority: null }); load(); showToast('Set to auto') }}
                      className="text-[9px] text-[var(--text3)] hover:text-danger transition-colors">auto</button>
                  )}
                </div>
              </div>
            )}

            {t.status === 'error' && t.error_reason && (
              <div className="text-[11px] text-danger bg-danger/8 border border-danger/20 rounded-lg px-3 py-2 mb-3">{t.error_reason}</div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => handleCheck(t.id)} disabled={checking.has(t.id)}
                className="text-[11px] text-accent border border-accent/40 px-3 py-1 rounded-md hover:bg-accent/10 disabled:opacity-50 transition-colors">
                {checking.has(t.id) ? 'Checking...' : 'Check now'}
              </button>
              <button onClick={() => setModal(t)} className="text-[11px] text-[var(--text2)] border border-[var(--border2)] px-3 py-1 rounded-md hover:text-[var(--text1)] transition-colors">Edit</button>
              <button onClick={() => handleDelete(t.id)} className="text-[11px] text-[var(--text2)] border border-[var(--border2)] px-3 py-1 rounded-md hover:text-danger hover:border-danger/40 transition-colors">Delete</button>
              <span className="text-[10px] text-[var(--text3)] ml-auto">
                {t.last_checked ? new Date(t.last_checked).toLocaleString() : 'Never'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {(modal === 'add' || (modal && typeof modal === 'object')) && (
        <TrackerModal
          tracker={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onSyncPriority={handleSyncPriority}
        />
      )}
    </div>
  )
}
