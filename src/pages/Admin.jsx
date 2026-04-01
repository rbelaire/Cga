import { useState, useMemo, useEffect } from 'react'
import PageWrapper from '../components/layout/PageWrapper'
import schedule from '../data/schedule.json'
import membersData from '../data/members.json'
import currentStandings from '../data/standings.json'
import { formatName, compareByLastName } from '../utils/formatName'

const FLIGHTS = ['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight']
const STORAGE_KEY    = 'cga_admin_v1'
const PAIRINGS_KEY   = 'cga_pairings_v1'
const MEMBERS_KEY    = 'cga_members_v1'
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

// ── POY calculation ────────────────────────────────────────────────────────────
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

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtPM  = pm => pm == null ? '—' : pm > 0 ? `+${pm}` : `${pm}`
const fmtPOY = p  => p.poy == null ? '—' : p.eligible === false ? 'X' : p.poy % 1 === 0 ? String(p.poy) : p.poy.toFixed(1)

function downloadJSON(obj, filename) {
  const a = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })),
    download: filename,
  })
  a.click()
}

// ── PIN gate ───────────────────────────────────────────────────────────────────
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

// ── Admin panel ────────────────────────────────────────────────────────────────
function AdminPanel() {
  // Tournament score entry data
  const [data, setData] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
  })
  // Pairings data
  const [pairingsData, setPairingsData] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PAIRINGS_KEY)) || {} } catch { return {} }
  })
  // Flight/PTM overrides (flight management tab)
  const [membersOverride, setMembersOverride] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(MEMBERS_KEY))
      if (saved) return saved
    } catch { /* ignore */ }
    // Default: build from membersData
    return Object.fromEntries(membersData.map(m => [m.name, { flight: m.flight, ptm: m.ptm }]))
  })

  const [saved,       setSaved]       = useState(false)
  const [tid,         setTid]         = useState(schedule[0]?.id ?? '')
  const [flight,      setFlight]      = useState(FLIGHTS[0])
  const [poolSearch,  setPoolSearch]  = useState('')
  const [exportNote,  setExportNote]  = useState('')
  const [adminMode,   setAdminMode]   = useState('scores')  // 'scores' | 'pairings' | 'flights'

  // pairings manual mode: unpaired pool → cards
  const [manualPairings,  setManualPairings]  = useState(false)
  const [selectedUnpaired, setSelectedUnpaired] = useState(null)  // name of selected player

  // flight management edit state
  const [flightSearch, setFlightSearch] = useState('')
  const [editingMember, setEditingMember] = useState(null) // name of member being edited inline

  // persist score data and show saved indicator
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    const t = setTimeout(() => {
      setSaved(true)
      const t2 = setTimeout(() => setSaved(false), 1200)
      return () => clearTimeout(t2)
    }, 0)
    return () => clearTimeout(t)
  }, [data])

  // persist pairings
  useEffect(() => {
    localStorage.setItem(PAIRINGS_KEY, JSON.stringify(pairingsData))
  }, [pairingsData])

  // persist member overrides
  useEffect(() => {
    localStorage.setItem(MEMBERS_KEY, JSON.stringify(membersOverride))
  }, [membersOverride])

  const tournament   = schedule.find(t => t.id === tid)
  const rawPlayers   = data[tid]?.[flight] ?? []
  const players      = useMemo(() => calcFlightPOY(rawPlayers), [rawPlayers])
  const totalPlayers = FLIGHTS.reduce((sum, f) => sum + (data[tid]?.[f]?.length ?? 0), 0)

  // All names entered for this tournament across all flights
  const allAddedNames = useMemo(() => {
    const names = new Set()
    for (const fl of FLIGHTS) {
      for (const p of (data[tid]?.[fl] ?? [])) names.add(p.name)
    }
    return names
  }, [data, tid])

  // Effective members list (uses overrides for flight/ptm)
  const effectiveMembers = useMemo(() => {
    return membersData.map(m => ({
      ...m,
      flight: membersOverride[m.name]?.flight ?? m.flight,
      ptm:    membersOverride[m.name]?.ptm    ?? m.ptm,
    }))
  }, [membersOverride])

  const ptmLookup = useMemo(
    () => Object.fromEntries(effectiveMembers.map(m => [m.name, m.ptm])),
    [effectiveMembers]
  )

  // Pool members (not yet in this tournament), grouped by season flight
  const poolMembersGrouped = useMemo(() => {
    const search   = poolSearch.trim().toLowerCase()
    const filtered = effectiveMembers.filter(m =>
      !allAddedNames.has(m.name) &&
      (search === '' || m.name.toLowerCase().includes(search) || formatName(m.name).toLowerCase().includes(search))
    )
    const groups = {}
    for (const f of [...FLIGHTS, null]) {
      const key = f ?? '__unassigned__'
      groups[key] = filtered
        .filter(m => f === null ? m.flight == null : m.flight === f)
        .sort(compareByLastName)
    }
    return groups
  }, [allAddedNames, poolSearch, effectiveMembers])

  const poolTotalCount = useMemo(
    () => Object.values(poolMembersGrouped).reduce((s, g) => s + g.length, 0),
    [poolMembersGrouped]
  )

  // Pairings derived state
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

  // ── Score data mutations ──────────────────────────────────────────────────────
  function flightSet(newList) {
    setData(prev => ({ ...prev, [tid]: { ...(prev[tid] ?? {}), [flight]: newList } }))
  }

  function addPlayer(name) {
    if (allAddedNames.has(name)) return
    const ptm = ptmLookup[name] ?? ''
    flightSet([...rawPlayers, { name, ptm: ptm !== null && ptm !== undefined ? ptm : '', score: '', eligible: true }])
  }

  function removePlayer(idx) {
    const fl = [...rawPlayers]; fl.splice(idx, 1); flightSet(fl)
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

  // Move player to a different flight
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

  const flightIdx  = FLIGHTS.indexOf(flight)
  const prevFlight = flightIdx > 0                  ? FLIGHTS[flightIdx - 1] : null
  const nextFlight = flightIdx < FLIGHTS.length - 1 ? FLIGHTS[flightIdx + 1] : null

  // ── Pairings functions ────────────────────────────────────────────────────────
  function generatePairings() {
    const allPlayers = FLIGHTS.flatMap(fl =>
      (data[tid]?.[fl] ?? []).map(p => ({ name: p.name, flight: fl }))
    )
    if (!allPlayers.length) return

    // Distribute players from different flights into each group of 4
    // Strategy: interleave by flight so each group has players from 4 different flights
    const byFlight = {}
    for (const fl of FLIGHTS) {
      const ps = allPlayers.filter(p => p.flight === fl)
      if (ps.length) byFlight[fl] = ps
    }
    const flightQueues = Object.values(byFlight)
    const numGroups    = Math.ceil(allPlayers.length / 4)
    const groups       = Array.from({ length: numGroups }, () => [])

    // Round-robin assignment across flights to maximize flight diversity
    let groupIdx = 0
    let safetyCounter = 0
    const maxIterations = allPlayers.length * 2 + 10

    while (flightQueues.some(q => q.length > 0) && safetyCounter < maxIterations) {
      safetyCounter++
      // Find the non-empty flight queue whose flight is least represented in current group
      const currentGroup = groups[groupIdx]
      const representedFlights = new Set(currentGroup.map(p => p.flight))
      // Prioritize queues not yet in this group
      const candidates = flightQueues.filter(q => q.length > 0 && !representedFlights.has(q[0].flight))
      const pick = candidates.length > 0 ? candidates[0] : flightQueues.find(q => q.length > 0)
      if (!pick) break
      currentGroup.push(pick.shift())
      if (currentGroup.length >= 4) {
        groupIdx++
        if (groupIdx >= numGroups) groupIdx = numGroups - 1
      }
    }

    const newPairings = groups
      .filter(g => g.length > 0)
      .map((ps, i) => ({ pairing: `Pairing ${i + 1}`, players: ps }))
    setPairingsData(prev => ({ ...prev, [tid]: newPairings }))
    setManualPairings(false)
    setSelectedUnpaired(null)
  }

  function startManualPairings() {
    // Initialize with empty groups if none exist
    if (!currentPairings.length) {
      const numGroups = Math.ceil(totalPlayers / 4) || 1
      const empty = Array.from({ length: numGroups }, (_, i) => ({ pairing: `Pairing ${i + 1}`, players: [] }))
      setPairingsData(prev => ({ ...prev, [tid]: empty }))
    }
    setManualPairings(true)
    setSelectedUnpaired(null)
  }

  function addGroupManual() {
    const idx = currentPairings.length + 1
    setPairingsData(prev => ({
      ...prev,
      [tid]: [...(prev[tid] ?? []), { pairing: `Pairing ${idx}`, players: [] }]
    }))
  }

  function removeGroupManual(cardIdx) {
    const updated = currentPairings.map(c => ({ ...c, players: [...c.players] }))
    // Move players back to unpaired (just remove the group)
    updated.splice(cardIdx, 1)
    // Re-label
    updated.forEach((c, i) => { c.pairing = `Pairing ${i + 1}` })
    setPairingsData(prev => ({ ...prev, [tid]: updated }))
  }

  function assignUnpairedToGroup(cardIdx) {
    if (!selectedUnpaired) return
    const player = unpairedPlayers.find(p => p.name === selectedUnpaired)
    if (!player) return
    const updated = currentPairings.map((c, ci) =>
      ci === cardIdx
        ? { ...c, players: [...c.players, { name: player.name, flight: player.flight }] }
        : c
    )
    setPairingsData(prev => ({ ...prev, [tid]: updated }))
    setSelectedUnpaired(null)
  }

  function clearPairings() {
    if (!window.confirm('Clear all pairings for this tournament?')) return
    setPairingsData(prev => ({ ...prev, [tid]: [] }))
    setManualPairings(false)
    setSelectedUnpaired(null)
  }

  function removePairedPlayer(cardIdx, playerIdx) {
    const updated = currentPairings.map((c, ci) =>
      ci === cardIdx
        ? { ...c, players: c.players.filter((_, pi) => pi !== playerIdx) }
        : c
    )
    setPairingsData(prev => ({ ...prev, [tid]: updated }))
  }

  function exportPairings() {
    if (!tournament || !currentPairings.length) return
    const slug = tid.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    downloadJSON(
      { id: tid, tournament: tournament.name, source: 'CGA Admin', pairings: currentPairings },
      `${slug}-pairings.json`
    )
  }

  // ── Flight management mutations ───────────────────────────────────────────────
  function updateMemberFlight(name, newFlight) {
    setMembersOverride(prev => ({
      ...prev,
      [name]: { ...(prev[name] ?? {}), flight: newFlight || null }
    }))
  }

  function updateMemberPtm(name, newPtm) {
    setMembersOverride(prev => ({
      ...prev,
      [name]: { ...(prev[name] ?? {}), ptm: newPtm === '' ? null : Number(newPtm) }
    }))
  }

  function exportMembersJson() {
    const updated = membersData.map(m => ({
      ...m,
      flight: membersOverride[m.name]?.flight ?? m.flight,
      ptm:    membersOverride[m.name]?.ptm    ?? m.ptm,
    }))
    downloadJSON(updated, 'members.json')
  }

  // ── Results export ────────────────────────────────────────────────────────────
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
    downloadJSON(resultFile,  `${slug}-results.json`)
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

  // ── Render ────────────────────────────────────────────────────────────────────
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
      <div className="flex gap-2 mb-5 flex-wrap">
        {[['scores', 'Score Entry'], ['pairings', 'Pairings Builder'], ['flights', 'Flight Management']].map(([mode, label]) => (
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

      {/* ══════════════════════════════════════════════════════════════════════════
          SCORE ENTRY MODE
      ══════════════════════════════════════════════════════════════════════════ */}
      {adminMode === 'scores' && (
        <ScoreEntryPanel
          flights={FLIGHTS}
          flight={flight}
          setFlight={f => { setFlight(f); setPoolSearch('') }}
          data={data}
          tid={tid}
          players={players}
          rawPlayers={rawPlayers}
          poolMembersGrouped={poolMembersGrouped}
          poolTotalCount={poolTotalCount}
          poolSearch={poolSearch}
          setPoolSearch={setPoolSearch}
          addPlayer={addPlayer}
          removePlayer={removePlayer}
          updatePlayer={updatePlayer}
          clearFlight={clearFlight}
          movePlayerToFlight={movePlayerToFlight}
          prevFlight={prevFlight}
          nextFlight={nextFlight}
          fmtPM={fmtPM}
          fmtPOY={fmtPOY}
          doExport={doExport}
          exportNote={exportNote}
          ptmLookup={ptmLookup}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          PAIRINGS BUILDER MODE
      ══════════════════════════════════════════════════════════════════════════ */}
      {adminMode === 'pairings' && (
        <PairingsPanel
          totalPlayers={totalPlayers}
          currentPairings={currentPairings}
          unpairedPlayers={unpairedPlayers}
          manualPairings={manualPairings}
          selectedUnpaired={selectedUnpaired}
          setSelectedUnpaired={setSelectedUnpaired}
          generatePairings={generatePairings}
          startManualPairings={startManualPairings}
          addGroupManual={addGroupManual}
          removeGroupManual={removeGroupManual}
          assignUnpairedToGroup={assignUnpairedToGroup}
          clearPairings={clearPairings}
          removePairedPlayer={removePairedPlayer}
          exportPairings={exportPairings}
          flightTagStyles={flightTagStyles}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          FLIGHT MANAGEMENT MODE
      ══════════════════════════════════════════════════════════════════════════ */}
      {adminMode === 'flights' && (
        <FlightManagementPanel
          effectiveMembers={effectiveMembers}
          flightSearch={flightSearch}
          setFlightSearch={setFlightSearch}
          editingMember={editingMember}
          setEditingMember={setEditingMember}
          updateMemberFlight={updateMemberFlight}
          updateMemberPtm={updateMemberPtm}
          exportMembersJson={exportMembersJson}
          flightTagStyles={flightTagStyles}
        />
      )}
    </PageWrapper>
  )
}

// ── Score Entry Panel ─────────────────────────────────────────────────────────
function ScoreEntryPanel({
  flights, flight, setFlight, data, tid, players, rawPlayers,
  poolMembersGrouped, poolTotalCount, poolSearch, setPoolSearch,
  addPlayer, removePlayer, updatePlayer, clearFlight, movePlayerToFlight,
  prevFlight, nextFlight, fmtPM, fmtPOY, doExport, exportNote,
}) {
  return (
    <>
      {/* Flight tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {flights.map(f => {
          const cnt = data[tid]?.[f]?.length ?? 0
          return (
            <button key={f} onClick={() => setFlight(f)}
              className={`px-3 py-1.5 text-xs font-sans font-medium rounded transition-colors ${
                flight === f ? 'bg-gold text-forest' : 'bg-white text-gray-500 border border-gray-200 hover:text-forest hover:border-gold'
              }`}
            >
              {f}{cnt > 0 && <span className="ml-1 opacity-60">({cnt})</span>}
            </button>
          )
        })}
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">

        {/* Left: Member pool */}
        <div className="lg:w-72 flex-shrink-0">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-forest px-4 py-2.5">
              <p className="text-white font-sans text-sm font-semibold">Members</p>
              <p className="text-white/50 text-xs font-sans mt-0.5">Tap a name, then tap "Add to Flight"</p>
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
              onAdd={addPlayer}
              currentFlight={flight}
            />
          </div>
        </div>

        {/* Right: Flight panel */}
        <div className="flex-1 min-w-0">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-forest px-4 py-2.5 flex items-center justify-between">
              <span className="text-white font-sans text-sm font-semibold">{flight}</span>
              <div className="flex items-center gap-3">
                <span className="text-gold font-mono text-xs">{rawPlayers.length} players</span>
                {rawPlayers.length > 0 && (
                  <button onClick={clearFlight} className="text-gray-300 hover:text-red-300 text-xs font-sans transition-colors">
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {players.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="table-header text-gray-400 text-left">Rank</th>
                      <th className="table-header text-gray-400 text-left">Player</th>
                      <th className="table-header text-gray-400 text-center">PTM</th>
                      <th className="table-header text-gray-400 text-center">Score</th>
                      <th className="table-header text-gray-400 text-center">+/-</th>
                      <th className="table-header text-gray-400 text-center">POY</th>
                      <th className="table-header text-gray-400 text-center">Elig.</th>
                      <th className="table-header text-gray-400 text-center">Move to Flight</th>
                      <th className="table-header text-gray-400 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p, idx) => (
                      <tr
                        key={p.name}
                        className={`border-b border-gray-100 last:border-0 transition-colors hover:bg-blue-50 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                        }`}
                      >
                        {/* Rank */}
                        <td className="px-3 py-2">
                          <span className={`stat-number text-xs font-semibold ${p.rank != null && p.rank <= 3 ? 'text-gold' : 'text-gray-400'}`}>
                            {p.rank ?? '—'}
                          </span>
                        </td>
                        {/* Name */}
                        <td className="px-3 py-2 font-sans text-sm text-darktext whitespace-nowrap">
                          {formatName(p.name)}
                        </td>
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
                        {/* Move to flight */}
                        <td className="px-2 py-1.5 text-center">
                          <MoveToFlightSelect
                            currentFlight={flight}
                            allFlights={flights}
                            prevFlight={prevFlight}
                            nextFlight={nextFlight}
                            onMove={targetFlight => movePlayerToFlight(idx, targetFlight)}
                          />
                        </td>
                        {/* Remove */}
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => removePlayer(idx)}
                            title="Remove player from this tournament"
                            className="text-gray-300 hover:text-red-400 text-xl leading-none transition-colors"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed m-4 rounded-lg border-gray-200">
                <span className="text-3xl mb-2 text-gray-300">⛳</span>
                <p className="text-gray-400 font-sans text-sm">No players added yet.</p>
                <p className="text-gray-400 font-sans text-xs mt-1">Select a player from the list on the left.</p>
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
  )
}

// ── Member Pool (click-to-add) ────────────────────────────────────────────────
function MemberPool({ poolMembersGrouped, poolTotalCount, poolSearch, onAdd, currentFlight }) {
  const [selected, setSelected] = useState(null)

  function handleSelect(name) {
    setSelected(prev => prev === name ? null : name)
  }

  function handleAdd() {
    if (!selected) return
    onAdd(selected)
    setSelected(null)
  }

  return (
    <div>
      {/* Sticky add bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-3 py-2">
        <button
          onClick={handleAdd}
          disabled={!selected}
          className={`w-full py-2 rounded text-xs font-sans font-semibold transition-colors ${
            selected
              ? 'bg-gold text-forest hover:bg-amber-400'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {selected ? `Add ${formatName(selected)} → ${currentFlight}` : 'Select a player below'}
        </button>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: '440px' }}>
        {poolTotalCount === 0 && !poolSearch.trim() ? (
          <p className="text-gray-400 text-xs font-sans text-center py-6">All members added.</p>
        ) : poolTotalCount === 0 && poolSearch.trim() ? (
          <p className="text-gray-400 text-xs font-sans text-center py-6">No matches.</p>
        ) : (
          <div className="p-2">
            {[...Object.entries(poolMembersGrouped)].map(([key, group]) => {
              if (!group.length) return null
              const label = key === '__unassigned__' ? 'Unassigned' : key
              return (
                <div key={key} className="mb-2">
                  <p className="px-1 pt-1 pb-0.5 text-[10px] font-sans font-semibold uppercase tracking-widest text-gray-400">
                    {label}
                  </p>
                  <ul className="space-y-0.5">
                    {group.map(m => (
                      <li
                        key={m.name}
                        onClick={() => handleSelect(m.name)}
                        className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded cursor-pointer border transition-colors select-none ${
                          selected === m.name
                            ? 'bg-gold/20 border-gold text-forest'
                            : 'bg-gray-50 hover:bg-blue-50 hover:border-blue-200 border-transparent'
                        }`}
                      >
                        <span className="font-sans text-xs text-darktext truncate">{formatName(m.name)}</span>
                        {m.ptm != null && (
                          <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">PTM {m.ptm}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Move to Flight Select ─────────────────────────────────────────────────────
function MoveToFlightSelect({ currentFlight, allFlights, prevFlight, nextFlight, onMove }) {
  const [val, setVal] = useState('')

  const otherFlights = allFlights.filter(f => f !== currentFlight)

  function handleChange(e) {
    const target = e.target.value
    setVal('')
    if (target) onMove(target)
  }

  return (
    <select
      value={val}
      onChange={handleChange}
      className="border border-gray-200 rounded px-1 py-1 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-forest text-gray-500 bg-white min-w-[110px]"
    >
      <option value="">Move to…</option>
      {prevFlight && <option value={prevFlight}>↑ Promote → {prevFlight}</option>}
      {nextFlight && <option value={nextFlight}>↓ Relegate → {nextFlight}</option>}
      <optgroup label="Any flight">
        {otherFlights.map(f => (
          <option key={f} value={f}>{f}</option>
        ))}
      </optgroup>
    </select>
  )
}

// ── Pairings Builder Panel ────────────────────────────────────────────────────
function PairingsPanel({
  totalPlayers, currentPairings, unpairedPlayers, manualPairings,
  selectedUnpaired, setSelectedUnpaired,
  generatePairings, startManualPairings, addGroupManual, removeGroupManual,
  assignUnpairedToGroup, clearPairings, removePairedPlayer, exportPairings,
  flightTagStyles,
}) {
  return (
    <div>
      {/* Controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-sans font-semibold text-gray-500 uppercase tracking-widest">Pairings always in groups of 4</span>
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
          {currentPairings.length > 0 && (
            <>
              <button onClick={exportPairings} className="btn-primary text-xs">
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
        </div>
      </div>

      {/* No players notice */}
      {totalPlayers === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <p className="text-amber-700 font-sans text-sm font-medium mb-1">No players entered yet</p>
          <p className="text-amber-600 font-sans text-xs">Switch to Score Entry to add players to flights first.</p>
        </div>
      )}

      {/* Manual build: unpaired pool */}
      {manualPairings && unpairedPlayers.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <p className="text-xs font-sans font-semibold text-forest uppercase tracking-widest mb-3">
            Unassigned Players — select one, then click a pairing group below
          </p>
          <div className="flex flex-wrap gap-2">
            {unpairedPlayers.map(p => (
              <button
                key={p.name}
                onClick={() => setSelectedUnpaired(prev => prev === p.name ? null : p.name)}
                className={`text-xs border px-3 py-1.5 rounded-full font-sans transition-colors ${
                  selectedUnpaired === p.name
                    ? 'bg-gold border-gold text-forest font-semibold'
                    : (flightTagStyles[p.flight] ?? flightTagStyles.Unassigned)
                }`}
              >
                {formatName(p.name)}
                <span className="ml-1 opacity-60 text-[10px]">{p.flight}</span>
              </button>
            ))}
          </div>
          <button
            onClick={addGroupManual}
            className="mt-3 px-3 py-1.5 text-xs font-sans rounded border border-dashed border-forest text-forest hover:bg-forest/5 transition-colors"
          >
            + Add New Pairing Group
          </button>
        </div>
      )}

      {/* Auto-mode unpaired banner */}
      {!manualPairings && unpairedPlayers.length > 0 && currentPairings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex flex-wrap items-center gap-3">
          <span className="text-amber-700 font-sans text-xs font-semibold uppercase tracking-widest flex-shrink-0">
            Not yet paired ({unpairedPlayers.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {unpairedPlayers.map(p => (
              <span key={p.name} className={`text-xs border px-2 py-0.5 rounded-full font-sans ${flightTagStyles[p.flight] ?? flightTagStyles.Unassigned}`}>
                {formatName(p.name)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {currentPairings.length === 0 && totalPlayers > 0 && (
        <div className="border-2 border-dashed border-gray-200 rounded-lg py-16 flex flex-col items-center justify-center">
          <p className="text-gray-400 font-sans text-sm mb-4">No pairings yet. Choose Auto-Generate or Build Your Own above.</p>
        </div>
      )}

      {/* Pairing cards grid */}
      {currentPairings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {currentPairings.map((card, cardIdx) => (
            <div
              key={cardIdx}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
            >
              <div className="bg-forest px-4 py-2 flex items-center justify-between">
                <span className="text-white font-sans text-xs font-semibold uppercase tracking-widest">
                  {card.pairing}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-white/50 font-mono text-xs">{card.players.length} players</span>
                  {manualPairings && (
                    <button
                      onClick={() => removeGroupManual(cardIdx)}
                      className="text-white/40 hover:text-red-300 text-sm leading-none transition-colors"
                      title="Remove this group"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              <ul className="divide-y divide-gray-100 min-h-[60px]">
                {card.players.map((player, playerIdx) => (
                  <li
                    key={player.name}
                    className="px-3 py-2.5 flex items-center justify-between gap-2"
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
                        className="text-gray-300 hover:text-red-400 text-base leading-none transition-colors ml-0.5"
                        title="Remove from pairing"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
                {card.players.length === 0 && (
                  <li className="px-3 py-4 text-center text-gray-300 font-sans text-xs italic">
                    Empty group
                  </li>
                )}
              </ul>
              {manualPairings && selectedUnpaired && card.players.length < 4 && (
                <div className="border-t border-dashed border-gold/40 p-2">
                  <button
                    onClick={() => assignUnpairedToGroup(cardIdx)}
                    className="w-full py-1.5 text-xs rounded bg-gold/10 text-amber-700 hover:bg-gold/20 font-sans font-semibold transition-colors"
                  >
                    Add {formatName(selectedUnpaired)} here
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Export hint */}
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
  )
}

// ── Flight Management Panel ───────────────────────────────────────────────────
function FlightManagementPanel({
  effectiveMembers, flightSearch, setFlightSearch,
  editingMember, setEditingMember,
  updateMemberFlight, updateMemberPtm, exportMembersJson, flightTagStyles,
}) {
  const filtered = useMemo(() => {
    const s = flightSearch.trim().toLowerCase()
    return [...effectiveMembers]
      .filter(m => s === '' || m.name.toLowerCase().includes(s) || formatName(m.name).toLowerCase().includes(s))
      .sort(compareByLastName)
  }, [effectiveMembers, flightSearch])

  const FLIGHT_OPTIONS = ['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight']

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <p className="text-xs font-sans text-gray-500 leading-relaxed">
            Set each player's flight and PTM here. Changes are saved locally and used throughout the admin panel.
            Export <code className="bg-gray-100 px-1 rounded">members.json</code> to publish to the site.
          </p>
        </div>
        <button onClick={exportMembersJson} className="btn-primary text-xs whitespace-nowrap flex-shrink-0">
          Export members.json
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-forest px-4 py-3 flex items-center gap-3">
          <span className="text-white font-sans text-sm font-semibold">Player Roster</span>
          <span className="text-white/50 font-mono text-xs">{effectiveMembers.length} members</span>
          <div className="ml-auto">
            <input
              type="text"
              value={flightSearch}
              onChange={e => setFlightSearch(e.target.value)}
              placeholder="Search…"
              className="border border-white/20 rounded px-2 py-1 text-xs font-sans bg-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-gold w-40"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="table-header text-gray-500 text-left">Player</th>
                <th className="table-header text-gray-500 text-left">Current Flight</th>
                <th className="table-header text-gray-500 text-center">PTM</th>
                <th className="table-header text-gray-500 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, idx) => {
                const isEditing = editingMember === m.name
                return (
                  <tr
                    key={m.name}
                    className={`border-b border-gray-100 last:border-0 transition-colors ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                    } ${isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    {/* Name */}
                    <td className="px-4 py-2.5 font-sans text-sm text-darktext whitespace-nowrap">
                      {formatName(m.name)}
                    </td>

                    {/* Flight */}
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <select
                          value={m.flight ?? ''}
                          onChange={e => updateMemberFlight(m.name, e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-forest w-full max-w-[180px]"
                          autoFocus
                        >
                          <option value="">— Unassigned —</option>
                          {FLIGHT_OPTIONS.map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-xs border px-2 py-0.5 rounded-full font-sans ${
                          m.flight ? (flightTagStyles[m.flight] ?? flightTagStyles.Unassigned) : flightTagStyles.Unassigned
                        }`}>
                          {m.flight ?? 'Unassigned'}
                        </span>
                      )}
                    </td>

                    {/* PTM */}
                    <td className="px-4 py-2.5 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          value={m.ptm ?? ''}
                          onChange={e => updateMemberPtm(m.name, e.target.value)}
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-forest"
                        />
                      ) : (
                        <span className="stat-number text-xs text-gray-600">
                          {m.ptm ?? '—'}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-2 text-center">
                      {isEditing ? (
                        <button
                          onClick={() => setEditingMember(null)}
                          className="px-3 py-1 text-xs rounded bg-forest text-white hover:bg-forest/80 font-sans font-semibold transition-colors"
                        >
                          Done
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditingMember(m.name)}
                          className="px-3 py-1 text-xs rounded border border-gray-200 text-gray-500 hover:text-forest hover:border-forest font-sans transition-colors"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
