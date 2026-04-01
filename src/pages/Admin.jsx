import { useState, useMemo, useEffect, useRef } from 'react'
import PageWrapper from '../components/layout/PageWrapper'
import schedule from '../data/schedule.json'
import membersData from '../data/members.json'
import currentStandings from '../data/standings.json'

const FLIGHTS = ['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight']
const STORAGE_KEY   = 'cga_admin_v1'
const PAIRINGS_KEY  = 'cga_pairings_v1'
const PIN = 'cga2026'

const flightTagStyles = {
  Championship: 'bg-amber-50 text-amber-700 border-amber-200',
  '1st Flight': 'bg-blue-50 text-blue-700 border-blue-200',
  '2nd Flight': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  '3rd Flight': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '4th Flight': 'bg-purple-50 text-purple-700 border-purple-200',
  '5th Flight': 'bg-pink-50 text-pink-700 border-pink-200',
  Unassigned:   'bg-gray-100 text-gray-600 border-gray-200',
}

// ── POY calculation ───────────────────────────────────────────────────────────
function calcFlightPOY(players) {
  if (!players.length) return players
  const n     = players.length
  const scale = Array.from({ length: n }, (_, i) => 350 - 25 * i)

  const withPM = players.map((p, i) => {
    const hasData = p.ptm !== '' && p.score !== '' && p.ptm != null && p.score != null
    return { ...p, _i: i, _has: hasData, plusMinus: hasData ? Number(p.score) - Number(p.ptm) : null }
  })

  const complete = withPM.filter(p => p._has).sort((a, b) => b.plusMinus - a.plusMinus)
  const rankMap  = {}
  let pos = 0
  while (pos < complete.length) {
    const val   = complete[pos].plusMinus
    const group = []
    let j = pos
    while (j < complete.length && complete[j].plusMinus === val) { group.push(j); j++ }
    const avg = group.reduce((s, idx) => s + (scale[idx] ?? 0), 0) / group.length
    group.forEach(idx => {
      rankMap[complete[idx]._i] = { rank: pos + 1, poy: complete[idx].eligible !== false ? avg : 0 }
    })
    pos = j
  }
  return withPM.map((p, i) => ({ ...p, rank: rankMap[i]?.rank ?? null, poy: rankMap[i]?.poy ?? null }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtPM  = pm => pm == null ? '—' : pm > 0 ? `+${pm}` : `${pm}`
const fmtPOY = p  => p.poy == null ? '—' : p.eligible === false ? 'X' : p.poy % 1 === 0 ? String(p.poy) : p.poy.toFixed(1)

function downloadJSON(obj, filename) {
  const a = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })),
    download: filename,
  })
  a.click()
}

// ── PIN gate ──────────────────────────────────────────────────────────────────
export default function Admin() {
  const [pin, setPin] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [err, setErr] = useState(false)

  const tryUnlock = () => {
    if (pin === PIN) { setUnlocked(true) }
    else { setErr(true); setTimeout(() => setErr(false), 1500) }
  }

  if (!unlocked) return (
    <PageWrapper>
      <div className="max-w-xs mx-auto mt-24">
        <h1 className="section-title text-2xl mb-6">Admin</h1>
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
          <input
            type="password" value={pin} onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && tryUnlock()}
            placeholder="PIN" autoFocus
            className={`w-full border rounded px-3 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-forest ${err ? 'border-red-400' : 'border-gray-300'}`}
          />
          {err && <p className="text-red-500 text-xs font-sans">Incorrect PIN.</p>}
          <button onClick={tryUnlock} className="btn-primary w-full text-center">Unlock</button>
        </div>
      </div>
    </PageWrapper>
  )

  return <AdminPanel />
}

