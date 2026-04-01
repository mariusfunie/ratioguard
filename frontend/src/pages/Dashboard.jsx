import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { api } from '../hooks/api'

const COLORS = ['#00e5c0', '#00aaff', '#f4a261', '#a78bfa', '#ff4d6d', '#34d399', '#fbbf24', '#60a5fa']

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
  const [chartData, setChartData] = useState([])
  const [indexerStats, setIndexerStats] = useState({})

  useEffect(() => {
    api.getDashboardStats().then(setStats).catch(() => {})
    api.getTrackers().then(t => {
      setTrackers(t)
      Promise.all(
        t.map(tracker =>
          api.getRatioHistory(tracker.id, 30)
            .then(h => ({ id: tracker.id, name: tracker.name, data: h }))
            .catch(() => ({ id: tracker.id, name: tracker.name, data: [] }))
        )
      ).then(results => {
        const maxDays = Math.max(...results.map(r => r.data.length), 1)
        const combined = []
        for (let i = 0; i < maxDays; i++) {
          const point = { day: i + 1 }
          results.forEach(r => { if (r.data[i]) point[r.name] = r.data[i].ratio })
          combined.push(point)
        }
        setChartData(combined)
      })
    }).catch(() => {})
    api.getIndexerStats().then(setIndexerStats).catch(() => {})
  }, [])

  const privateTrackers = trackers.filter(t => t.prowlarr_id)

  const metrics = [
    { label: 'Total', val: stats.total, cls: 'text-[var(--text1)]' },
    { label: 'Healthy', val: stats.healthy, cls: 'text-accent' },
    { label: 'Warning', val: stats.warning, cls: 'text-warn' },
    { label: 'Error', val: stats.error, cls: 'text-danger' },
  ]

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {metrics.map(m => (
          <div key={m.label} className="bg-bg1 border border-[var(--border)] rounded-xl p-4">
            <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase mb-2">{m.label}</p>
            <p className={`text-3xl font-bold tracking-tight ${m.cls}`}>{m.val}</p>
          </div>
        ))}
      </div>

      {/* Chart + latest checks */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-4 mb-5">
        <div className="bg-bg1 border border-[var(--border)] rounded-xl p-5">
          <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase mb-4">Ratio history - all trackers - last 30 days</p>
          <div className="h-[200px] md:h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="day" tick={{ fill: '#484f58', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#484f58', fontSize: 9 }} axisLine={false} tickLine={false} width={35} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                {trackers.map((t, i) => (
                  <Line key={t.id} type="monotone" dataKey={t.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-bg1 border border-[var(--border)] rounded-xl p-5">
          <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase mb-3">Latest checks</p>
          {trackers.slice(0, 6).map(t => (
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

      {/* Prowlarr stats */}
      {privateTrackers.length > 0 && Object.keys(indexerStats).length > 0 && (
        <div className="bg-bg1 border border-[var(--border)] rounded-xl p-5 overflow-x-auto">
          <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase mb-4">Prowlarr indexer activity</p>
          <table className="w-full min-w-[400px]">
            <thead>
              <tr>
                {['Tracker', 'Grabs', 'Queries', 'Failed', 'Avg ms'].map(h => (
                  <th key={h} className="text-[10px] text-[var(--text3)] uppercase tracking-wider text-left pb-2 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {privateTrackers.map(t => {
                const s = indexerStats[t.prowlarr_id]
                if (!s) return null
                return (
                  <tr key={t.id} className="border-t border-[var(--border)] hover:bg-bg2/30 transition-colors">
                    <td className="py-2 text-sm text-[var(--text1)]">{t.name}</td>
                    <td className="py-2 text-sm font-bold text-accent">{s.grabs}</td>
                    <td className="py-2 text-sm text-[var(--text2)]">{s.queries}</td>
                    <td className={`py-2 text-sm ${s.failed_queries > 0 ? 'text-danger' : 'text-[var(--text3)]'}`}>{s.failed_queries}</td>
                    <td className="py-2 text-sm text-[var(--text2)]">{s.avg_response_time}ms</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
