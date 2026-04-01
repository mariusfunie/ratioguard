import React, { useState, useEffect } from 'react'
import { api } from '../hooks/api'

const STATUS_COLOR = {
  seeding: 'text-accent', downloading: 'text-accent2',
  stopped: 'text-[var(--text3)]', checking: 'text-warn', error: 'text-danger',
}
const PRIORITY_COLOR = {
  high: 'text-warn bg-warn/10 border-warn/25',
  normal: 'text-[var(--text3)] bg-bg3 border-[var(--border)]',
  low: 'text-[var(--text3)] bg-bg3 border-[var(--border)]',
}
const PRIORITY_ICON = { high: '▲', normal: '●', low: '▼' }
const SEVERITY_COLOR = {
  critical: 'border-danger/30 bg-danger/5',
  warning: 'border-warn/30 bg-warn/5',
  good: 'border-accent/30 bg-accent/5',
}
const SEVERITY_TEXT = { critical: 'text-danger', warning: 'text-warn', good: 'text-accent' }

function bytes(gb) {
  if (gb >= 1000) return `${(gb / 1024).toFixed(1)} TB`
  return `${gb} GB`
}

export default function Transmission({ showToast }) {
  const [torrents, setTorrents] = useState([])
  const [stats, setStats] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterTracker, setFilterTracker] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [selected, setSelected] = useState(new Set())
  const [actioning, setActioning] = useState(false)
  const [autoReport, setAutoReport] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [t, s, r] = await Promise.all([
        api.getTransmissionTorrents(),
        api.getTransmissionStats(),
        api.getTransmissionRecommendations(),
      ])
      setTorrents(t); setStats(s); setRecommendations(r)
    } catch (e) { showToast(e.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const trackers = ['all', ...new Set(torrents.map(t => t.tracker_name).filter(Boolean))]
  const filtered = torrents.filter(t => {
    if (filterTracker !== 'all' && t.tracker_name !== filterTracker) return false
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    if (filterPriority !== 'all' && t.bandwidth_priority !== filterPriority) return false
    return true
  })
  const priorityCounts = {
    high: torrents.filter(t => t.bandwidth_priority === 'high').length,
    normal: torrents.filter(t => t.bandwidth_priority === 'normal').length,
    low: torrents.filter(t => t.bandwidth_priority === 'low').length,
  }

  const toggleSelect = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const handleAction = async (action) => {
    if (selected.size === 0) return
    setActioning(true)
    try { await api.transmissionAction([...selected], action); showToast(`${action} applied`); setSelected(new Set()); load() }
    catch (e) { showToast(e.message, 'error') }
    finally { setActioning(false) }
  }

  const handleAuto = async () => {
    setActioning(true)
    try { const r = await api.autoTransmissionPriorities(); setAutoReport(r); showToast(`Auto-set: ${r.high} high, ${r.normal} normal, ${r.low} low`); load() }
    catch (e) { showToast(e.message, 'error') }
    finally { setActioning(false) }
  }

  const handleReset = async () => {
    setActioning(true)
    try { const r = await api.resetTransmissionPriorities(); showToast(`Reset ${r.reset} torrents`); setAutoReport(null); load() }
    catch (e) { showToast(e.message, 'error') }
    finally { setActioning(false) }
  }

  return (
    <div>
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-5">
          {[
            { label: 'Total', val: stats.total_torrent_count, cls: 'text-[var(--text1)]' },
            { label: 'Active', val: stats.active_torrent_count, cls: 'text-accent' },
            { label: 'Paused', val: stats.paused_torrent_count, cls: 'text-[var(--text3)]' },
            { label: 'Upload', val: `${stats.upload_speed_kb} KB/s`, cls: 'text-accent' },
            { label: 'Download', val: `${stats.download_speed_kb} KB/s`, cls: 'text-accent2' },
          ].map(m => (
            <div key={m.label} className="bg-bg1 border border-[var(--border)] rounded-xl p-4">
              <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase mb-2">{m.label}</p>
              <p className={`text-xl font-bold ${m.cls}`}>{m.val}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-5 mb-5">
        {/* Recommendations */}
        <div>
          {recommendations.length > 0 && (
            <>
              <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase mb-3">Recommendations</p>
              <div className="space-y-2">
                {recommendations.map((r, i) => (
                  <div key={i} className={`border rounded-xl p-4 ${SEVERITY_COLOR[r.severity] || 'border-[var(--border)] bg-bg1'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${SEVERITY_TEXT[r.severity] || 'text-[var(--text2)]'}`}>{r.tracker}</p>
                        <p className="text-xs text-[var(--text2)] mt-1">{r.ratio_status}</p>
                        {r.hit_and_run_warning && (
                          <div className="mt-2">
                            <p className="text-xs text-warn">{r.hit_and_run_warning}</p>
                            {r.hit_and_run_torrents?.map((n, j) => <p key={j} className="text-[10px] text-[var(--text3)] truncate mt-0.5">• {n}</p>)}
                          </div>
                        )}
                        {r.stopped_count > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-[var(--text3)]">{r.stopped_count} torrents stopped</p>
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-[var(--text1)]">{r.torrents_count}</p>
                        <p className="text-[10px] text-[var(--text3)]">torrents</p>
                        <p className="text-xs text-accent mt-1">{r.seeding_count} seeding</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Priority management */}
        <div className="bg-bg1 border border-[var(--border)] rounded-xl p-5">
          <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase mb-4">Priority management</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[['high', 'text-warn', 'bg-warn/10 border-warn/25', '▲ High'],
              ['normal', 'text-[var(--text2)]', 'bg-bg2 border-[var(--border)]', '● Normal'],
              ['low', 'text-[var(--text3)]', 'bg-bg2 border-[var(--border)]', '▼ Low']].map(([k, tc, bc, label]) => (
              <div key={k} className={`text-center p-3 border rounded-lg ${bc}`}>
                <p className={`text-xl font-bold ${tc}`}>{priorityCounts[k]}</p>
                <p className="text-[10px] text-[var(--text3)] mt-1">{label}</p>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-[var(--text3)] mb-3 leading-relaxed">
            Auto-set priorities based on ratio:<br/>
            <span className="text-danger">ratio &lt; threshold</span> → high<br/>
            <span className="text-accent">ratio &gt; 3x threshold</span> → low<br/>
            <span className="text-[var(--text2)]">rest</span> → normal
          </div>
          <div className="space-y-2">
            <button onClick={handleAuto} disabled={actioning}
              className="w-full text-xs font-bold bg-accent text-black py-2 rounded-lg hover:bg-opacity-90 disabled:opacity-50">
              {actioning ? 'Setting...' : 'Auto-set priorities'}
            </button>
            <button onClick={handleReset} disabled={actioning}
              className="w-full text-xs border border-[var(--border2)] text-[var(--text2)] py-2 rounded-lg hover:text-[var(--text1)] disabled:opacity-50">
              Reset all to normal
            </button>
          </div>
          {autoReport && (
            <div className="mt-4 border-t border-[var(--border)] pt-3">
              <p className="text-[10px] text-[var(--text3)] uppercase tracking-wider mb-2">Last auto-set report</p>
              <div className="space-y-1 max-h-[160px] overflow-y-auto">
                {autoReport.report.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold w-14 flex-shrink-0 ${r.priority_set === 'high' ? 'text-warn' : r.priority_set === 'low' ? 'text-[var(--text3)]' : 'text-[var(--text2)]'}`}>
                      {PRIORITY_ICON[r.priority_set]} {r.priority_set}
                    </span>
                    <span className="text-[10px] text-[var(--text3)] truncate">{r.torrent}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {[
          [trackers, filterTracker, setFilterTracker, t => t === 'all' ? 'All trackers' : t],
          [['all', 'seeding', 'downloading', 'stopped'], filterStatus, setFilterStatus, s => s === 'all' ? 'All status' : s],
          [['all', 'high', 'normal', 'low'], filterPriority, setFilterPriority, p => p === 'all' ? 'All priorities' : p],
        ].map(([opts, val, setter, label], i) => (
          <select key={i} className="bg-bg2 border border-[var(--border)] rounded-lg text-[var(--text1)] text-xs px-3 py-2 outline-none"
            value={val} onChange={e => setter(e.target.value)}>
            {opts.map(o => <option key={o} value={o}>{label(o)}</option>)}
          </select>
        ))}
        <span className="text-xs text-[var(--text3)]">{filtered.length} torrents</span>
        {selected.size > 0 && (
          <div className="w-full flex gap-2 flex-wrap mt-1">
            <span className="text-xs text-[var(--text2)]">{selected.size} selected</span>
            {['start', 'stop'].map(a => (
              <button key={a} onClick={() => handleAction(a)} disabled={actioning}
                className={`text-xs border px-3 py-1 rounded-lg disabled:opacity-50 ${a === 'start' ? 'text-accent border-accent/30 hover:bg-accent/10' : 'text-[var(--text2)] border-[var(--border2)] hover:text-[var(--text1)]'}`}>
                {a.charAt(0).toUpperCase() + a.slice(1)}
              </button>
            ))}
            {['priority_high', 'priority_normal', 'priority_low'].map(a => (
              <button key={a} onClick={() => handleAction(a)} disabled={actioning}
                className="text-xs text-[var(--text2)] border border-[var(--border2)] px-3 py-1 rounded-lg disabled:opacity-50">
                {a === 'priority_high' ? '▲ High' : a === 'priority_normal' ? '● Normal' : '▼ Low'}
              </button>
            ))}
            <button onClick={() => setSelected(new Set())} className="text-xs text-[var(--text3)] hover:text-[var(--text1)]">Clear</button>
          </div>
        )}
      </div>

      {/* Torrent list */}
      <div className="bg-bg1 border border-[var(--border)] rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="w-8 px-3 py-2" />
              <th className="text-[10px] text-[var(--text3)] uppercase tracking-wider text-left px-2 py-2 font-normal">Name</th>
              <th className="text-[10px] text-[var(--text3)] uppercase tracking-wider text-left px-2 py-2 font-normal">Tracker</th>
              <th className="text-[10px] text-[var(--text3)] uppercase tracking-wider text-center px-2 py-2 font-normal">Prio</th>
              <th className="text-[10px] text-[var(--text3)] uppercase tracking-wider text-right px-2 py-2 font-normal">Ratio</th>
              <th className="text-[10px] text-[var(--text3)] uppercase tracking-wider text-right px-2 py-2 font-normal">Upload</th>
              <th className="text-[10px] text-[var(--text3)] uppercase tracking-wider text-right px-2 py-2 font-normal">Seed h</th>
              <th className="text-[10px] text-[var(--text3)] uppercase tracking-wider text-right px-2 py-2 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="text-center text-[var(--text3)] py-8 text-sm">Loading...</td></tr>}
            {!loading && filtered.map(t => (
              <tr key={t.id} onClick={() => toggleSelect(t.id)}
                className={`border-b border-[var(--border)] last:border-0 cursor-pointer transition-colors ${selected.has(t.id) ? 'bg-accent/10' : 'hover:bg-bg2/50'}`}>
                <td className="px-3 py-2.5">
                  <div className={`w-3 h-3 rounded border ${selected.has(t.id) ? 'bg-accent border-accent' : 'border-[var(--border2)]'}`} />
                </td>
                <td className="px-2 py-2.5 max-w-[200px]">
                  <p className="text-xs text-[var(--text1)] truncate">{t.name}</p>
                </td>
                <td className="px-2 py-2.5"><span className="text-xs text-[var(--text2)]">{t.tracker_name || '-'}</span></td>
                <td className="px-2 py-2.5 text-center">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${PRIORITY_COLOR[t.bandwidth_priority]}`}>
                    {PRIORITY_ICON[t.bandwidth_priority]} {t.bandwidth_priority}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right">
                  <span className={`text-xs font-bold ${t.ratio < 1 ? 'text-danger' : t.ratio < 2 ? 'text-warn' : 'text-accent'}`}>
                    {t.ratio.toFixed(2)}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right"><span className="text-xs text-[var(--text2)]">{bytes(t.uploaded_gb)}</span></td>
                <td className="px-2 py-2.5 text-right"><span className="text-xs text-[var(--text2)]">{t.hours_seeding}h</span></td>
                <td className="px-2 py-2.5 text-right">
                  <span className={`text-xs font-bold ${STATUS_COLOR[t.status] || 'text-[var(--text2)]'}`}>{t.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