// ── Admin panel ───────────────────────────────────────────────────────────────
function AdminPanel() {
  const [data, setData] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
  })
  const [pairingsData, setPairingsData] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PAIRINGS_KEY)) || {} } catch { return {} }
  })

  const [saved,      setSaved]      = useState(false)
  const [tid,        setTid]        = useState(schedule[0]?.id ?? '')
  const [flight,     setFlight]     = useState(FLIGHTS[0])
  const [poolSearch, setPoolSearch] = useState('')
  const [exportNote, setExportNote] = useState('')
  const [adminMode,  setAdminMode]  = useState('scores')  // 'scores' | 'pairings'
  const [groupSize,  setGroupSize]  = useState(4)

  // score entry drag state
  const dragRef         = useRef(null)
  const [dragOverRow,   setDragOverRow]   = useState(null)
  const [dragOverPool,  setDragOverPool]  = useState(false)

  // pairings drag state
  const pDragRef       = useRef(null)   // { cardIdx, playerIdx }
  const [pDragOver,    setPDragOver]    = useState(null)  // target card index

  // persist score data
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    setSaved(true)
    const t = setTimeout(() => setSaved(false), 1200)
    return () => clearTimeout(t)
  }, [data])

  // persist pairings data
  useEffect(() => {
    localStorage.setItem(PAIRINGS_KEY, JSON.stringify(pairingsData))
  }, [pairingsData])

  const tournament   = schedule.find(t => t.id === tid)
  const rawPlayers   = data[tid]?.[flight] ?? []
  const players      = useMemo(() => calcFlightPOY(rawPlayers), [rawPlayers])
  const totalPlayers = FLIGHTS.reduce((sum, f) => sum + (data[tid]?.[f]?.length ?? 0), 0)

  // all names entered for this tournament across all flights
  const allAddedNames = useMemo(() => {
    const names = new Set()
    for (const fl of FLIGHTS) {
      for (const p of (data[tid]?.[fl] ?? [])) names.add(p.name)
    }
    return names
  }, [data, tid])

  // pool members grouped by their season flight from members.json
  const poolMembersGrouped = useMemo(() => {
    const search = poolSearch.trim().toLowerCase()
    const filtered = membersData.filter(m =>
      !allAddedNames.has(m.name) &&
      (search === '' || m.name.toLowerCase().includes(search))
    )
    const groups = {}
    for (const f of [...FLIGHTS, null]) {
      const key = f ?? '__unassigned__'
      groups[key] = filtered.filter(m => f === null ? m.flight == null : m.flight === f)
    }
    return groups
  }, [allAddedNames, poolSearch])

  const poolTotalCount = useMemo(
    () => Object.values(poolMembersGrouped).reduce((s, g) => s + g.length, 0),
    [poolMembersGrouped]
  )

  // pairings derived
  const currentPairings = pairingsData[tid] ?? []
  const pairedNames     = useMemo(
    () => new Set(currentPairings.flatMap(c => c.players.map(p => p.name))),
    [currentPairings]
  )
  const unpairedPlayers = useMemo(
    () => FLIGHTS.flatMap(fl =>
      (data[tid]?.[fl] ?? [])
        .filter(p => !pairedNames.has(p.name))
        .map(p => ({ name: p.name, flight: fl }))
    ),
    [data, tid, pairedNames]
  )

  // ── Score data mutations ────────────────────────────────────────────────────
  function flightSet(newList) {
    setData(prev => ({ ...prev, [tid]: { ...(prev[tid] ?? {}), [flight]: newList } }))
  }

  function insertPlayer(name, atIdx) {
    if (allAddedNames.has(name)) return
    const fl = [...rawPlayers]
    fl.splice(atIdx, 0, { name, ptm: '', score: '', eligible: true })
    flightSet(fl)
  }

  function addPlayer(name) {
    if (allAddedNames.has(name)) return
    flightSet([...rawPlayers, { name, ptm: '', score: '', eligible: true }])
  }

  function removePlayer(idx) {
    const fl = [...rawPlayers]; fl.splice(idx, 1); flightSet(fl)
  }

  function reorderPlayer(fromIdx, toIdx) {
    if (fromIdx === toIdx) return
    const fl     = [...rawPlayers]
    const [item] = fl.splice(fromIdx, 1)
    fl.splice(toIdx <= fromIdx ? toIdx : toIdx - 1, 0, item)
    flightSet(fl)
  }

  function updatePlayer(idx, field, val) {
    const fl = [...rawPlayers]
    fl[idx]  = { ...fl[idx], [field]: val }
    flightSet(fl)
  }

  function clearFlight() {
    if (!window.confirm(`Clear all players from ${flight}?`)) return
    flightSet([])
  }

  // move player to a different flight (promote/relegate)
  function movePlayerToFlight(playerIdx, targetFlight) {
    const player = rawPlayers[playerIdx]
    if (!player) return
    setData(prev => {
      const td = { ...(prev[tid] ?? {}) }
      const srcList = [...(td[flight] ?? [])]
      srcList.splice(playerIdx, 1)
      td[flight] = srcList
      const dstList = [...(td[targetFlight] ?? [])]
      dstList.push({ ...player })
      td[targetFlight] = dstList
      return { ...prev, [tid]: td }
    })
  }

  // ── Score drag handlers ─────────────────────────────────────────────────────
  function onDragStartPool(e, name) {
    dragRef.current = { source: 'pool', name }
    e.dataTransfer.effectAllowed = 'copy'
  }

  function onDragStartRow(e, idx) {
    dragRef.current = { source: 'flight', fromIdx: idx }
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOverRow(e, rowIdx) {
    e.preventDefault()
    e.dataTransfer.dropEffect = dragRef.current?.source === 'pool' ? 'copy' : 'move'
    setDragOverRow(rowIdx)
    setDragOverPool(false)
  }

  function onDragOverZone(e) {
    e.preventDefault()
    setDragOverRow('zone')
    setDragOverPool(false)
  }

  function onDragOverPool(e) {
    e.preventDefault()
    if (dragRef.current?.source === 'flight') {
      setDragOverPool(true)
      setDragOverRow(null)
    }
  }

  function onDropRow(e, rowIdx) {
    e.preventDefault()
    const d = dragRef.current
    if (!d) return
    if (d.source === 'pool')   insertPlayer(d.name, rowIdx)
    if (d.source === 'flight') reorderPlayer(d.fromIdx, rowIdx)
    resetDrag()
  }

  function onDropZone(e) {
    e.preventDefault()
    const d = dragRef.current
    if (!d) return
    if (d.source === 'pool')   addPlayer(d.name)
    if (d.source === 'flight') reorderPlayer(d.fromIdx, rawPlayers.length)
    resetDrag()
  }

  function onDropPool(e) {
    e.preventDefault()
    const d = dragRef.current
    if (d?.source === 'flight') removePlayer(d.fromIdx)
    resetDrag()
  }

  function resetDrag() {
    dragRef.current = null
    setDragOverRow(null)
    setDragOverPool(false)
  }

  // ── Pairings functions ──────────────────────────────────────────────────────
  function generatePairings() {
    const allPlayers = FLIGHTS.flatMap(fl =>
      (data[tid]?.[fl] ?? []).map(p => ({ name: p.name, flight: fl }))
    )
    if (!allPlayers.length) return
    allPlayers.sort((a, b) => FLIGHTS.indexOf(a.flight) - FLIGHTS.indexOf(b.flight))
    const numGroups = Math.ceil(allPlayers.length / groupSize)
    const groups    = Array.from({ length: numGroups }, () => [])
    allPlayers.forEach((p, i) => groups[i % numGroups].push(p))
    const newPairings = groups.map((ps, i) => ({ pairing: `Pairing ${i + 1}`, players: ps }))
    setPairingsData(prev => ({ ...prev, [tid]: newPairings }))
  }

  function clearPairings() {
    if (!window.confirm('Clear all pairings for this tournament?')) return
    setPairingsData(prev => ({ ...prev, [tid]: [] }))
  }

  function removePairedPlayer(cardIdx, playerIdx) {
    const updated = currentPairings.map((c, ci) =>
      ci === cardIdx
        ? { ...c, players: c.players.filter((_, pi) => pi !== playerIdx) }
        : c
    )
    setPairingsData(prev => ({ ...prev, [tid]: updated }))
  }

  function onPDragStart(e, cardIdx, playerIdx) {
    pDragRef.current = { cardIdx, playerIdx }
    e.dataTransfer.effectAllowed = 'move'
  }

  function onPDragOver(e, cardIdx) {
    e.preventDefault()
    setPDragOver(cardIdx)
  }

  function onPDrop(e, targetCardIdx) {
    e.preventDefault()
    const d = pDragRef.current
    if (!d || d.cardIdx === targetCardIdx) { pDragRef.current = null; setPDragOver(null); return }
    const updated = currentPairings.map(c => ({ ...c, players: [...c.players] }))
    const [player] = updated[d.cardIdx].players.splice(d.playerIdx, 1)
    updated[targetCardIdx].players.push(player)
    setPairingsData(prev => ({ ...prev, [tid]: updated }))
    pDragRef.current = null
    setPDragOver(null)
  }

  function exportPairings() {
    if (!tournament || !currentPairings.length) return
    const slug = tid.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    downloadJSON(
      { id: tid, tournament: tournament.name, source: 'CGA Admin', pairings: currentPairings },
      `${slug}-pairings.json`
    )
  }

  // ── Results export ──────────────────────────────────────────────────────────
  function doExport() {
    if (!tournament) return
    const flightWinners = [], leaderboard = {}
    for (const fl of FLIGHTS) {
      const ps      = calcFlightPOY(data[tid]?.[fl] ?? [])
      const ranked  = [...ps].filter(p => p.rank != null).sort((a, b) => a.rank - b.rank || b.plusMinus - a.plusMinus)
      const allRows = [...ranked, ...ps.filter(p => p.rank == null)]
      leaderboard[fl] = allRows.map(p => ({
        rank: p.rank ?? 0, name: p.name, poy: p.poy ?? 0,
        points: Number(p.score) || 0, ptm: Number(p.ptm) || 0, plusMinus: p.plusMinus ?? 0,
      }))
      if (ranked[0]) flightWinners.push({ flight: fl, winner: ranked[0].name, points: ranked[0].poy ?? 0 })
    }

    const resultFile = {
      id: tid, name: tournament.name, date: tournament.date, course: tournament.course,
      format: 'Individual Stroke Play', status: 'completed', flightWinners, leaderboard,
    }

    const newPoy = { flights: {} }
    for (const fl of FLIGHTS) {
      const ps = calcFlightPOY(data[tid]?.[fl] ?? [])
      newPoy.flights[fl] = [...ps].sort((a, b) => (b.poy ?? -1) - (a.poy ?? -1))
        .map((p, i) => ({ rank: i + 1, name: p.name, points: p.poy ?? 0, events: 1 }))
    }

    const ptmLookup = Object.fromEntries(membersData.map(m => [m.name, m.ptm]))

    const prevPtmLookup = {}
    for (const fl of FLIGHTS) {
      for (const p of (currentStandings.flights[fl] ?? [])) {
        if (p.ptm != null) prevPtmLookup[p.name] = p.ptm
      }
    }

    const newStandings = { flights: {} }
    for (const fl of FLIGHTS) {
      const ps     = calcFlightPOY(data[tid]?.[fl] ?? [])
      const sorted = [...ps].sort((a, b) => (b.poy ?? -1) - (a.poy ?? -1))
      newStandings.flights[fl] = sorted.map((p, i) => {
        const newPtm   = ptmLookup[p.name] ?? (Number(p.ptm) || null)
        const oldPtm   = prevPtmLookup[p.name] ?? null
        const ptmDelta = (newPtm != null && oldPtm != null) ? +(newPtm - oldPtm).toFixed(2) : 0
        return {
          rank: i + 1, name: p.name, poy: p.poy ?? 0, ptm: newPtm, ptmDelta,
          latestScore: Number(p.score) || null, latestTournament: tournament.name, events: 1, trend: 'up',
        }
      })
    }

    const slug = tid.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    downloadJSON(resultFile, `${slug}-results.json`)
    setTimeout(() => downloadJSON(newPoy,       'poy.json'),       200)
    setTimeout(() => downloadJSON(newStandings, 'standings.json'), 400)
    setExportNote(
      `3 files downloaded.\n` +
      `1. Place ${slug}-results.json → src/data/results/\n` +
      `2. Replace poy.json and standings.json → src/data/\n` +
      `3. In Results.jsx add:\n` +
      `   import r${slug.replace(/-/g, '_')} from '../data/results/${slug}-results.json'\n` +
      `   '${tid}': r${slug.replace(/-/g, '_')}  ← add to resultFiles`
    )
  }

  // ── Derived for promote/relegate ────────────────────────────────────────────
  const flightIdx  = FLIGHTS.indexOf(flight)
  const prevFlight = flightIdx > 0                ? FLIGHTS[flightIdx - 1] : null
  const nextFlight = flightIdx < FLIGHTS.length - 1 ? FLIGHTS[flightIdx + 1] : null

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="section-title text-3xl">Tournament Admin</h1>
          <div className="gold-divider" />
        </div>
        {saved && <span className="text-green-600 font-sans text-xs mb-7">Saved ✓</span>}
      </div>

      {/* Tournament selector */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <label className="block text-xs font-sans font-semibold uppercase tracking-widest text-forest mb-2">Tournament</label>
        <select
          value={tid}
          onChange={e => { setTid(e.target.value); setFlight(FLIGHTS[0]); setPoolSearch('') }}
          className="border border-gray-300 rounded px-3 py-2 text-sm font-sans w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-forest"
        >
          {schedule.map(t => <option key={t.id} value={t.id}>{t.name} — {t.date}</option>)}
        </select>
        {tournament && (
          <p className="text-xs text-gray-400 font-sans mt-1.5">
            {tournament.course} · {tournament.format} · {totalPlayers} player{totalPlayers !== 1 ? 's' : ''} entered
          </p>
        )}
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2 mb-5">
        {[['scores', 'Score Entry'], ['pairings', 'Pairings Builder']].map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => setAdminMode(mode)}
            className={`px-4 py-2 text-xs font-sans font-semibold rounded-md transition-colors ${
              adminMode === mode
                ? 'bg-forest text-white'
                : 'bg-white text-gray-500 border border-gray-200 hover:text-forest hover:border-forest'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          SCORE ENTRY MODE
      ════════════════════════════════════════════════════════════════════════ */}
      {adminMode === 'scores' && (
        <>
          {/* Flight tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {FLIGHTS.map(f => {
              const cnt = data[tid]?.[f]?.length ?? 0
              return (
                <button key={f} onClick={() => { setFlight(f); setPoolSearch('') }}
                  className={`px-3 py-1.5 text-xs font-sans font-medium rounded transition-colors ${
                    flight === f ? 'bg-gold text-forest' : 'bg-white text-gray-500 border border-gray-200 hover:text-forest hover:border-gold'
                  }`}
                >
                  {f}{cnt > 0 && <span className="ml-1 opacity-60">({cnt})</span>}
                </button>
              )
            })}
          </div>

          {/* Two-panel drag-and-drop layout */}
          <div className="flex flex-col lg:flex-row gap-4 mb-6" onDragEnd={resetDrag}>

            {/* ── Left: Member pool (grouped by flight) ── */}
            <div className="lg:w-64 flex-shrink-0">
              <div
                className={`bg-white border rounded-lg overflow-hidden h-full transition-colors ${
                  dragOverPool ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}
                onDragOver={onDragOverPool}
                onDrop={onDropPool}
                onDragLeave={() => setDragOverPool(false)}
              >
                <div className="bg-forest px-4 py-2.5">
                  <p className="text-white font-sans text-sm font-semibold">Members</p>
                  <p className="text-white/50 text-xs font-sans mt-0.5">Drag into flight →</p>
                </div>

                {dragOverPool && (
                  <div className="px-4 py-2 bg-red-50 border-b border-red-100">
                    <p className="text-red-500 text-xs font-sans text-center">Drop to remove from flight</p>
                  </div>
                )}

                <div className="px-3 py-2 border-b border-gray-100">
                  <input
                    type="text"
                    value={poolSearch}
                    onChange={e => setPoolSearch(e.target.value)}
                    placeholder="Filter members…"
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-forest"
                  />
                </div>

                <div className="overflow-y-auto" style={{ maxHeight: '460px' }}>
                  {poolTotalCount === 0 && !poolSearch.trim() ? (
                    <p className="text-gray-400 text-xs font-sans text-center py-6">All members added.</p>
                  ) : poolTotalCount === 0 && poolSearch.trim() ? (
                    <p className="text-gray-400 text-xs font-sans text-center py-6">No matches.</p>
                  ) : (
                    <div className="p-2">
                      {[...FLIGHTS, null].map(f => {
                        const key   = f ?? '__unassigned__'
                        const group = poolMembersGrouped[key] ?? []
                        if (!group.length) return null
                        return (
                          <div key={key} className="mb-2">
                            <p className="px-1 pt-1 pb-0.5 text-[10px] font-sans font-semibold uppercase tracking-widest text-gray-400">
                              {f ?? 'Unassigned'}
                            </p>
                            <ul className="space-y-0.5">
                              {group.map(m => (
                                <li
                                  key={m.name}
                                  draggable
                                  onDragStart={e => onDragStartPool(e, m.name)}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded cursor-grab active:cursor-grabbing bg-gray-50 hover:bg-blue-50 hover:border-gold border border-transparent transition-colors select-none"
                                >
                                  <span className="text-gray-300 text-sm leading-none flex-shrink-0">⠿</span>
                                  <span className="font-sans text-xs text-darktext truncate">{m.name}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )
                      })}
                      {poolSearch.trim() && !membersData.some(m => m.name.toLowerCase() === poolSearch.toLowerCase()) && (
                        <li
                          onClick={() => { addPlayer(poolSearch.trim()); setPoolSearch('') }}
                          className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer border border-dashed border-gold text-gold hover:bg-amber-50 transition-colors mt-1"
                        >
                          <span className="text-sm leading-none">+</span>
                          <span className="font-sans text-xs truncate">Add "{poolSearch.trim()}"</span>
                        </li>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Right: Flight panel ── */}
            <div className="flex-1 min-w-0">
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {/* Header */}
                <div className="bg-forest px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-sans text-sm font-semibold">{flight}</span>
                    {(prevFlight || nextFlight) && (
                      <span className="text-white/40 font-sans text-xs">
                        {prevFlight && <span>▲ promotes → {prevFlight}</span>}
                        {prevFlight && nextFlight && <span className="mx-1.5">·</span>}
                        {nextFlight && <span>▼ relegates → {nextFlight}</span>}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gold font-mono text-xs">{rawPlayers.length} players</span>
                    {rawPlayers.length > 0 && (
                      <button onClick={clearFlight} className="text-gray-300 hover:text-red-300 text-xs font-sans transition-colors">
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Score table */}
                {players.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="table-header text-gray-300 w-6 px-2"></th>
                          <th className="table-header text-gray-400 text-left w-10">Rank</th>
                          <th className="table-header text-gray-400 text-left">Player</th>
                          <th className="table-header text-gray-400 text-center">PTM</th>
                          <th className="table-header text-gray-400 text-center">Score</th>
                          <th className="table-header text-gray-400 text-center">+/-</th>
                          <th className="table-header text-gray-400 text-center">POY</th>
                          <th className="table-header text-gray-400 text-center">Elig.</th>
                          <th className="table-header text-gray-400 text-center w-16">Move</th>
                          <th className="table-header text-gray-400 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {players.map((p, idx) => (
                          <tr
                            key={p.name}
                            draggable
                            onDragStart={e => onDragStartRow(e, idx)}
                            onDragOver={e => onDragOverRow(e, idx)}
                            onDrop={e => onDropRow(e, idx)}
                            className={`border-b border-gray-100 last:border-0 transition-colors hover:bg-blue-50 ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                            } ${dragOverRow === idx ? 'border-t-2 border-t-gold' : ''}`}
                          >
                            {/* Drag handle */}
                            <td className="px-2 py-2 text-center cursor-grab active:cursor-grabbing">
                              <span className="text-gray-300 text-sm select-none">⠿</span>
                            </td>
                            {/* Rank */}
                            <td className="px-3 py-2">
                              <span className={`stat-number text-xs font-semibold ${p.rank != null && p.rank <= 3 ? 'text-gold' : 'text-gray-400'}`}>
                                {p.rank ?? '—'}
                              </span>
                            </td>
                            {/* Name */}
                            <td className="px-3 py-2 font-sans text-sm text-darktext whitespace-nowrap">{p.name}</td>
                            {/* PTM */}
                            <td className="px-2 py-1.5 text-center">
                              <input type="number" value={p.ptm} onChange={e => updatePlayer(idx, 'ptm', e.target.value)}
                                className="w-14 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                              />
                            </td>
                            {/* Score */}
                            <td className="px-2 py-1.5 text-center">
                              <input type="number" value={p.score} onChange={e => updatePlayer(idx, 'score', e.target.value)}
                                className="w-14 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                              />
                            </td>
                            {/* +/- */}
                            <td className="px-3 py-2 text-center">
                              <span className={`stat-number text-xs font-semibold ${
                                p.plusMinus == null ? 'text-gray-300' : p.plusMinus > 0 ? 'text-green-600' : p.plusMinus < 0 ? 'text-red-500' : 'text-gray-400'
                              }`}>
                                {fmtPM(p.plusMinus)}
                              </span>
                            </td>
                            {/* POY */}
                            <td className="px-3 py-2 text-center">
                              <span className={`stat-number text-xs font-semibold ${
                                p.eligible === false ? 'text-red-400' : p.poy == null ? 'text-gray-300' : 'text-darktext'
                              }`}>
                                {fmtPOY(p)}
                              </span>
                            </td>
                            {/* Eligible */}
                            <td className="px-3 py-2 text-center">
                              <input type="checkbox" checked={p.eligible !== false}
                                onChange={e => updatePlayer(idx, 'eligible', e.target.checked)}
                                className="accent-forest cursor-pointer w-4 h-4"
                              />
                            </td>
                            {/* Promote / Relegate */}
                            <td className="px-1 py-2 text-center">
                              <div className="flex items-center justify-center gap-0.5">
                                <button
                                  title={prevFlight ? `Promote to ${prevFlight}` : 'Already top flight'}
                                  disabled={!prevFlight}
                                  onClick={() => prevFlight && movePlayerToFlight(idx, prevFlight)}
                                  className="w-6 h-6 flex items-center justify-center rounded text-xs transition-colors disabled:opacity-20 disabled:cursor-not-allowed text-blue-400 hover:text-blue-600 hover:bg-blue-50"
                                >
                                  ▲
                                </button>
                                <button
                                  title={nextFlight ? `Relegate to ${nextFlight}` : 'Already bottom flight'}
                                  disabled={!nextFlight}
                                  onClick={() => nextFlight && movePlayerToFlight(idx, nextFlight)}
                                  className="w-6 h-6 flex items-center justify-center rounded text-xs transition-colors disabled:opacity-20 disabled:cursor-not-allowed text-orange-400 hover:text-orange-600 hover:bg-orange-50"
                                >
                                  ▼
                                </button>
                              </div>
                            </td>
                            {/* Remove */}
                            <td className="px-2 py-2 text-center">
                              <button onClick={() => removePlayer(idx)} className="text-gray-300 hover:text-red-400 text-xl leading-none transition-colors">×</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Drop zone at the bottom of the table */}
                    <div
                      onDragOver={onDragOverZone}
                      onDrop={onDropZone}
                      className={`h-8 transition-colors ${dragOverRow === 'zone' ? 'bg-amber-50 border-t-2 border-t-gold' : ''}`}
                    />
                  </div>
                ) : (
                  /* Empty drop zone */
                  <div
                    onDragOver={onDragOverZone}
                    onDrop={onDropZone}
                    className={`flex flex-col items-center justify-center py-16 border-2 border-dashed m-4 rounded-lg transition-colors ${
                      dragOverRow === 'zone' ? 'border-gold bg-amber-50' : 'border-gray-200'
                    }`}
                  >
                    <span className="text-3xl mb-2 text-gray-300">⠿</span>
                    <p className="text-gray-400 font-sans text-sm">Drag players here from the list</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Export */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-forest font-sans text-xs font-semibold uppercase tracking-widest mb-1">Export & Publish</h2>
            <p className="text-gray-500 font-sans text-xs mb-4 leading-relaxed">
              Downloads 3 updated JSON files. Replace in <code className="bg-gray-100 px-1 rounded">src/data/</code> and commit to publish sitewide.
            </p>
            <button onClick={doExport} className="btn-primary">Download All JSON Files</button>
            {exportNote && (
              <pre className="mt-4 bg-gray-50 border border-gray-200 rounded p-3 text-xs font-mono text-gray-600 whitespace-pre-wrap leading-relaxed">
                {exportNote}
              </pre>
            )}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PAIRINGS BUILDER MODE
      ════════════════════════════════════════════════════════════════════════ */}
      {adminMode === 'pairings' && (
        <div>
          {/* Controls */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-sans font-semibold text-gray-500 uppercase tracking-widest">Group size</span>
              {[3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setGroupSize(n)}
                  className={`w-8 h-8 rounded text-xs font-mono font-bold transition-colors ${
                    groupSize === n ? 'bg-gold text-forest' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {currentPairings.length > 0 && (
                <>
                  <button
                    onClick={generatePairings}
                    className="px-3 py-1.5 text-xs font-sans font-semibold rounded border border-forest text-forest hover:bg-forest hover:text-white transition-colors"
                  >
                    Regenerate
                  </button>
                  <button
                    onClick={exportPairings}
                    className="btn-primary text-xs"
                  >
                    Export Pairings JSON
                  </button>
                  <button
                    onClick={clearPairings}
                    className="px-3 py-1.5 text-xs font-sans rounded border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors"
                  >
                    Clear
                  </button>
                </>
              )}
              {currentPairings.length === 0 && totalPlayers > 0 && (
                <button onClick={generatePairings} className="btn-primary text-xs">
                  Generate Pairings
                </button>
              )}
            </div>
          </div>

          {/* No players entered notice */}
          {totalPlayers === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
              <p className="text-amber-700 font-sans text-sm font-medium mb-1">No players entered yet</p>
              <p className="text-amber-600 font-sans text-xs">Switch to Score Entry to add players to flights first.</p>
            </div>
          )}

          {/* Unpaired players banner */}
          {unpairedPlayers.length > 0 && currentPairings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex flex-wrap items-center gap-3">
              <span className="text-amber-700 font-sans text-xs font-semibold uppercase tracking-widest flex-shrink-0">
                Not yet paired ({unpairedPlayers.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {unpairedPlayers.map(p => (
                  <span key={p.name} className={`text-xs border px-2 py-0.5 rounded-full font-sans ${flightTagStyles[p.flight] ?? flightTagStyles.Unassigned}`}>
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {currentPairings.length === 0 && totalPlayers > 0 && (
            <div className="border-2 border-dashed border-gray-200 rounded-lg py-16 flex flex-col items-center justify-center">
              <p className="text-gray-400 font-sans text-sm mb-4">No pairings generated yet.</p>
              <button onClick={generatePairings} className="btn-primary text-xs">
                Generate Pairings
              </button>
            </div>
          )}

          {/* Pairing cards grid */}
          {currentPairings.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {currentPairings.map((card, cardIdx) => (
                <div
                  key={cardIdx}
                  onDragOver={e => onPDragOver(e, cardIdx)}
                  onDrop={e => onPDrop(e, cardIdx)}
                  onDragLeave={() => setPDragOver(null)}
                  className={`bg-white border rounded-lg overflow-hidden transition-colors ${
                    pDragOver === cardIdx ? 'border-gold ring-2 ring-gold/30' : 'border-gray-200'
                  }`}
                >
                  <div className="bg-forest px-4 py-2 flex items-center justify-between">
                    <span className="text-white font-sans text-xs font-semibold uppercase tracking-widest">
                      {card.pairing}
                    </span>
                    <span className="text-white/50 font-mono text-xs">{card.players.length}</span>
                  </div>
                  <ul className="divide-y divide-gray-100 min-h-[60px]">
                    {card.players.map((player, playerIdx) => (
                      <li
                        key={player.name}
                        draggable
                        onDragStart={e => onPDragStart(e, cardIdx, playerIdx)}
                        className="px-3 py-2.5 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-gray-300 text-xs leading-none flex-shrink-0">⠿</span>
                          <span className="font-sans text-sm text-darktext truncate">{player.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`text-xs border px-1.5 py-0.5 rounded-full font-sans whitespace-nowrap ${flightTagStyles[player.flight] ?? flightTagStyles.Unassigned}`}>
                            {player.flight}
                          </span>
                          <button
                            onClick={() => removePairedPlayer(cardIdx, playerIdx)}
                            className="text-gray-300 hover:text-red-400 text-base leading-none transition-colors ml-0.5"
                          >
                            ×
                          </button>
                        </div>
                      </li>
                    ))}
                    {card.players.length === 0 && (
                      <li className="px-3 py-4 text-center text-gray-300 font-sans text-xs italic">
                        Drag players here
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Pairings export hint */}
          {currentPairings.length > 0 && (
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-500 font-sans text-xs leading-relaxed">
                Export the pairings JSON and place it in <code className="bg-gray-100 px-1 rounded">src/data/pairings/</code>, then
                import it in <code className="bg-gray-100 px-1 rounded">src/pages/Pairings.jsx</code> and add the entry to the{' '}
                <code className="bg-gray-100 px-1 rounded">pairingsById</code> map.
              </p>
            </div>
          )}
        </div>
      )}
    </PageWrapper>
  )
}
