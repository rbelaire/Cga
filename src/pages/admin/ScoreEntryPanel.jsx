import { useState, useMemo } from 'react'
import { formatName } from '../../utils/formatName'
import { FLIGHT_ORDER, NEW_PLAYERS_FLIGHT } from '../../utils/flightOrder'
import { calcFlightPOY } from '../../utils/poy'
import { GolfFlagIcon, LockIcon } from './icons'
import { SaveBtn, PdfBtn } from './ui'
import { MemberPool } from './MemberPool'
import { FlightScoreSection } from './FlightScoreSection'

const FLIGHTS = FLIGHT_ORDER


// ── Tournament Setup Panel (Score Entry) ──────────────────────────────────────
export function ScoreEntryPanel({
  allFlights, tournamentData,
  poolMembersGrouped, poolTotalCount, poolSearch, setPoolSearch,
  selectedPool, togglePoolSelect, toggleGroupSelect, addSelectedPlayers,
  removePlayerFromFlight, updatePlayerInFlight, clearFlightByName,
  fmtPM, fmtPOY, onOpenPublishPreview,
  publishSaving, publishSaveStatus, saveScores, scoresSaving, scoresSaveStatus,
  tournament, totalPlayers, onExportResultsPDF,
  pairingsPosted, onGoToPairings,
  onRemoveExtraFlight,
  onImportScores, effectiveMembers,
}) {
  const hasAnyPlayers = allFlights.some(f => (tournamentData[f]?.length ?? 0) > 0)
  const [showImport, setShowImport] = useState(false)

  return (
    <>
      {/* Two-panel layout */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">

        {/* Left: Member pool */}
        <div className="lg:w-72 flex-shrink-0">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-forest px-4 py-2.5">
              <p className="text-white font-sans text-sm font-semibold">Members</p>
              <p className="text-white/50 text-xs font-sans mt-0.5">Select names, then tap "Add Selected"</p>
            </div>
            <div className="px-3 py-2 border-b border-gray-100">
              <input
                type="text"
                value={poolSearch}
                onChange={e => setPoolSearch(e.target.value)}
                placeholder="Filter members…"
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-forest"
              />
            </div>
            <MemberPool
              poolMembersGrouped={poolMembersGrouped}
              poolTotalCount={poolTotalCount}
              poolSearch={poolSearch}
              selectedPool={selectedPool}
              onToggle={togglePoolSelect}
              onToggleGroup={toggleGroupSelect}
              onAddSelected={addSelectedPlayers}
            />
          </div>
        </div>

        {/* Right: Score entry (locked until pairings posted) */}
        <div className="flex-1 min-w-0">
          {!pairingsPosted ? (
            <div className="bg-white border border-gray-200 rounded-lg flex flex-col items-center justify-center py-16 text-center px-8">
              <LockIcon className="w-10 h-10 text-gray-300 mb-3 opacity-70" />
              <p className="font-sans font-semibold text-darktext mb-1">Score entry locked</p>
              <p className="text-gray-400 font-sans text-sm mb-4">
                Pairings must be published before scores can be entered.
              </p>
              <button onClick={onGoToPairings} className="btn-primary text-sm">
                Go to Pairings →
              </button>
            </div>
          ) : !hasAnyPlayers ? (
            <div className="bg-white border border-gray-200 rounded-lg flex flex-col items-center justify-center py-16 text-center px-8">
              <GolfFlagIcon className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-gray-400 font-sans text-sm">No players added yet.</p>
              <p className="text-gray-400 font-sans text-xs mt-1">Select players from the pool on the left.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowImport(true)}
                  className="px-3 py-1.5 text-xs font-sans font-semibold rounded border border-gray-200 text-gray-500 hover:text-forest hover:border-forest/40 transition-colors"
                >
                  ↑ Import Scores
                </button>
              </div>
              {allFlights.map(f => {
                const rawFlightPlayers = tournamentData[f] ?? []
                const isNewPlayersTab = f === NEW_PLAYERS_FLIGHT
                const isCustomFlight = !FLIGHTS.includes(f) && !isNewPlayersTab
                if (rawFlightPlayers.length === 0 && !isNewPlayersTab) return null
                const flightPlayers = calcFlightPOY(rawFlightPlayers)
                return (
                  <FlightScoreSection
                    key={f}
                    flightName={f}
                    players={flightPlayers}
                    rawPlayers={rawFlightPlayers}
                    onUpdate={(idx, field, val) => updatePlayerInFlight(f, idx, field, val)}
                    onRemove={idx => removePlayerFromFlight(f, idx)}
                    onClear={() => clearFlightByName(f)}
                    onRemoveFlight={isCustomFlight ? () => onRemoveExtraFlight(f) : undefined}
                    fmtPM={fmtPM}
                    fmtPOY={fmtPOY}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>


      {/* Save & Publish */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-forest font-sans text-xs font-semibold uppercase tracking-widest mb-1">Save & Publish</h2>
        <p className="text-gray-500 font-sans text-xs mb-4 leading-relaxed">
          <strong className="text-darktext">Save Draft</strong> — stores scores in the cloud for later.{' '}
          <strong className="text-darktext">Publish Results</strong> — calculates standings and POY and makes them live on the site instantly.
        </p>
        <div className="flex flex-wrap gap-2">
          <SaveBtn onClick={saveScores} saving={scoresSaving} status={scoresSaveStatus} label="Save Draft" />
          <SaveBtn
            onClick={onOpenPublishPreview}
            saving={publishSaving}
            status={publishSaveStatus}
            label="Publish Results"
            className="!bg-gold !text-forest hover:!bg-gold/90"
          />
          <PdfBtn
            onClick={onExportResultsPDF}
            disabled={!tournament || totalPlayers === 0}
          >
            Export Results PDF
          </PdfBtn>
        </div>
      </div>
      {showImport && (
        <ScoreImportModal
          effectiveMembers={effectiveMembers}
          tournamentData={tournamentData}
          allFlights={allFlights}
          onApply={(rows) => { onImportScores(rows); setShowImport(false) }}
          onClose={() => setShowImport(false)}
        />
      )}
    </>
  )
}

// ── Score Import Modal ────────────────────────────────────────────────────────
function parseScoreImport(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!lines.length) return []
  const delim = lines[0].includes('\t') ? '\t' : ','
  const firstCols = lines[0].split(delim).map(c => c.trim().toLowerCase().replace(/\s+/g, ''))
  const nameAliases = ['name', 'player', 'member', 'membername']
  const headerNameIdx = firstCols.findIndex(c => nameAliases.includes(c))
  const headerScoreIdx = firstCols.findIndex(c => c === 'score')
  const hasHeader = headerNameIdx !== -1 || headerScoreIdx !== -1
  const nameIdx  = hasHeader ? (headerNameIdx  !== -1 ? headerNameIdx  : 0) : 0
  const scoreIdx = hasHeader ? (headerScoreIdx !== -1 ? headerScoreIdx : 1) : 1
  const dataLines = hasHeader ? lines.slice(1) : lines
  return dataLines.flatMap(line => {
    const cols = line.split(delim).map(c => c.trim())
    const name = cols[nameIdx] ?? ''
    const rawScore = cols[scoreIdx] ?? ''
    if (!name) return []
    const wd = rawScore.toLowerCase() === 'wd'
    return [{ name, score: wd ? '' : rawScore, wd }]
  })
}

export function ScoreImportModal({ effectiveMembers, tournamentData, allFlights, onApply, onClose }) {
  const [text, setText] = useState('')
  const normKey = s => String(s ?? '').trim().toLowerCase()

  const memberLookup = useMemo(() => {
    const map = new Map()
    for (const m of effectiveMembers) {
      map.set(normKey(m.name), m.name)
      const parts = m.name.trim().split(/\s+/)
      if (parts.length >= 2) {
        const lf = `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}`
        if (!map.has(normKey(lf))) map.set(normKey(lf), m.name)
      }
    }
    return map
  }, [effectiveMembers])

  const entryLookup = useMemo(() => {
    const map = new Map()
    for (const fl of allFlights) {
      for (const p of (tournamentData[fl] ?? [])) map.set(normKey(p.name), fl)
    }
    return map
  }, [tournamentData, allFlights])

  const preview = useMemo(() => {
    if (!text.trim()) return []
    return parseScoreImport(text).map(({ name, score, wd }) => {
      const canonical = memberLookup.get(normKey(name))
      if (!canonical) return { name, score, wd, status: 'unknown', flight: null }
      const existingFlight = entryLookup.get(normKey(canonical))
      return {
        name: canonical,
        score,
        wd,
        status: existingFlight ? 'update' : 'add',
        flight: existingFlight ?? effectiveMembers.find(m => m.name === canonical)?.flight ?? '?',
      }
    })
  }, [text, memberLookup, entryLookup, effectiveMembers])

  const canApply = preview.length > 0 && preview.some(r => r.status !== 'unknown')
  const unknownCount = preview.filter(r => r.status === 'unknown').length

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-gold/20 bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-forest font-sans">Import Scores</h3>
            <p className="text-xs text-gray-400 font-sans mt-0.5">Paste CSV or tab-separated data. Columns: <code className="bg-gray-100 px-1 rounded">name, score</code>. Use <code className="bg-gray-100 px-1 rounded">WD</code> as score for withdrawals.</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-xl leading-none">×</button>
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={"name,score\nJohn Smith,38\nJane Doe,WD\nBob Jones,42"}
          rows={6}
          className="w-full border border-gray-200 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-forest resize-y"
          autoFocus
        />
        {preview.length > 0 && (
          <div className="mt-3 border border-gray-100 rounded overflow-hidden">
            <table className="w-full text-xs font-sans">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-3 py-1.5 text-gray-400 font-medium">Player</th>
                  <th className="text-center px-3 py-1.5 text-gray-400 font-medium">Score</th>
                  <th className="text-center px-3 py-1.5 text-gray-400 font-medium">Flight</th>
                  <th className="text-center px-3 py-1.5 text-gray-400 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className={`border-b border-gray-50 last:border-0 ${r.status === 'unknown' ? 'bg-red-50' : 'bg-white'}`}>
                    <td className="px-3 py-1.5 text-darktext font-medium">{formatName(r.name)}</td>
                    <td className="px-3 py-1.5 text-center font-mono">
                      {r.wd
                        ? <span className="text-orange-600 font-semibold">WD</span>
                        : <span className="text-darktext">{r.score}</span>
                      }
                    </td>
                    <td className="px-3 py-1.5 text-center text-gray-500">{r.flight ?? '—'}</td>
                    <td className="px-3 py-1.5 text-center">
                      {r.status === 'unknown' && <span className="text-red-500 font-medium">Not found</span>}
                      {r.status === 'update'  && <span className="text-blue-500 font-medium">Update score</span>}
                      {r.status === 'add'     && <span className="text-green-600 font-medium">Add to flight</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {unknownCount > 0 && (
          <p className="mt-2 text-xs text-red-500 font-sans">{unknownCount} player{unknownCount !== 1 ? 's' : ''} not found in member list and will be skipped.</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 text-xs font-sans rounded border border-gray-200 text-gray-500 hover:text-forest transition-colors">Cancel</button>
          <button
            onClick={() => onApply(preview.filter(r => r.status !== 'unknown').map(r => ({ name: r.name, score: r.score, wd: r.wd })))}
            disabled={!canApply}
            className="px-4 py-1.5 text-xs font-sans font-semibold rounded bg-forest text-white disabled:opacity-40 hover:bg-forest/90 transition-colors"
          >
            Apply {canApply ? `(${preview.filter(r => r.status !== 'unknown').length} players)` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

