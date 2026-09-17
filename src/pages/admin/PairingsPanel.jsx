import { useState, useRef } from 'react'
import { formatName } from '../../utils/formatName'
import { roundPtm } from '../../utils/roundPtm'
import { MemberPool } from './MemberPool'
import { SaveBtn, PdfBtn } from './ui'

// ── Pairing Rules Panel ───────────────────────────────────────────────────────
export function PairingRulesPanel({ pairingRules, setPairingRules, allEnteredPlayers, flightTagStyles }) {
  const [addingType, setAddingType]       = useState(null)   // 'always' | 'never' | null
  const [draftPlayers, setDraftPlayers]   = useState([])
  const [playerSearch, setPlayerSearch]   = useState('')

  function startAddRule(type) {
    setAddingType(type)
    setDraftPlayers([])
    setPlayerSearch('')
  }

  function cancelAdd() {
    setAddingType(null)
    setDraftPlayers([])
    setPlayerSearch('')
  }

  function toggleDraftPlayer(name) {
    setDraftPlayers(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  function commitRule() {
    if (draftPlayers.length < 2) return
    setPairingRules(prev => [
      ...prev,
      { id: `rule_${Date.now()}`, type: addingType, players: [...draftPlayers] },
    ])
    cancelAdd()
  }

  function deleteRule(id) {
    setPairingRules(prev => prev.filter(r => r.id !== id))
  }

  function removePlayerFromRule(ruleId, playerName) {
    setPairingRules(prev => prev.map(r => {
      if (r.id !== ruleId) return r
      const next = r.players.filter(n => n !== playerName)
      return next.length < 2 ? null : { ...r, players: next }
    }).filter(Boolean))
  }

  const filteredPlayers = allEnteredPlayers.filter(p =>
    !playerSearch || p.name.toLowerCase().includes(playerSearch.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Add buttons */}
      {!addingType && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => startAddRule('always')}
            className="px-3 py-1.5 text-xs font-sans font-semibold rounded border border-emerald-400 text-emerald-700 hover:bg-emerald-50 transition-colors"
          >
            + Always Together
          </button>
          <button
            onClick={() => startAddRule('never')}
            className="px-3 py-1.5 text-xs font-sans font-semibold rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
          >
            + Never Together
          </button>
        </div>
      )}

      {/* Inline rule builder */}
      {addingType && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
              addingType === 'always'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-red-50 text-red-600 border-red-300'
            }`}>
              {addingType === 'always' ? 'Always Together' : 'Never Together'}
            </span>
            <span className="text-xs text-gray-400 font-sans">Select 2 or more players</span>
          </div>

          {allEnteredPlayers.length === 0 ? (
            <p className="text-xs text-gray-400 font-sans italic mb-3">No players entered for this tournament yet.</p>
          ) : (
            <>
              <input
                type="text"
                placeholder="Search players…"
                value={playerSearch}
                onChange={e => setPlayerSearch(e.target.value)}
                className="w-full mb-2 px-2.5 py-1.5 text-xs font-sans border border-gray-200 rounded focus:outline-none focus:border-forest"
              />
              <ul className="max-h-48 overflow-auto border border-gray-100 rounded divide-y divide-gray-50 mb-3">
                {filteredPlayers.length === 0 && (
                  <li className="px-3 py-2 text-xs text-gray-400 font-sans italic">No matches</li>
                )}
                {filteredPlayers.map(p => {
                  const selected = draftPlayers.includes(p.name)
                  return (
                    <li key={p.name}>
                      <button
                        onClick={() => toggleDraftPlayer(p.name)}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                          selected ? 'bg-forest/5' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className="font-sans text-sm text-darktext">{formatName(p.name)}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`text-xs border px-1.5 py-0.5 rounded-full font-sans whitespace-nowrap ${flightTagStyles[p.flight] ?? flightTagStyles.Unassigned}`}>
                            {p.flight}
                          </span>
                          {selected && (
                            <span className="w-4 h-4 rounded-full bg-forest flex items-center justify-center flex-shrink-0">
                              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          {/* Selected chips */}
          {draftPlayers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {draftPlayers.map(name => (
                <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-forest/10 text-forest text-xs font-sans">
                  {formatName(name)}
                  <button onClick={() => toggleDraftPlayer(name)} className="text-forest/50 hover:text-red-500 leading-none">&times;</button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={commitRule}
              disabled={draftPlayers.length < 2}
              className="px-3 py-1.5 text-xs font-sans font-semibold rounded bg-forest text-white disabled:opacity-40 hover:bg-forest/90 transition-colors"
            >
              Save Rule
            </button>
            <button
              onClick={cancelAdd}
              className="px-3 py-1.5 text-xs font-sans rounded border border-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Existing rules */}
      {pairingRules.length === 0 && !addingType && (
        <p className="text-sm text-gray-400 font-sans italic py-4 text-center">
          No rules yet. Rules apply every time you auto-generate pairings.
        </p>
      )}
      <div className="space-y-2">
        {pairingRules.map(rule => (
          <div key={rule.id} className={`rounded-lg border p-3 ${
            rule.type === 'always'
              ? 'bg-emerald-50/60 border-emerald-200'
              : 'bg-red-50/60 border-red-200'
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-wrap">
                <span className={`text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border flex-shrink-0 ${
                  rule.type === 'always'
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                    : 'bg-red-100 text-red-600 border-red-300'
                }`}>
                  {rule.type === 'always' ? 'Always Together' : 'Never Together'}
                </span>
                <div className="flex flex-wrap gap-1">
                  {rule.players.map(name => (
                    <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-gray-200 text-xs font-sans text-darktext">
                      {formatName(name)}
                      <button
                        onClick={() => removePlayerFromRule(rule.id, name)}
                        className="text-gray-300 hover:text-red-400 leading-none"
                        title="Remove player from rule"
                      >&times;</button>
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => deleteRule(rule.id)}
                className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0"
                title="Delete rule"
              >&times;</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Pairings Builder Panel ────────────────────────────────────────────────────
export function PairingsPanel({
  totalPlayers, currentPairings, unpairedPlayers, allEnteredPlayers, manualPairings,
  selectedUnpaired, setSelectedUnpaired,
  generatePairings, startManualPairings, addGroupManual, removeGroupManual,
  assignUnpairedToGroup, movePlayerManual, clearPairings, removePairedPlayer, savePairings,
  pairingsSaving, pairingsSaveStatus, pairingsState, onExportPairingsPDF, tournament,
  flightTagStyles, pairingRules, setPairingRules, onImportPairings, allEnteredPlayerNames,
}) {
  const [draggedPlayer, setDraggedPlayer] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const [activeTab, setActiveTab] = useState('pairings')  // 'pairings' | 'rules' | 'import'
  const [importCsvError, setImportCsvError] = useState(null)
  const [importCsvWarning, setImportCsvWarning] = useState(null)
  const importFileRef = useRef(null)

  function parsePairingsCsv(text) {
    const lines = text.trim().split(/\r?\n/)
    if (lines.length < 2) return { error: 'File is empty or has only a header row.' }
    const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
    const groupIdx = rawHeaders.indexOf('group')
    const playerIdx = rawHeaders.findIndex(h => h === 'player' || h === 'name')
    if (groupIdx === -1 || playerIdx === -1) {
      return { error: 'CSV must have "group" and "player" (or "name") columns.' }
    }
    const groups = new Map()
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      const group = cols[groupIdx] ?? ''
      const player = cols[playerIdx] ?? ''
      if (!group || !player) continue
      if (!groups.has(group)) groups.set(group, [])
      groups.get(group).push(player)
    }
    if (groups.size === 0) return { error: 'No valid rows found in the file.' }
    const unknown = []
    for (const players of groups.values()) {
      for (const name of players) {
        if (allEnteredPlayerNames && !allEnteredPlayerNames.has(name)) unknown.push(name)
      }
    }
    const result = [...groups.entries()].map(([label, players], i) => ({ label: `Pairing ${i + 1}`, players }))
    return { groups: result, unknown }
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const parsed = parsePairingsCsv(text)
      if (parsed.error) {
        setImportCsvError(parsed.error)
        setImportCsvWarning(null)
      } else {
        setImportCsvError(null)
        onImportPairings(parsed.groups)
        if (parsed.unknown?.length) {
          setImportCsvWarning(`${parsed.unknown.length} player(s) not in score entry: ${parsed.unknown.slice(0, 3).join(', ')}${parsed.unknown.length > 3 ? '…' : ''}`)
        } else {
          setImportCsvWarning(null)
        }
        setActiveTab('pairings')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function encodeDragPayload(payload) {
    return JSON.stringify(payload)
  }

  function decodeDragPayload(event) {
    try {
      const raw = event.dataTransfer.getData('application/x-cga-pairing-player') || event.dataTransfer.getData('text/plain')
      if (!raw) return null
      const payload = JSON.parse(raw)
      if (!payload || (payload.type !== 'unassigned' && payload.type !== 'group')) return null
      return payload
    } catch {
      return null
    }
  }

  function handleDragStart(event, payload) {
    const encoded = encodeDragPayload(payload)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-cga-pairing-player', encoded)
    event.dataTransfer.setData('text/plain', encoded)
    setDraggedPlayer(payload)
  }

  function handleDragEnd() {
    setDraggedPlayer(null)
    setDropTarget(null)
  }

  function handleDropOnGroup(event, cardIdx) {
    event.preventDefault()
    const source = decodeDragPayload(event)
    if (!source) return
    movePlayerManual(source, { cardIdx })
    setDropTarget(null)
  }

  function handleDropOnPlayer(event, cardIdx, playerIdx) {
    event.preventDefault()
    event.stopPropagation()
    const source = decodeDragPayload(event)
    if (!source) return
    movePlayerManual(source, { cardIdx, playerIdx })
    setDropTarget(null)
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-0 mb-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('pairings')}
          className={`px-4 py-2 text-xs font-heading font-semibold uppercase tracking-widest border-b-2 -mb-px transition-colors ${
            activeTab === 'pairings'
              ? 'border-forest text-forest'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Pairings
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2 text-xs font-heading font-semibold uppercase tracking-widest border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
            activeTab === 'rules'
              ? 'border-forest text-forest'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Pairing Rules
          {pairingRules.length > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-forest text-white text-[10px] font-bold">
              {pairingRules.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`px-4 py-2 text-xs font-heading font-semibold uppercase tracking-widest border-b-2 -mb-px transition-colors ${
            activeTab === 'import'
              ? 'border-forest text-forest'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Import CSV
        </button>
      </div>

      {/* Import panel */}
      {activeTab === 'import' && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs font-heading font-semibold uppercase tracking-widest text-forest mb-1">Import Pairings from CSV</p>
          <p className="text-xs font-sans text-gray-500 mb-4">
            Upload a CSV with <span className="font-mono font-semibold">group</span> and <span className="font-mono font-semibold">player</span> columns.
            Each row is one player; rows with the same group value form one pairing card.
          </p>
          <div className="mb-3 rounded-md bg-gray-50 border border-gray-200 p-3 text-xs font-mono text-gray-600">
            group,player<br />
            1,John Smith<br />
            1,Jane Doe<br />
            1,Bob Jones<br />
            1,Alice Brown<br />
            2,Mike Johnson<br />
            2,Sarah Wilson
          </div>
          <input
            ref={importFileRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            type="button"
            onClick={() => importFileRef.current?.click()}
            className="px-4 py-2 rounded-md bg-forest text-white text-xs font-sans font-semibold hover:bg-forest/90"
          >
            Choose CSV File…
          </button>
          {importCsvError && (
            <p className="mt-3 text-xs font-sans text-red-600 font-semibold">{importCsvError}</p>
          )}
          {importCsvWarning && (
            <p className="mt-3 text-xs font-sans text-amber-600">{importCsvWarning}</p>
          )}
          <p className="mt-4 text-[11px] font-sans text-gray-400">
            Importing replaces current draft pairings. You can still edit them after import.
            Player names must exactly match the names in score entry.
          </p>
        </div>
      )}

      {/* Rules panel */}
      {activeTab === 'rules' && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-heading font-semibold uppercase tracking-widest text-forest mb-4">Pairing Rules</p>
          <PairingRulesPanel
            pairingRules={pairingRules}
            setPairingRules={setPairingRules}
            allEnteredPlayers={allEnteredPlayers}
            flightTagStyles={flightTagStyles}
          />
        </div>
      )}

      {/* Controls */}
      {activeTab === 'pairings' && (
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-sans font-semibold text-gray-500 uppercase tracking-widest">Pairings always in groups of 4</span>
          {pairingRules.length > 0 && (
            <button
              onClick={() => setActiveTab('rules')}
              className="text-xs font-sans text-forest underline underline-offset-2 hover:text-forest/70 transition-colors"
            >
              {pairingRules.length} rule{pairingRules.length !== 1 ? 's' : ''} active
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {totalPlayers > 0 && (
            <>
              <button
                onClick={generatePairings}
                className="px-3 py-1.5 text-xs font-sans font-semibold rounded border border-forest text-forest hover:bg-forest hover:text-white transition-colors"
              >
                {currentPairings.length > 0 ? 'Re-generate (Auto)' : 'Auto-Generate Pairings'}
              </button>
              <button
                onClick={startManualPairings}
                className="px-3 py-1.5 text-xs font-sans font-semibold rounded border border-gold text-amber-700 hover:bg-amber-50 transition-colors"
              >
                Build Your Own
              </button>
            </>
          )}
          {manualPairings && currentPairings.length > 0 && (
            <>
              <button
                onClick={addGroupManual}
                className="px-3 py-1.5 text-xs font-sans rounded border border-dashed border-forest text-forest hover:bg-forest/5 transition-colors"
              >
                + Add Pairing
              </button>
            </>
          )}
          {currentPairings.length > 0 && (
            <>
              <SaveBtn onClick={savePairings} saving={pairingsSaving} status={pairingsSaveStatus} label={pairingsState === 'published' ? 'Publish Updates' : 'Publish Pairings'} />
              <PdfBtn onClick={onExportPairingsPDF} disabled={!tournament}>
                Export Pairings PDF
              </PdfBtn>
              <button
                onClick={clearPairings}
                className="px-3 py-1.5 text-xs font-sans rounded border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>
      )}

      {activeTab === 'pairings' && (<>
      {/* No players notice */}
      {totalPlayers === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <p className="text-amber-700 font-sans text-sm font-medium mb-1">No players entered yet</p>
          <p className="text-amber-600 font-sans text-xs">Switch to Score Entry to add players to flights first.</p>
        </div>
      )}

      {/* Empty state */}
      {currentPairings.length === 0 && totalPlayers > 0 && (
        <div className="border-2 border-dashed border-gray-200 rounded-lg py-16 flex flex-col items-center justify-center">
          <p className="text-gray-400 font-sans text-sm mb-4">No pairings yet. Choose Auto-Generate or Build Your Own above.</p>
        </div>
      )}

      {manualPairings && currentPairings.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,1fr)_minmax(0,2fr)] gap-4 items-start">
          <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
              <h3 className="text-xs font-sans font-semibold text-forest uppercase tracking-widest">Players</h3>
              <span className="text-[11px] font-mono text-gray-500">{unpairedPlayers.length} unassigned</span>
            </div>
            <ul className="max-h-[65vh] overflow-auto divide-y divide-gray-100">
              {unpairedPlayers.length === 0 && (
                <li className="px-4 py-6 text-center text-gray-400 text-xs font-sans">All players are assigned.</li>
              )}
              {unpairedPlayers.map(p => (
                <li key={p.name} className="px-3 py-2">
                  <button
                    draggable
                    onDragStart={(event) => handleDragStart(event, { type: 'unassigned', name: p.name })}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedUnpaired(prev => prev === p.name ? null : p.name)}
                    className={`w-full text-left rounded border px-3 py-2 transition-colors cursor-grab active:cursor-grabbing ${
                      selectedUnpaired === p.name
                        ? 'bg-gold/20 border-gold text-forest'
                        : 'border-gray-200 hover:border-forest/30'
                    } ${draggedPlayer?.type === 'unassigned' && draggedPlayer.name === p.name ? 'opacity-55' : ''}`}
                    aria-label={`Drag or click ${formatName(p.name)} to assign`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-sans text-sm text-darktext truncate">{formatName(p.name)}</span>
                      <span className={`text-xs border px-1.5 py-0.5 rounded-full font-sans whitespace-nowrap ${flightTagStyles[p.flight] ?? flightTagStyles.Unassigned}`}>
                        {p.flight}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
              <h3 className="text-xs font-sans font-semibold text-forest uppercase tracking-widest">Pairings</h3>
              <span className="text-[11px] font-mono text-gray-500">{currentPairings.length} rows</span>
            </div>
            <div className="max-h-[65vh] overflow-auto divide-y divide-gray-100">
              {currentPairings.map((card, cardIdx) => (
                <div
                  key={cardIdx}
                  className={`px-4 py-3 transition-colors ${
                    dropTarget?.type === 'group' && dropTarget.cardIdx === cardIdx
                      ? 'bg-emerald-50/60'
                      : ''
                  }`}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    setDropTarget({ type: 'group', cardIdx })
                  }}
                  onDragLeave={() => setDropTarget(current => (
                    current?.type === 'group' && current.cardIdx === cardIdx ? null : current
                  ))}
                  onDrop={(event) => handleDropOnGroup(event, cardIdx)}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-forest">{card.pairing}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-gray-500">{card.players.length}/4</span>
                      <button onClick={() => removeGroupManual(cardIdx)} className="text-gray-300 hover:text-red-400 text-base leading-none" title="Remove pairing">×</button>
                    </div>
                  </div>
                  <ul className="space-y-1">
                    {card.players.map((player, playerIdx) => (
                      <li
                        key={player.name}
                        draggable
                        onDragStart={(event) => handleDragStart(event, { type: 'group', cardIdx, playerIdx })}
                        onDragEnd={handleDragEnd}
                        onDragOver={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          event.dataTransfer.dropEffect = 'move'
                          setDropTarget({ type: 'player', cardIdx, playerIdx })
                        }}
                        onDragLeave={() => setDropTarget(current => (
                          current?.type === 'player' && current.cardIdx === cardIdx && current.playerIdx === playerIdx ? null : current
                        ))}
                        onDrop={(event) => handleDropOnPlayer(event, cardIdx, playerIdx)}
                        className={`flex items-center justify-between gap-2 border rounded px-2.5 py-1.5 cursor-grab active:cursor-grabbing transition-colors ${
                          dropTarget?.type === 'player' && dropTarget.cardIdx === cardIdx && dropTarget.playerIdx === playerIdx
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-gray-100'
                        } ${
                          draggedPlayer?.type === 'group' && draggedPlayer.cardIdx === cardIdx && draggedPlayer.playerIdx === playerIdx
                            ? 'opacity-55'
                            : ''
                        }`}
                      >
                        <span className="font-sans text-sm text-darktext truncate">{formatName(player.name)}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs border px-1.5 py-0.5 rounded-full font-sans whitespace-nowrap ${flightTagStyles[player.flight] ?? flightTagStyles.Unassigned}`}>
                            {player.flight}
                          </span>
                          <button onClick={() => removePairedPlayer(cardIdx, playerIdx)} className="text-gray-300 hover:text-red-400 text-base leading-none" title="Remove from pairing">×</button>
                        </div>
                      </li>
                    ))}
                    {card.players.length === 0 && (
                      <li className="text-gray-300 text-xs italic font-sans px-1 py-0.5">Empty pairing</li>
                    )}
                  </ul>
                  {selectedUnpaired && card.players.length < 4 && (
                    <button
                      onClick={() => assignUnpairedToGroup(cardIdx)}
                      className="mt-2 w-full py-1.5 text-xs rounded bg-gold/10 text-amber-700 hover:bg-gold/20 font-sans font-semibold transition-colors"
                    >
                      Add {formatName(selectedUnpaired)}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {!manualPairings && unpairedPlayers.length > 0 && currentPairings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex flex-wrap items-center gap-3">
          <span className="text-amber-700 font-sans text-xs font-semibold uppercase tracking-widest flex-shrink-0">
            Not yet paired ({unpairedPlayers.length}) — drag into a group or click a player then click a group
          </span>
          <div className="flex flex-wrap gap-1.5">
            {unpairedPlayers.map(p => (
              <button
                key={p.name}
                draggable
                onDragStart={(event) => handleDragStart(event, { type: 'unassigned', name: p.name })}
                onDragEnd={handleDragEnd}
                onClick={() => setSelectedUnpaired(prev => prev === p.name ? null : p.name)}
                className={`text-xs border px-2 py-0.5 rounded-full font-sans cursor-grab active:cursor-grabbing transition-colors ${
                  selectedUnpaired === p.name
                    ? 'bg-gold/30 border-gold text-forest font-semibold'
                    : flightTagStyles[p.flight] ?? flightTagStyles.Unassigned
                } ${draggedPlayer?.name === p.name ? 'opacity-50' : ''}`}
              >
                {formatName(p.name)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pairing cards grid — always editable */}
      {!manualPairings && currentPairings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {currentPairings.map((card, cardIdx) => (
            <div
              key={card.pairing}
              className={`bg-white border rounded-lg overflow-hidden transition-colors ${
                dropTarget?.type === 'group' && dropTarget.cardIdx === cardIdx
                  ? 'border-emerald-400 bg-emerald-50/30'
                  : 'border-gray-200'
              }`}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                setDropTarget({ type: 'group', cardIdx })
              }}
              onDragLeave={() => setDropTarget(current => (
                current?.type === 'group' && current.cardIdx === cardIdx ? null : current
              ))}
              onDrop={(event) => handleDropOnGroup(event, cardIdx)}
            >
              <div className="bg-forest px-4 py-2 flex items-center justify-between">
                <span className="text-white font-sans text-xs font-semibold uppercase tracking-widest">
                  {card.pairing}
                </span>
                <span className="text-white/50 font-mono text-xs">{card.players.length}/4</span>
              </div>
              <ul className="divide-y divide-gray-100 min-h-[60px]">
                {card.players.map((player, playerIdx) => (
                  <li
                    key={player.name}
                    draggable
                    onDragStart={(event) => handleDragStart(event, { type: 'group', cardIdx, playerIdx })}
                    onDragEnd={handleDragEnd}
                    onDragOver={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      event.dataTransfer.dropEffect = 'move'
                      setDropTarget({ type: 'player', cardIdx, playerIdx })
                    }}
                    onDragLeave={() => setDropTarget(current => (
                      current?.type === 'player' && current.cardIdx === cardIdx && current.playerIdx === playerIdx ? null : current
                    ))}
                    onDrop={(event) => handleDropOnPlayer(event, cardIdx, playerIdx)}
                    className={`px-3 py-2.5 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing transition-colors group ${
                      dropTarget?.type === 'player' && dropTarget.cardIdx === cardIdx && dropTarget.playerIdx === playerIdx
                        ? 'bg-emerald-50 border-l-2 border-l-emerald-400'
                        : ''
                    } ${
                      draggedPlayer?.type === 'group' && draggedPlayer.cardIdx === cardIdx && draggedPlayer.playerIdx === playerIdx
                        ? 'opacity-50'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-sans text-sm text-darktext truncate">{formatName(player.name)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`text-xs border px-1.5 py-0.5 rounded-full font-sans whitespace-nowrap ${flightTagStyles[player.flight] ?? flightTagStyles.Unassigned}`}>
                        {player.flight}
                      </span>
                      <button
                        onClick={() => removePairedPlayer(cardIdx, playerIdx)}
                        className="text-gray-300 hover:text-red-400 text-base leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove from pairing"
                      >&times;</button>
                    </div>
                  </li>
                ))}
                {card.players.length === 0 && (
                  <li className="px-3 py-4 text-center text-gray-300 font-sans text-xs italic">
                    Empty group
                  </li>
                )}
              </ul>
              {selectedUnpaired && card.players.length < 4 && (
                <button
                  onClick={() => assignUnpairedToGroup(cardIdx)}
                  className="w-full py-1.5 text-xs rounded-b bg-gold/10 text-amber-700 hover:bg-gold/20 font-sans font-semibold transition-colors border-t border-amber-100"
                >
                  Add {formatName(selectedUnpaired)}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {currentPairings.length > 0 && (
        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4">
          <p className="text-blue-700 font-sans text-xs leading-relaxed">
            Pairings state: <strong className="uppercase">{pairingsState ?? 'none'}</strong>. Hit <strong>Save Pairings</strong> to publish the current draft.
          </p>
        </div>
      )}
      </>)}
    </div>
  )
}
