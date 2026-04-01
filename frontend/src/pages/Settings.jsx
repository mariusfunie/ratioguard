import React, { useState, useEffect } from 'react'
import { api } from '../hooks/api'

export default function Settings({ showToast }) {
  const [settings, setSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [checkingProwlarr, setCheckingProwlarr] = useState(false)
  const [prowlarrStatus, setProwlarrStatus] = useState(null)

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => {})
  }, [])

  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      await api.updateSettings(settings)
      showToast('Settings saved')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const testDiscord = async () => {
    setTesting(true)
    try {
      await api.testDiscord()
      showToast('Test notification sent to Discord')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setTesting(false)
    }
  }

  const testProwlarr = async () => {
    setCheckingProwlarr(true)
    try {
      const st = await api.getProwlarrStatus()
      setProwlarrStatus(st)
    } catch (e) {
      setProwlarrStatus({ connected: false, error: e.message })
    } finally {
      setCheckingProwlarr(false)
    }
  }

  const inp = 'flex-1 bg-bg2 border border-[var(--border)] rounded-lg text-[var(--text1)] text-sm px-3 py-2 outline-none focus:border-accent transition-colors font-mono'

  if (!settings) return <p className="text-sm text-[var(--text3)]">Loading...</p>

  return (
    <div className="max-w-2xl space-y-4">

      {/* Discord */}
      <div className="bg-bg1 border border-[var(--border)] rounded-xl p-5">
        <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase mb-4">Discord integration</p>
        <div className="mb-4">
          <label className="block text-xs text-[var(--text2)] mb-2">Webhook URL</label>
          <div className="flex gap-2">
            <input className={inp} type="text" value={settings.discord_webhook_url || ''} onChange={e => set('discord_webhook_url', e.target.value)} placeholder="https://discord.com/api/webhooks/..." />
            <button onClick={testDiscord} disabled={testing} className="text-xs border border-[var(--border2)] text-accent px-4 py-2 rounded-lg hover:bg-accent/10 disabled:opacity-50 transition-colors whitespace-nowrap">
              {testing ? 'Sending...' : 'Test'}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between py-3 border-t border-[var(--border)]">
          <div>
            <p className="text-sm text-[var(--text1)]">Notifications enabled</p>
            <p className="text-xs text-[var(--text3)]">Send Discord alerts when ratio drops below threshold</p>
          </div>
          <label className="relative w-10 h-6 flex-shrink-0">
            <input type="checkbox" className="sr-only" checked={settings.notifications_enabled} onChange={e => set('notifications_enabled', e.target.checked)} />
            <div className={`absolute inset-0 rounded-full transition-colors ${settings.notifications_enabled ? 'bg-accent' : 'bg-bg3'}`} />
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${settings.notifications_enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </label>
        </div>
      </div>

      {/* Prowlarr */}
      <div className="bg-bg1 border border-[var(--border)] rounded-xl p-5">
        <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase mb-4">Prowlarr connection</p>
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs text-[var(--text2)] mb-2">Prowlarr URL</label>
            <input className={inp + ' w-full'} type="text" value={settings.prowlarr_url || ''} onChange={e => set('prowlarr_url', e.target.value)} placeholder="http://prowlarr:9696 or http://192.168.1.x:9696" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text2)] mb-2">API Key</label>
            <div className="flex gap-2">
              <input className={inp} type="text" value={settings.prowlarr_api_key || ''} onChange={e => set('prowlarr_api_key', e.target.value)} placeholder="Found in Prowlarr Settings > General" />
              <button onClick={testProwlarr} disabled={checkingProwlarr} className="text-xs border border-[var(--border2)] text-accent px-4 py-2 rounded-lg hover:bg-accent/10 disabled:opacity-50 transition-colors whitespace-nowrap">
                {checkingProwlarr ? 'Testing...' : 'Test'}
              </button>
            </div>
            {prowlarrStatus && (
              <p className={`text-xs mt-2 ${prowlarrStatus.connected ? 'text-accent' : 'text-danger'}`}>
                {prowlarrStatus.connected
                  ? `Connected: ${prowlarrStatus.instance_name} v${prowlarrStatus.version}`
                  : `Error: ${prowlarrStatus.error}`}
              </p>
            )}
          </div>
        </div>
        <p className="text-xs text-[var(--text3)]">
          After saving, go to the <span className="text-[var(--text2)]">Prowlarr</span> tab to view and sync indexers.
        </p>
      </div>

      {/* Schedule */}
      <div className="bg-bg1 border border-[var(--border)] rounded-xl p-5">
        <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase mb-4">Check schedule</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[var(--text1)]">Auto-check interval</p>
            <p className="text-xs text-[var(--text3)]">How often to check all trackers automatically</p>
          </div>
          <select
            className="bg-bg2 border border-[var(--border)] rounded-lg text-[var(--text1)] text-sm px-3 py-2 outline-none focus:border-accent"
            value={settings.check_interval_hours}
            onChange={e => set('check_interval_hours', parseInt(e.target.value))}
          >
            <option value={6}>Every 6 hours</option>
            <option value={12}>Every 12 hours</option>
            <option value={24}>Every 24 hours</option>
            <option value={48}>Every 48 hours</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="text-sm font-bold bg-accent text-black px-6 py-2.5 rounded-lg hover:bg-opacity-90 disabled:opacity-50 transition-colors">
          {saving ? 'Saving...' : 'Save all settings'}
        </button>
      </div>
    </div>
  )
}
