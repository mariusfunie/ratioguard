import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { api } from '../hooks/api'

const COLORS = ['#00e5c0', '#00aaff', '#f4a261', '#a78bfa', '#ff4d6d', '#34d399', '#fbbf24', '#60a5fa']

function GaugeSvg({ ratio, threshold }) {
  const maxR = Math.max(threshold * 2.5, (ratio || 0) * 1.2, 3)
  const angle = ratio != null ? Math.min(ratio / maxR, 1) : 0
  const cx = 100, cy = 100, r = 78
  const startAngle = Math.PI
  const endAngle = Math.PI + angle * Math.PI
  const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle)
  const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle)
  const la = angle > 0.5 ? 1 : 0
  const threshAngle = Math.min(threshold / maxR, 1)
  const tx = cx + r * Math.cos(Math.PI + threshAngle * Math.PI)
  const ty = cy + r * Math.sin(Math.PI + threshAngle * Math.PI)
  const color = ratio == null ? '#484f58' : ratio < threshold ? '#ff4d6d' : '#00e5c0'
  return (
    <svg viewBox="0 0 200 110" className="w-[200px] h-[110px]">
      <path d={`M${x1},${y1} A${r},${r} 0 1,1 ${cx + r},${cy}`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" strokeLinecap="round" />
      {ratio != null && <path d={`M${x1},${y1} A${r},${r} 0 ${la},1 ${x2},${y2}`} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" />}
      <circle cx={tx} cy={ty} r="5" fill="rgba(255,77,109,0.8)" stroke="#0d1117" strokeWidth="2" />
    </svg>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg2 border border-[var(--border2)] rounded-lg px-3 py-2 text-xs">
      <p className="text-[var(--text2)] mb-1">Day {label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-bold">
          {p.name}: {p.value?.toFixed(2)}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard({ showToast }) {
  const [stats, setStats] = useState({ total: 0, healthy: 0, warning: 0, error: 0 })
  const [trackers, setTrackers] = useState([])
  const [histories, setHistories] = useState({})
  const [chartData, setChartData] = useState([])
  const [gaugeId, setGaugeId] = useState(null)
  const [indexerStats, setIndexerStats] = useState({})

  useEffect(() => {
    api.getDashboardStats().then(setStats).catch(() => {})
    api.getTrackers().then(t => {
      setTrackers(t)
      if (t.length > 0) setGaugeId(t[0].id)
      // carica history pentru fiecare tracker
      Promise.all(
        t.map(tracker =>
          api.getRatioHistory(tracker.id, 30)
            .then(h => ({ id: tracker.id, name: tracker.name, data: h }))
            .catch(() => ({ id: tracker.id, name: tracker.name, data: [] }))
        )
      ).then(results => {
        // construieste date comune pentru grafic - ziua ca index
        const maxDays = Math.max(...results.map(r => r.data.length), 1)
        const combined = []
        for (let i = 0; i < maxDays; i++) {
          const point = { day: i + 1 }
          results.forEach(r => {
            if (r.data[i]) {
              point[r.name] = r.data[i].ratio
            }
          })
          combined.push(point)
        }
        setChartData(combined)
        const h = {}
        results.forEach(r => { h[r.id] = r.data })
        setHistories(h)
      })
    }).catch(() => {})
    api.getIndexerStats().then(setIndexerStats).catch(() => {})
  }, [])

  const gaugeTracker = trackers.find(t => t.id === gaugeId)
  const privateTrackers = trackers.filter(t => t.prowlarr_id)

  const metrics = [
    { label: 'Total trackers', val: stats.total, cls: 'text-[var(--text1)]' },
    { label: 'Healthy', val: stats.healthy, cls: 'text-accent' },
    { label: 'Warning', val: stats.warning, cls: 'text-warn' },
    { label: 'Offline / error', val: stats.error, cls: 'text-danger' },
  ]

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-6">
        {metrics.map(m => (
          <div key={m.label} className="bg-bg1 border border-[var(--border)] rounded-xl p-4">
            <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase mb-2">{m.label}</p>
            <p className={`text-3xl font-bold tracking-tight ${m.cls}`}>{m.val}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_340px] gap-4 mb-6">
        {/* Grafic toate tracker-ele */}
        <div className="bg-bg1 border border-[var(--border)] rounded-xl p-5">
          <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase mb-4">Ratio history - all trackers - last 30 days</p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="day" tick={{ fill: '#484f58', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#484f58', fontSize: 9 }} axisLine={false} tickLine={false} width={35} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                {trackers.map((t, i) => (
                  <Line
                    key={t.id}
                    type="monotone"
                    dataKey={t.name}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gauge */}
        <div className="bg-bg1 border border-[var(--border)] rounded-xl p-5">
          <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase mb-3">Current ratio</p>
          <select
            className="w-full bg-bg2 border border-[var(--border)] rounded-lg text-[var(--text1)] text-xs px-3 py-2 mb-4 outline-none"
            value={gaugeId || ''}
            onChange={e => setGaugeId(e.target.value)}
          >
            {trackers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <div className="flex flex-col items-center">
            <GaugeSvg ratio={gaugeTracker?.current_ratio ?? null} threshold={gaugeTracker?.threshold ?? 1.0} />
            <p className={`text-3xl font-bold tracking-tight mt-2 ${
              gaugeTracker?.current_ratio == null ? 'text-[var(--text3)]'
              : gaugeTracker.current_ratio < gaugeTracker.threshold ? 'text-danger'
              : 'text-accent'
            }`}>
              {gaugeTracker?.current_ratio >= 999 ? 'INF' : gaugeTracker?.current_ratio?.toFixed(2) ?? 'N/A'}
            </p>
            <p className="text-[11px] text-[var(--text3)] mt-1">
              Threshold: {gaugeTracker?.threshold?.toFixed(1) ?? '1.0'} - {' '}
              {gaugeTracker?.current_ratio == null ? 'UNKNOWN'
                : gaugeTracker.current_ratio < gaugeTracker.threshold ? 'WARNING'
                : 'HEALTHY'}
            </p>
          </div>

          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase mb-3">Latest checks</p>
            {trackers.slice(0, 5).map(t => (
              <div key={t.id} className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.status === 'error' ? 'bg-danger' : 'bg-accent'}`} />
                <span className="text-sm text-[var(--text1)] flex-1 truncate">{t.name}</span>
                <span className={`text-sm font-bold ${
                  t.current_ratio == null ? 'text-danger'
                  : t.current_ratio < t.threshold ? 'text-warn'
                  : 'text-accent'
                }`}>
                  {t.current_ratio >= 999 ? 'INF' : t.current_ratio?.toFixed(2) ?? 'ERR'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Prowlarr stats */}
      {privateTrackers.length > 0 && Object.keys(indexerStats).length > 0 && (
        <div className="bg-bg1 border border-[var(--border)] rounded-xl p-5">
          <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase mb-4">Prowlarr indexer activity</p>
          <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-3 px-2 mb-2">
            <p className="text-[10px] text-[var(--text3)] uppercase tracking-wider">Tracker</p>
            <p className="text-[10px] text-[var(--text3)] uppercase tracking-wider text-right">Grabs</p>
            <p className="text-[10px] text-[var(--text3)] uppercase tracking-wider text-right">Queries</p>
            <p className="text-[10px] text-[var(--text3)] uppercase tracking-wider text-right">Failed</p>
            <p className="text-[10px] text-[var(--text3)] uppercase tracking-wider text-right">Avg ms</p>
          </div>
          {privateTrackers.map(t => {
            const s = indexerStats[t.prowlarr_id]
            if (!s) return null
            return (
              <div key={t.id} className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-3 px-2 py-2 border-t border-[var(--border)] hover:bg-bg2/30 transition-colors">
                <span className="text-sm text-[var(--text1)]">{t.name}</span>
                <span className="text-sm font-bold text-accent text-right">{s.grabs}</span>
                <span className="text-sm text-[var(--text2)] text-right">{s.queries}</span>
                <span className={`text-sm text-right ${s.failed_queries > 0 ? 'text-danger' : 'text-[var(--text3)]'}`}>{s.failed_queries}</span>
                <span className="text-sm text-[var(--text2)] text-right">{s.avg_response_time}ms</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
