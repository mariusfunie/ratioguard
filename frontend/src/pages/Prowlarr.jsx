import React, { useState, useEffect } from 'react'
import { api } from '../hooks/api'

export default function Prowlarr({ showToast }) {
  const [indexers, setIndexers] = useState([])
  const [unlinked, setUnlinked] = useState([])
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)
  const [assigning, setAssigning] = useState(null) // prowlarr_id pt care se face assign

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [idx, st, ul] = await Promise.all([
        api.getProwlarrIndexers(),
        api.getProwlarrStatus(),
        api.getUnlinkedTrackers(),
      ])
      setIndexers(idx)
      setStatus(st)
      setUnlinked(ul)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSyncPriorities = async () => {
    setSyncing(true)
    try {
      const result = await api.syncProwlarrPriorities()
      showToast(`Priorities synced: ${result.updated} updated, ${result.skipped} unchanged`)
      load()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setSyncing(false)
    }
  }

  const handleAssign = async (prowlarrId, trackerId) => {
    try {
      await api.assignProwlarrId(prowlarrId, trackerId)
      showToast('Linked successfully')
      load()
    } catch (e) {
      showToast(e.message, 'error')
    }
    setAssigning(null)
  }

  const handleUnassign = async (trackerId) => {
    try {
      await api.unassignProwlarrId(trackerId)
      showToast('Unlinked')
      load()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const privacyColor = (p) => {
    if (p === 'private') return 'text-accent border-accent/25 bg-accent/10'
    if (p === 'semiPublic') return 'text-warn border-warn/25 bg-warn/10'
    return 'text-[var(--text3)] border-[var(--border)] bg-bg3'
  }

  const ratioColor = (r) => {
    if (r === null || r === undefined) return 'text-[var(--text3)]'
    if (r >= 999) return 'text-accent'
    if (r >= 2) return 'text-accent'
    if (r >= 1) return 'text-warn'
    return 'text-danger'
  }

  const ratioLabel = (r) => {
    if (r === null || r === undefined) return '-'
    if (r >= 999) return 'INF'
    return r.toFixed(2)
  }

  const prioColor = (p) => {
    if (!p) return 'text-[var(--text2)]'
    if (p <= 20) return 'text-accent'
    if (p <= 35) return 'text-warn'
    return 'text-danger'
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-sm font-bold text-[var(--text1)] mb-1">Prowlarr - priority management</h1>
          {status && (
            <p className={`text-xs ${status.connected ? 'text-accent' : 'text-danger'}`}>
              {status.connected
                ? `Connected - ${status.instance_name} v${status.version}`
                : `Disconnected: ${status.error}`}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="text-xs border border-[var(--border2)] text-[var(--text2)] px-4 py-2 rounded-lg hover:text-[var(--text1)] transition-colors">
            Refresh
          </button>
          <button onClick={handleSyncPriorities} disabled={syncing}
            className="text-xs font-bold bg-accent text-black px-4 py-2 rounded-lg hover:bg-opacity-90 disabled:opacity-50 transition-colors">
            {syncing ? 'Syncing...' : 'Sync priorities now'}
          </button>
        </div>
      </div>

      <div className="bg-bg1 border border-[var(--border)] rounded-xl p-4 mb-5">
        <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase mb-2">How it works</p>
        <p className="text-xs text-[var(--text2)] leading-relaxed">
          Link each Prowlarr indexer to a RatioGuard tracker using the dropdown below.
          After linking, RatioGuard will automatically update Prowlarr priorities after each check:
          <span className="text-accent"> high ratio = low priority</span> (downloaded more freely) /
          <span className="text-danger"> low ratio = high priority</span> (downloaded less to protect standing).
        </p>
      </div>

      {error && (
        <div className="bg-danger/8 border border-danger/25 rounded-xl p-4 mb-5 text-sm text-danger">
          {error}
          <p className="text-xs text-[var(--text3)] mt-1">Make sure Prowlarr URL and API key are configured in Settings.</p>
        </div>
      )}

      <div className="bg-bg1 border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)] grid grid-cols-[1fr_70px_80px_60px_80px_200px] gap-3 items-center">
          <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase">Indexer (Prowlarr)</p>
          <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase">Privacy</p>
          <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase text-center">Priority</p>
          <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase text-right">Ratio</p>
          <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase text-center">Status</p>
          <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase">Linked tracker</p>
        </div>

        {loading && (
          <div className="px-5 py-8 text-center text-[var(--text3)] text-sm">Loading...</div>
        )}

        {!loading && indexers.filter(i => i.privacy === 'private').map(idx => (
          <div key={idx.id} className="px-5 py-3 border-b border-[var(--border)] last:border-0 grid grid-cols-[1fr_70px_80px_60px_80px_200px] gap-3 items-center hover:bg-bg2/30 transition-colors">
            <div className="min-w-0">
              <p className="text-sm text-[var(--text1)] truncate">{idx.name}</p>
            </div>
            <div>
              <span className={`text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded border ${privacyColor(idx.privacy)}`}>
                {idx.privacy}
              </span>
            </div>
            <div className="text-center">
              <span className={`text-sm font-bold ${prioColor(idx.priority)}`}>
                {idx.priority ?? '-'}
              </span>
            </div>
            <div className="text-right">
              <span className={`text-sm font-bold ${ratioColor(idx.linked?.current_ratio)}`}>
                {ratioLabel(idx.linked?.current_ratio)}
              </span>
            </div>
            <div className="text-center">
              {idx.linked ? (
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                  idx.linked.status === 'online' ? 'text-accent border-accent/25 bg-accent/10'
                  : idx.linked.status === 'error' ? 'text-danger border-danger/25 bg-danger/10'
                  : 'text-[var(--text3)] border-[var(--border)] bg-bg3'
                }`}>
                  {idx.linked.status}
                </span>
              ) : (
                <span className="text-[var(--text3)] text-xs">-</span>
              )}
            </div>
            <div>
              {idx.linked ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-accent truncate flex-1">{idx.linked.tracker_name}</span>
                  <button
                    onClick={() => handleUnassign(idx.linked.tracker_id)}
                    className="text-[10px] text-[var(--text3)] hover:text-danger transition-colors flex-shrink-0"
                  >
                    unlink
                  </button>
                </div>
              ) : assigning === idx.id ? (
                <div className="flex items-center gap-2">
                  <select
                    className="flex-1 bg-bg2 border border-accent/40 rounded text-[var(--text1)] text-xs px-2 py-1 outline-none"
                    defaultValue=""
                    onChange={e => e.target.value && handleAssign(idx.id, e.target.value)}
                  >
                    <option value="">Select tracker...</option>
                    {unlinked.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button onClick={() => setAssigning(null)} className="text-[10px] text-[var(--text3)] hover:text-[var(--text1)]">cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setAssigning(idx.id)}
                  className="text-[10px] text-accent border border-accent/30 px-2 py-1 rounded hover:bg-accent/10 transition-colors"
                >
                  + Link tracker
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
