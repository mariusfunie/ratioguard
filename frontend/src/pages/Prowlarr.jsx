import React, { useState, useEffect } from 'react'
import { api } from '../hooks/api'

export default function Prowlarr({ showToast }) {
  const [indexers, setIndexers] = useState([])
  const [unlinked, setUnlinked] = useState([])
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)
  const [assigning, setAssigning] = useState(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const [idx, st, ul] = await Promise.all([
        api.getProwlarrIndexers(), api.getProwlarrStatus(), api.getUnlinkedTrackers(),
      ])
      setIndexers(idx); setStatus(st); setUnlinked(ul)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSync = async () => {
    setSyncing(true)
    try { const r = await api.syncProwlarrPriorities(); showToast(`Priorities synced: ${r.updated} updated`); load() }
    catch (e) { showToast(e.message, 'error') }
    finally { setSyncing(false) }
  }

  const handleAssign = async (prowlarrId, trackerId) => {
    try { await api.assignProwlarrId(prowlarrId, trackerId); showToast('Linked'); load() }
    catch (e) { showToast(e.message, 'error') }
    setAssigning(null)
  }

  const handleUnassign = async (trackerId) => {
    try { await api.unassignProwlarrId(trackerId); showToast('Unlinked'); load() }
    catch (e) { showToast(e.message, 'error') }
  }

  const prioColor = (p) => !p ? 'text-[var(--text2)]' : p <= 20 ? 'text-accent' : p <= 35 ? 'text-warn' : 'text-danger'
  const ratioColor = (r) => r == null ? 'text-[var(--text3)]' : r >= 2 ? 'text-accent' : r >= 1 ? 'text-warn' : 'text-danger'

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-sm font-bold text-[var(--text1)] mb-1">Prowlarr - priority management</h1>
          {status && (
            <p className={`text-xs ${status.connected ? 'text-accent' : 'text-danger'}`}>
              {status.connected ? `Connected - ${status.instance_name} v${status.version}` : `Disconnected: ${status.error}`}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="text-xs border border-[var(--border2)] text-[var(--text2)] px-4 py-2 rounded-lg hover:text-[var(--text1)] transition-colors">Refresh</button>
          <button onClick={handleSync} disabled={syncing}
            className="text-xs font-bold bg-accent text-black px-4 py-2 rounded-lg hover:bg-opacity-90 disabled:opacity-50 transition-colors">
            {syncing ? 'Syncing...' : 'Sync priorities now'}
          </button>
        </div>
      </div>

      <div className="bg-bg1 border border-[var(--border)] rounded-xl p-4 mb-5">
        <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase mb-2">How it works</p>
        <p className="text-xs text-[var(--text2)] leading-relaxed">
          Link each Prowlarr indexer to a RatioGuard tracker below.
          After linking, priorities update automatically after each check:
          <span className="text-accent"> high ratio = low priority</span> /
          <span className="text-danger"> low ratio = high priority</span>.
        </p>
      </div>

      {error && (
        <div className="bg-danger/8 border border-danger/25 rounded-xl p-4 mb-5 text-sm text-danger">
          {error}
          <p className="text-xs text-[var(--text3)] mt-1">Make sure Prowlarr URL and API key are configured in Settings.</p>
        </div>
      )}

      <div className="bg-bg1 border border-[var(--border)] rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {['Indexer', 'Priority', 'Ratio', 'Status', 'Linked tracker'].map(h => (
                <th key={h} className="text-[10px] text-[var(--text3)] uppercase tracking-wider text-left px-4 py-3 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="text-center text-[var(--text3)] py-8 text-sm">Loading...</td></tr>}
            {!loading && indexers.filter(i => i.privacy === 'private').map(idx => (
              <tr key={idx.id} className="border-b border-[var(--border)] last:border-0 hover:bg-bg2/30 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-sm text-[var(--text1)] truncate max-w-[160px]">{idx.name}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-bold ${prioColor(idx.priority)}`}>{idx.priority ?? '-'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-bold ${ratioColor(idx.linked?.current_ratio)}`}>
                    {idx.linked?.current_ratio == null ? '-' : idx.linked.current_ratio >= 999 ? 'INF' : idx.linked.current_ratio.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {idx.linked ? (
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                      idx.linked.status === 'online' ? 'text-accent border-accent/25 bg-accent/10'
                      : idx.linked.status === 'error' ? 'text-danger border-danger/25 bg-danger/10'
                      : 'text-[var(--text3)] border-[var(--border)] bg-bg3'
                    }`}>{idx.linked.status}</span>
                  ) : <span className="text-[var(--text3)] text-xs">-</span>}
                </td>
                <td className="px-4 py-3">
                  {idx.linked ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-accent truncate max-w-[120px]">{idx.linked.tracker_name}</span>
                      <button onClick={() => handleUnassign(idx.linked.tracker_id)}
                        className="text-[10px] text-[var(--text3)] hover:text-danger flex-shrink-0">unlink</button>
                    </div>
                  ) : assigning === idx.id ? (
                    <div className="flex items-center gap-2">
                      <select className="flex-1 bg-bg2 border border-accent/40 rounded text-[var(--text1)] text-xs px-2 py-1 outline-none min-w-0"
                        defaultValue="" onChange={e => e.target.value && handleAssign(idx.id, e.target.value)}>
                        <option value="">Select...</option>
                        {unlinked.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <button onClick={() => setAssigning(null)} className="text-[10px] text-[var(--text3)] hover:text-[var(--text1)] flex-shrink-0">cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setAssigning(idx.id)}
                      className="text-[10px] text-accent border border-accent/30 px-2 py-1 rounded hover:bg-accent/10 transition-colors whitespace-nowrap">
                      + Link tracker
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
