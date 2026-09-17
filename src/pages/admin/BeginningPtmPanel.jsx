import { useState } from 'react'
import { DB } from '../../db'
import { useFireData } from '../../hooks/useFireData'

export function BeginningPtmPanel({ livePtmData, logChange, openConfirm }) {
  const { data: currentSnapshot } = useFireData(DB.listenBeginningPtm, null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null) // 'ok' | 'err'

  const playerCount = Array.isArray(livePtmData) ? livePtmData.filter(p => p.ptm != null).length : 0
  const snapshotCount = Array.isArray(currentSnapshot) ? currentSnapshot.length : 0

  async function handleSave() {
    if (!livePtmData?.length) return
    const confirmed = await openConfirm(
      `Save current PTM data (${playerCount} players) as the beginning-of-year snapshot? This will overwrite any existing snapshot and is used to compute Most/Least Improved standings.`
    )
    if (!confirmed) return
    setSaving(true)
    setStatus(null)
    try {
      const list = livePtmData
        .filter(p => p.name && p.ptm != null)
        .map(p => ({ name: p.name, ptm: p.ptm, tee: p.tee ?? null }))
      await DB.saveBeginningPtm(list)
      logChange('Beginning-of-year PTM snapshot saved', `${list.length} players`)
      setStatus('ok')
    } catch {
      setStatus('err')
    }
    setSaving(false)
    setTimeout(() => setStatus(null), 4000)
  }

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs font-heading font-semibold uppercase tracking-widest text-forest mb-1">Beginning-of-Year PTM Snapshot</p>
      <p className="text-xs font-sans text-gray-500 mb-3">
        Saves the current PTM data as the season-start baseline used to compute Most/Least Improved standings.
        {snapshotCount > 0 && (
          <span className="ml-1 text-forest font-medium">Snapshot exists: {snapshotCount} players.</span>
        )}
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || playerCount === 0}
          className="px-4 py-2 text-sm font-sans font-semibold rounded-lg bg-forest text-white hover:bg-forest/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving…' : `Save Snapshot (${playerCount} players)`}
        </button>
        {status === 'ok' && <span className="text-xs font-sans text-green-600 font-semibold">Saved</span>}
        {status === 'err' && <span className="text-xs font-sans text-red-500 font-semibold">Save failed</span>}
      </div>
    </section>
  )
}

