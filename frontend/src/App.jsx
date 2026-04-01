import React, { useState } from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Trackers from './pages/Trackers'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'
import Prowlarr from './pages/Prowlarr'
import Transmission from './pages/Transmission'
import { api } from './hooks/api'

export default function App() {
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const checkAll = async () => {
    try {
      showToast('Checking all trackers...')
      await api.checkAll()
      showToast('All trackers checked')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const navCls = ({ isActive }) =>
    `px-4 h-full flex items-center text-xs tracking-widest uppercase transition-colors border-b-2 ${
      isActive
        ? 'text-accent border-accent'
        : 'text-[var(--text2)] border-transparent hover:text-[var(--text1)]'
    }`

  return (
    <div className="min-h-screen bg-bg0">
      <nav className="bg-bg1 border-b border-[var(--border)] sticky top-0 z-50 h-[52px] flex items-center px-5">
        <div className="flex items-center gap-2 mr-8">
          <div className="w-5 h-5 rounded-full border-2 border-accent flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
          </div>
          <span className="text-accent font-bold text-sm tracking-tight">RatioGuard</span>
        </div>

        <div className="flex h-full">
          <NavLink to="/" end className={navCls}>Dashboard</NavLink>
          <NavLink to="/trackers" className={navCls}>Trackers</NavLink>
          <NavLink to="/prowlarr" className={navCls}>Prowlarr</NavLink>
          <NavLink to="/transmission" className={navCls}>Transmission</NavLink>
          <NavLink to="/notifications" className={navCls}>Notifications</NavLink>
          <NavLink to="/settings" className={navCls}>Settings</NavLink>
        </div>

        <div className="ml-auto">
          <button
            onClick={checkAll}
            className="bg-accent text-black text-xs font-bold px-4 py-1.5 rounded-md hover:bg-opacity-90 transition-colors"
          >
            Check All
          </button>
        </div>
      </nav>

      <main className="max-w-[1200px] mx-auto px-5 py-6">
        <Routes>
          <Route path="/" element={<Dashboard showToast={showToast} />} />
          <Route path="/trackers" element={<Trackers showToast={showToast} />} />
          <Route path="/prowlarr" element={<Prowlarr showToast={showToast} />} />
          <Route path="/transmission" element={<Transmission showToast={showToast} />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Settings showToast={showToast} />} />
        </Routes>
      </main>

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg text-sm border z-[200] transition-all ${
          toast.type === 'error'
            ? 'bg-bg2 border-red-500/30 text-danger'
            : 'bg-bg2 border-[var(--border2)] text-accent'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
