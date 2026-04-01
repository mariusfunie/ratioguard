import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import Trackers from './pages/Trackers'
import Prowlarr from './pages/Prowlarr'
import Transmission from './pages/Transmission'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'
import { api } from './hooks/api'

export default function App() {
  const [toast, setToast] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

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
      isActive ? 'text-accent border-accent' : 'text-[var(--text2)] border-transparent hover:text-[var(--text1)]'
    }`

  const mobileNavCls = ({ isActive }) =>
    `block px-4 py-3 text-xs tracking-widest uppercase transition-colors border-l-2 ${
      isActive ? 'text-accent border-accent bg-accent/5' : 'text-[var(--text2)] border-transparent hover:text-[var(--text1)]'
    }`

  const navLinks = [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/trackers', label: 'Trackers' },
    { to: '/prowlarr', label: 'Prowlarr' },
    { to: '/transmission', label: 'Transmission' },
    { to: '/notifications', label: 'Notifications' },
    { to: '/settings', label: 'Settings' },
  ]

  return (
    <div className="min-h-screen bg-bg0">
        <nav className="bg-bg1 border-b border-[var(--border)] sticky top-0 z-50 h-[52px] flex items-center px-4 md:px-5">
          <div className="flex items-center gap-2 mr-6">
            <div className="w-5 h-5 rounded-full border-2 border-accent flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            </div>
            <span className="text-accent font-bold text-sm tracking-tight">RatioGuard</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex h-full">
            {navLinks.map(l => (
              <NavLink key={l.to} to={l.to} end={l.end} className={navCls}>{l.label}</NavLink>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button onClick={checkAll} className="bg-accent text-black text-xs font-bold px-4 py-1.5 rounded-md hover:bg-opacity-90 transition-colors">
              Check All
            </button>
            {/* Mobile hamburger */}
            <button
              className="md:hidden flex flex-col gap-1.5 p-1"
              onClick={() => setMenuOpen(o => !o)}
            >
              <span className={`block w-5 h-0.5 bg-[var(--text2)] transition-all ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block w-5 h-0.5 bg-[var(--text2)] transition-all ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-[var(--text2)] transition-all ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </button>
          </div>
        </nav>

        {/* Mobile menu dropdown */}
        {menuOpen && (
          <div className="md:hidden bg-bg1 border-b border-[var(--border)] z-40">
            {navLinks.map(l => (
              <NavLink key={l.to} to={l.to} end={l.end} className={mobileNavCls} onClick={() => setMenuOpen(false)}>
                {l.label}
              </NavLink>
            ))}
          </div>
        )}

        <main className="max-w-[1200px] mx-auto px-4 md:px-5 py-4 md:py-6">
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
          <div className={`fixed bottom-6 right-4 left-4 md:left-auto md:right-6 md:w-auto px-4 py-3 rounded-lg text-sm border z-[200] transition-all ${
            toast.type === 'error' ? 'bg-bg2 border-red-500/30 text-danger' : 'bg-bg2 border-[var(--border2)] text-accent'
          }`}>
            {toast.msg}
          </div>
        )}
      </div>
  )
}
