import React, { useState, useEffect } from 'react'
import { api } from '../hooks/api'

export default function Notifications() {
  const [notifs, setNotifs] = useState([])

  useEffect(() => {
    api.getNotifications(100).then(setNotifs).catch(() => {})
  }, [])

  return (
    <div className="max-w-3xl">
      <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase mb-4">Notification history</p>

      {notifs.length === 0 && (
        <p className="text-sm text-[var(--text3)] py-8 text-center">No notifications yet. Alerts will appear here when ratio drops below threshold.</p>
      )}

      <div className="space-y-2">
        {notifs.map((n, i) => (
          <div key={i} className="flex items-center gap-4 bg-bg1 border border-[var(--border)] rounded-xl px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-danger/10 border border-danger/25 flex items-center justify-center text-danger font-bold text-sm flex-shrink-0">!</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[var(--text1)]">{n.tracker_name}</p>
              <p className="text-[11px] text-[var(--text3)]">{n.message} &middot; {new Date(n.sent_at).toLocaleString()}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-[10px] text-danger bg-danger/10 border border-danger/25 px-2 py-0.5 rounded font-bold">
                {n.ratio?.toFixed(2)} / {n.threshold}
              </span>
              <p className="text-[10px] text-[var(--text3)] mt-1">{n.discord_sent ? 'Discord sent' : 'Discord failed'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
