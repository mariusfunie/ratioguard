import React, { useState, useEffect } from 'react'
import { api } from '../hooks/api'

const STATUS_COLOR = {
  seeding: 'text-accent',
  downloading: 'text-accent2',
  stopped: 'text-[var(--text3)]',
  checking: 'text-warn',
  error: 'text-danger',
}

const PRIORITY_COLOR = {
  high: 'text-warn bg-warn/10 border-warn/25',
  normal: 'text-[var(--text3)] bg-bg3 border-[var(--border)]',
  low: 'text-[var(--text3)] bg-bg3 border-[var(--border)]',
}

const PRIORITY_ICON = {
  high: '▲',
  normal: '●',
  low: '▼',
}

const SEVERITY_COLOR = {
  critical: 'border-danger/30 bg-danger/5',
  warning: 'border-warn/30 bg-warn/5',
  good: 'border-accent/30 bg-accent/5',
}

const SEVERITY_TEXT = {
  critical: 'text-danger',
  warning: 'text-warn',
  good: 'text-accent',
}

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
      setTorrents(t)
      setStats(s)
      setRecommendations(r)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
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

  const toggleSelect = (id) => {
    setSelected(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const handleAction = async (action) => {
    if (selected.size === 0) return
    setActioning(true)
    try {
      await api.transmissionAction([...selected], action)
      showToast(`${action} applied to ${selected.size} torrent(s)`)
      setSelected(new Set())
      load()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setActioning(false)
    }
  }

  const handleAutoPriorities = async () => {
    setActioning(true)
    try {
      const result = await api.autoTransmissionPriorities()
      setAutoReport(result)
      showToast(`Auto-set: ${result.high} high, ${result.normal} normal, ${result.low} low`)
      load()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setActioning(false)
    }
  }

  const handleResetPriorities = async () => {
    setActioning(true)
    try {
      const result = await api.resetTransmissionPriorities()
      showToast(`Reset ${result.reset} torrents to normal priority`)
      setAutoReport(null)
      load()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setActioning(false)
    }
  }

  return (
    <div>
      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-5 gap-3 mb-5">
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

      <div className="grid grid-cols-[1fr_300px] gap-5 mb-5">
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
                            {r.hit_and_run_torrents?.map((name, j) => (
                              <p key={j} className="text-[10px] text-[var(--text3)] truncate mt-0.5">• {name}</p>
                            ))}
                          </div>
                        )}
                        {r.stopped_count > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-[var(--text3)]">{r.stopped_count} torrente oprite</p>
                            {r.stopped_torrents?.map((name, j) => (
                              <p key={j} className="text-[10px] text-[var(--text3)] truncate mt-0.5">• {name}</p>
                            ))}
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

        {/* Priority controls */}
        <div className="bg-bg1 border border-[var(--border)] rounded-xl p-5">
          <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase mb-4">Priority management</p>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center p-3 bg-warn/10 border border-warn/25 rounded-lg">
              <p className="text-xl font-bold text-warn">{priorityCounts.high}</p>
              <p className="text-[10px] text-[var(--text3)] mt-1">▲ High</p>
            </div>
            <div className="text-center p-3 bg-bg2 border border-[var(--border)] rounded-lg">
              <p className="text-xl font-bold text-[var(--text2)]">{priorityCounts.normal}</p>
              <p className="text-[10px] text-[var(--text3)] mt-1">● Normal</p>
            </div>
            <div className="text-center p-3 bg-bg2 border border-[var(--border)] rounded-lg">
              <p className="text-xl font-bold text-[var(--text3)]">{priorityCounts.low}</p>
              <p className="text-[10px] text-[var(--text3)] mt-1">▼ Low</p>
            </div>
          </div>

          <div className="text-[10px] text-[var(--text3)] mb-3 leading-relaxed">
            Auto-set seteaza prioritati bazat pe ratio:<br/>
            <span className="text-danger">ratio &lt; threshold</span> → high priority<br/>
            <span className="text-accent">ratio &gt; 3x threshold</span> → low priority<br/>
            <span className="text-[var(--text2)]">restul</span> → normal
          </div>

          <div className="space-y-2">
            <button
              onClick={handleAutoPriorities}
              disabled={actioning}
              className="w-full text-xs font-bold bg-accent text-black py-2 rounded-lg hover:bg-opacity-90 disabled:opacity-50 transition-colors"
            >
              {actioning ? 'Setting...' : 'Auto-set priorities'}
            </button>
            <button
              onClick={handleResetPriorities}
              disabled={actioning}
              className="w-full text-xs border border-[var(--border2)] text-[var(--text2)] py-2 rounded-lg hover:text-[var(--text1)] disabled:opacity-50 transition-colors"
            >
              Reset all to normal
            </button>
          </div>

          {/* Auto report */}
          {autoReport && (
            <div className="mt-4 border-t border-[var(--border)] pt-3">
              <p className="text-[10px] text-[var(--text3)] uppercase tracking-wider mb-2">Last auto-set report</p>
              <div className="space-y-1 max-h-[160px] overflow-y-auto">
                {autoReport.report.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold w-12 flex-shrink-0 ${
                      r.priority_set === 'high' ? 'text-warn' :
                      r.priority_set === 'low' ? 'text-[var(--text3)]' : 'text-[var(--text2)]'
                    }`}>
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

      {/* Filters + bulk actions */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select className="bg-bg2 border border-[var(--border)] rounded-lg text-[var(--text1)] text-xs px-3 py-2 outline-none"
          value={filterTracker} onChange={e => setFilterTracker(e.target.value)}>
          {trackers.map(t => <option key={t} value={t}>{t === 'all' ? 'All trackers' : t}</option>)}
        </select>
        <select className="bg-bg2 border border-[var(--border)] rounded-lg text-[var(--text1)] text-xs px-3 py-2 outline-none"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          {['all', 'seeding', 'downloading', 'stopped'].map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All status' : s}</option>
          ))}
        </select>
        <select className="bg-bg2 border border-[var(--border)] rounded-lg text-[var(--text1)] text-xs px-3 py-2 outline-none"
          value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          {['all', 'high', 'normal', 'low'].map(p => (
            <option key={p} value={p}>{p === 'all' ? 'All priorities' : p}</option>
          ))}
        </select>
        <span className="text-xs text-[var(--text3)]">{filtered.length} torrents</span>

        {selected.size > 0 && (
          <div className="ml-auto flex gap-2 flex-wrap">
            <span className="text-xs text-[var(--text2)]">{selected.size} selected</span>
            <button onClick={() => handleAction('start')} disabled={actioning}
              className="text-xs text-accent border border-accent/30 px-3 py-1 rounded-lg hover:bg-accent/10 disabled:opacity-50">Start</button>
            <button onClick={() => handleAction('stop')} disabled={actioning}
              className="text-xs text-[var(--text2)] border border-[var(--border2)] px-3 py-1 rounded-lg hover:text-[var(--text1)] disabled:opacity-50">Stop</button>
            <button onClick={() => handleAction('priority_high')} disabled={actioning}
              className="text-xs text-warn border border-warn/30 px-3 py-1 rounded-lg hover:bg-warn/10 disabled:opacity-50">▲ High</button>
            <button onClick={() => handleAction('priority_normal')} disabled={actioning}
              className="text-xs text-[var(--text2)] border border-[var(--border2)] px-3 py-1 rounded-lg disabled:opacity-50">● Normal</button>
            <button onClick={() => handleAction('priority_low')} disabled={actioning}
              className="text-xs text-[var(--text3)] border border-[var(--border2)] px-3 py-1 rounded-lg disabled:opacity-50">▼ Low</button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-[var(--text3)] hover:text-[var(--text1)]">Clear</button>
          </div>
        )}
      </div>

      {/* Torrent list */}
      <div className="bg-bg1 border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[24px_1fr_90px_60px_80px_80px_70px_70px] gap-2 px-4 py-2 border-b border-[var(--border)]">
          <div />
          <p className="text-[10px] text-[var(--text3)] uppercase tracking-wider">Name</p>
          <p className="text-[10px] text-[var(--text3)] uppercase tracking-wider">Tracker</p>
          <p className="text-[10px] text-[var(--text3)] uppercase tracking-wider text-center">Prio</p>
          <p className="text-[10px] text-[var(--text3)] uppercase tracking-wider text-right">Ratio</p>
          <p className="text-[10px] text-[var(--text3)] uppercase tracking-wider text-right">Upload</p>
          <p className="text-[10px] text-[var(--text3)] uppercase tracking-wider text-right">Seed h</p>
          <p className="text-[10px] text-[var(--text3)] uppercase tracking-wider text-right">Status</p>
        </div>

        {loading && <p className="text-center text-[var(--text3)] py-8 text-sm">Loading...</p>}

        {!loading && filtered.map(t => (
          <div key={t.id} onClick={() => toggleSelect(t.id)}
            className={`grid grid-cols-[24px_1fr_90px_60px_80px_80px_70px_70px] gap-2 px-4 py-2.5 border-b border-[var(--border)] last:border-0 cursor-pointer transition-colors ${
              selected.has(t.id) ? 'bg-accent/10' : 'hover:bg-bg2/50'
            }`}
          >
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded border flex-shrink-0 ${selected.has(t.id) ? 'bg-accent border-accent' : 'border-[var(--border2)]'}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[var(--text1)] truncate">{t.name}</p>
              {t.has_error && <p className="text-[10px] text-danger truncate">{t.error_string}</p>}
            </div>
            <div>
              <span className="text-xs text-[var(--text2)]">{t.tracker_name || '-'}</span>
            </div>
            <div className="flex justify-center">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${PRIORITY_COLOR[t.bandwidth_priority]}`}>
                {PRIORITY_ICON[t.bandwidth_priority]} {t.bandwidth_priority}
              </span>
            </div>
            <div className="text-right">
              <span className={`text-xs font-bold ${t.ratio < 1 ? 'text-danger' : t.ratio < 2 ? 'text-warn' : 'text-accent'}`}>
                {t.ratio.toFixed(2)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-[var(--text2)]">{bytes(t.uploaded_gb)}</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-[var(--text2)]">{t.hours_seeding}h</span>
            </div>
            <div className="text-right">
              <span className={`text-xs font-bold ${STATUS_COLOR[t.status] || 'text-[var(--text2)]'}`}>
                {t.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
