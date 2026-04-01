import React, { useState, useEffect, useRef } from 'react'
import { api } from '../hooks/api'

export default function Settings({ showToast }) {
  const [settings, setSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const [testingDiscord, setTestingDiscord] = useState(false)
  const [testingProwlarr, setTestingProwlarr] = useState(false)
  const [testingTransmission, setTestingTransmission] = useState(false)
  const [prowlarrStatus, setProwlarrStatus] = useState(null)
  const [transmissionStatus, setTransmissionStatus] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => { api.getSettings().then(setSettings).catch(() => {}) }, [])

  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try { await api.updateSettings(settings); showToast('Settings saved') }
    catch (e) { showToast(e.message, 'error') }
    finally { setSaving(false) }
  }

  const handleTestDiscord = async () => {
    setTestingDiscord(true)
    try { await api.testDiscord(); showToast('Test notification sent to Discord') }
    catch (e) { showToast(e.message, 'error') }
    finally { setTestingDiscord(false) }
  }

  const handleTestProwlarr = async () => {
    setTestingProwlarr(true)
    try { const r = await api.getProwlarrStatus(); setProwlarrStatus(r) }
    catch (e) { setProwlarrStatus({ connected: false, error: e.message }) }
    finally { setTestingProwlarr(false) }
  }

  const handleTestTransmission = async () => {
    setTestingTransmission(true)
    try { const r = await api.testTransmission(); setTransmissionStatus({ connected: true, torrents: r.torrents }) }
    catch (e) { setTransmissionStatus({ connected: false, error: e.message }) }
    finally { setTestingTransmission(false) }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const data = await api.exportBackup()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ratioguard-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast(`Exported ${data.trackers.length} trackers`)
    } catch (e) { showToast(e.message, 'error') }
    finally { setExporting(false) }
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const result = await api.importBackup(data)
      showToast(`Imported: ${result.added} added, ${result.skipped} skipped`)
    } catch (e) { showToast(e.message, 'error') }
    finally { setImporting(false); e.target.value = '' }
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
            <button onClick={handleTestDiscord} disabled={testingDiscord} className="text-xs border border-[var(--border2)] text-accent px-4 py-2 rounded-lg hover:bg-accent/10 disabled:opacity-50 whitespace-nowrap">
              {testingDiscord ? 'Sending...' : 'Test'}
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
              <button onClick={handleTestProwlarr} disabled={testingProwlarr} className="text-xs border border-[var(--border2)] text-accent px-4 py-2 rounded-lg hover:bg-accent/10 disabled:opacity-50 whitespace-nowrap">
                {testingProwlarr ? 'Testing...' : 'Test'}
              </button>
            </div>
            {prowlarrStatus && (
              <p className={`text-xs mt-2 ${prowlarrStatus.connected ? 'text-accent' : 'text-danger'}`}>
                {prowlarrStatus.connected ? `Connected: ${prowlarrStatus.instance_name} v${prowlarrStatus.version}` : `Error: ${prowlarrStatus.error}`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Transmission */}
      <div className="bg-bg1 border border-[var(--border)] rounded-xl p-5">
        <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase mb-4">Transmission connection</p>
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs text-[var(--text2)] mb-2">URL</label>
            <input className={inp + ' w-full'} type="text" value={settings.transmission_url || ''} onChange={e => set('transmission_url', e.target.value)} placeholder="http://192.168.1.x:9091/transmission/rpc" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text2)] mb-2">Username</label>
              <input className={inp + ' w-full'} type="text" value={settings.transmission_user || ''} onChange={e => set('transmission_user', e.target.value)} placeholder="Leave empty if no auth" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text2)] mb-2">Password</label>
              <input className={inp + ' w-full'} type="password" value={settings.transmission_pass || ''} onChange={e => set('transmission_pass', e.target.value)} placeholder="Leave empty if no auth" />
            </div>
          </div>
          <button onClick={handleTestTransmission} disabled={testingTransmission} className="text-xs border border-[var(--border2)] text-accent px-4 py-2 rounded-lg hover:bg-accent/10 disabled:opacity-50">
            {testingTransmission ? 'Testing...' : 'Test connection'}
          </button>
          {transmissionStatus && (
            <p className={`text-xs ${transmissionStatus.connected ? 'text-accent' : 'text-danger'}`}>
              {transmissionStatus.connected ? `Connected - ${transmissionStatus.torrents} torrents` : `Error: ${transmissionStatus.error}`}
            </p>
          )}
        </div>
      </div>

      {/* Schedule */}
      <div className="bg-bg1 border border-[var(--border)] rounded-xl p-5">
        <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase mb-4">Check schedule</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[var(--text1)]">Auto-check interval</p>
            <p className="text-xs text-[var(--text3)]">How often to check all trackers automatically</p>
          </div>
          <select className="bg-bg2 border border-[var(--border)] rounded-lg text-[var(--text1)] text-sm px-3 py-2 outline-none focus:border-accent"
            value={settings.check_interval_hours} onChange={e => set('check_interval_hours', parseInt(e.target.value))}>
            <option value={6}>Every 6 hours</option>
            <option value={12}>Every 12 hours</option>
            <option value={24}>Every 24 hours</option>
            <option value={48}>Every 48 hours</option>
          </select>
        </div>
      </div>

      {/* Backup/Restore */}
      <div className="bg-bg1 border border-[var(--border)] rounded-xl p-5">
        <p className="text-[10px] text-[var(--text3)] tracking-widest uppercase mb-2">Backup & restore</p>
        <p className="text-xs text-[var(--text3)] mb-4">Export exports tracker names, URLs and settings. Passwords and API keys are excluded for security.</p>
        <div className="flex gap-3 flex-wrap">
          <button onClick={handleExport} disabled={exporting}
            className="text-xs border border-[var(--border2)] text-[var(--text2)] px-4 py-2 rounded-lg hover:text-[var(--text1)] disabled:opacity-50 transition-colors">
            {exporting ? 'Exporting...' : 'Export backup'}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={importing}
            className="text-xs border border-accent/30 text-accent px-4 py-2 rounded-lg hover:bg-accent/10 disabled:opacity-50 transition-colors">
            {importing ? 'Importing...' : 'Import backup'}
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="text-sm font-bold bg-accent text-black px-6 py-2.5 rounded-lg hover:bg-opacity-90 disabled:opacity-50 transition-colors">
          {saving ? 'Saving...' : 'Save all settings'}
        </button>
      </div>
    </div>
  )
}
