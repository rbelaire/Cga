import { useState, useRef } from 'react'
import { DB } from '../../db'
import { useFireData } from '../../hooks/useFireData'
import { parseBeginningPtmXlsx } from '../../exports/xlsxExports'

export function BeginningPtmPanel({ livePtmData, logChange, openConfirm }) {
  const { data: currentSnapshot } = useFireData(DB.listenBeginningPtm, null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null) // 'ok' | 'err'
  const [upload, setUpload] = useState(null)  // { list, fileName } parsed from a spreadsheet
  const [uploadError, setUploadError] = useState(null)
  const fileRef = useRef(null)

  const playerCount = Array.isArray(livePtmData) ? livePtmData.filter(p => p.ptm != null).length : 0
  const snapshotCount = Array.isArray(currentSnapshot) ? currentSnapshot.length : 0

  async function persist(list, label) {
    setSaving(true)
    setStatus(null)
    try {
      await DB.saveBeginningPtm(list)
      logChange('Beginning-of-year PTM snapshot saved', label)
      setStatus('ok')
    } catch {
      setStatus('err')
    }
    setSaving(false)
    setTimeout(() => setStatus(null), 4000)
  }

  async function handleSaveCurrent() {
    if (!livePtmData?.length) return
    const confirmed = await openConfirm(
      `Save current PTM data (${playerCount} players) as the beginning-of-year snapshot? This overwrites any existing snapshot and is used to compute Most/Least Improved standings.`
    )
    if (!confirmed) return
    const list = livePtmData
      .filter(p => p.name && p.ptm != null)
      .map(p => ({ name: p.name, ptm: p.ptm, tee: p.tee ?? null }))
    await persist(list, `${list.length} players (from current PTM)`)
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadError(null)
    setUpload(null)
    try {
      const buffer = await file.arrayBuffer()
      const list = parseBeginningPtmXlsx(buffer)
      if (!list.length) {
        setUploadError('No players with a PTM value found in that spreadsheet.')
        return
      }
      setUpload({ list, fileName: file.name })
    } catch {
      setUploadError('Could not read that file. Expected an .xlsx with player names and a PTM column.')
    }
  }

  async function handleSaveUpload() {
    if (!upload?.list.length) return
    const confirmed = await openConfirm(
      `Save ${upload.list.length} players from "${upload.fileName}" as the beginning-of-year snapshot? This overwrites any existing snapshot and is used to compute Most/Least Improved standings.`
    )
    if (!confirmed) return
    await persist(upload.list, `${upload.list.length} players (from ${upload.fileName})`)
    setUpload(null)
  }

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <div>
        <p className="text-xs font-heading font-semibold uppercase tracking-widest text-forest mb-1">Beginning-of-Year PTM Snapshot</p>
        <p className="text-xs font-sans text-gray-500">
          The season-start PTM baseline used to compute Most/Least Improved standings.
          {snapshotCount > 0 && (
            <span className="ml-1 text-forest font-medium">Snapshot exists: {snapshotCount} players.</span>
          )}
        </p>
      </div>

      {/* Upload a Points-to-Make spreadsheet */}
      <div className="border border-gray-200 rounded-lg p-3">
        <p className="text-xs font-sans font-semibold text-darktext mb-1">Upload from spreadsheet</p>
        <p className="text-[11px] font-sans text-gray-500 mb-2">
          An .xlsx with a player-name column and a <strong>PTM</strong> (or “Points to make”) column. The first sheet is used.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept=".xlsx" onChange={handleFile} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 text-xs font-sans font-semibold rounded border border-gray-300 text-gray-600 hover:border-forest hover:text-forest transition-colors"
          >
            Choose Spreadsheet…
          </button>
          {upload && (
            <>
              <span className="text-xs font-sans text-gray-600">
                <strong className="text-forest">{upload.list.length}</strong> players parsed from {upload.fileName}
              </span>
              <button
                onClick={handleSaveUpload}
                disabled={saving}
                className="px-4 py-1.5 text-xs font-sans font-semibold rounded-lg bg-forest text-white hover:bg-forest/90 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save as Snapshot'}
              </button>
            </>
          )}
        </div>
        {uploadError && <p className="text-xs font-sans text-red-500 mt-2">{uploadError}</p>}
      </div>

      {/* Save the current live PTM as the snapshot */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSaveCurrent}
          disabled={saving || playerCount === 0}
          className="px-4 py-2 text-sm font-sans font-semibold rounded-lg bg-white border border-forest text-forest hover:bg-forest/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving…' : `Use Current PTM (${playerCount} players)`}
        </button>
        {status === 'ok' && <span className="text-xs font-sans text-green-600 font-semibold">Saved</span>}
        {status === 'err' && <span className="text-xs font-sans text-red-500 font-semibold">Save failed</span>}
      </div>
    </section>
  )
}
