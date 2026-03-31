import { useState, useMemo, useEffect } from 'react'
import PageWrapper from '../components/layout/PageWrapper'
import schedule from '../data/schedule.json'
import membersData from '../data/members.json'

const FLIGHTS = ['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight']
const STORAGE_KEY = 'cga_admin_v1'
const PIN = 'cga2026'

// ── POY calculation ───────────────────────────────────────────────────────────
// Scale: 350, 325, 300 … per position (decrement 25). Tied players average
// those slots. Ineligible players get 0 POY but still occupy their position.
function calcFlightPOY(players) {
  if (!players.length) return players

  const n = players.length
  const scale = Array.from({ length: n }, (_, i) => 350 - 25 * i)

  const withPM = players.map((p, i) => {
    const hasData = p.ptm !== '' && p.score !== '' && p.ptm != null && p.score != null
    return {
      ...p,
      _i: i,
      _has: hasData,
      plusMinus: hasData ? Number(p.score) - Number(p.ptm) : null,
    }
  })

  // Only rank players with scores entered
  const complete = withPM.filter(p => p._has).sort((a, b) => b.plusMinus - a.plusMinus)

  const rankMap = {}
  let pos = 0
  while (pos < complete.length) {
    const val = complete[pos].plusMinus
    const group = []
    let j = pos
    while (j < complete.length && complete[j].plusMinus === val) { group.push(j); j++ }
    const avg = group.reduce((s, idx) => s + (scale[idx] ?? 0), 0) / group.length
    group.forEach(idx => {
      rankMap[complete[idx]._i] = {
        rank: pos + 1,
        poy: complete[idx].eligible !== false ? avg : 0,
      }
    })
    pos = j
  }

  return withPM.map((p, i) => ({
    ...p,
    rank: rankMap[i]?.rank ?? null,
    poy:  rankMap[i]?.poy  ?? null,
  }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtPM(pm) {
  if (pm == null) return '—'
  return pm > 0 ? `+${pm}` : `${pm}`
}

function fmtPOY(p) {
  if (p.poy == null) return '—'
  if (p.eligible === false) return 'X'
  return p.poy % 1 === 0 ? String(p.poy) : p.poy.toFixed(1)
}

function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: filename,
  })
  a.click()
  URL.revokeObjectURL(a.href)
}

// ── Entry point ───────────────────────────────────────────────────────────────
export default function Admin() {
  const [pin, setPin] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [err, setErr] = useState(false)

  const tryUnlock = () => {
    if (pin === PIN) {
      setUnlocked(true)
    } else {
      setErr(true)
      setTimeout(() => setErr(false), 1500)
    }
  }

  if (!unlocked) {
    return (
      <PageWrapper>
        <div className="max-w-xs mx-auto mt-24">
          <h1 className="section-title text-2xl mb-6">Admin</h1>
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && tryUnlock()}
              placeholder="PIN"
              autoFocus
              className={`w-full border rounded px-3 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-forest ${err ? 'border-red-400' : 'border-gray-300'}`}
            />
            {err && <p className="text-red-500 text-xs font-sans">Incorrect PIN.</p>}
            <button onClick={tryUnlock} className="btn-primary w-full text-center">Unlock</button>
          </div>
        </div>
      </PageWrapper>
    )
  }

  return <AdminPanel />
}

// ── Main admin panel ──────────────────────────────────────────────────────────
function AdminPanel() {
  const [data, setData] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
  })
  const [saved, setSaved] = useState(false)
  const [tid, setTid] = useState(schedule[0]?.id ?? '')
  const [flight, setFlight] = useState(FLIGHTS[0])
  const [search, setSearch] = useState('')
  const [exportNote, setExportNote] = useState('')

  // Auto-save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    setSaved(true)
    const t = setTimeout(() => setSaved(false), 1200)
    return () => clearTimeout(t)
  }, [data])

  const tournament  = schedule.find(t => t.id === tid)
  const rawPlayers  = data[tid]?.[flight] ?? []
  const players     = useMemo(() => calcFlightPOY(rawPlayers), [rawPlayers])

  const addedNames  = useMemo(() => new Set(rawPlayers.map(p => p.name)), [rawPlayers])
  const suggestions = useMemo(() =>
    search.trim().length < 1 ? [] :
    membersData
      .filter(m => m.name.toLowerCase().includes(search.toLowerCase()) && !addedNames.has(m.name))
      .slice(0, 8),
  [search, addedNames])

  const totalPlayers = FLIGHTS.reduce((sum, f) => sum + (data[tid]?.[f]?.length ?? 0), 0)

  function switchFlight(f) { setFlight(f); setSearch('') }

  function updatePlayer(idx, field, val) {
    setData(prev => {
      const fl = [...(prev[tid]?.[flight] ?? [])]
      fl[idx] = { ...fl[idx], [field]: field === 'eligible' ? val : val }
      return { ...prev, [tid]: { ...(prev[tid] ?? {}), [flight]: fl } }
    })
  }

  function addPlayer(name) {
    if (addedNames.has(name)) return
    setData(prev => {
      const fl = [...(prev[tid]?.[flight] ?? []), { name, ptm: '', score: '', eligible: true }]
      return { ...prev, [tid]: { ...(prev[tid] ?? {}), [flight]: fl } }
    })
    setSearch('')
  }

  function removePlayer(idx) {
    setData(prev => {
      const fl = [...(prev[tid]?.[flight] ?? [])]
      fl.splice(idx, 1)
      return { ...prev, [tid]: { ...(prev[tid] ?? {}), [flight]: fl } }
    })
  }

  function clearFlight() {
    if (!window.confirm(`Clear all players from ${flight}?`)) return
    setData(prev => ({ ...prev, [tid]: { ...(prev[tid] ?? {}), [flight]: [] } }))
  }

  // ── Export ──────────────────────────────────────────────────────────────────
  function doExport() {
    if (!tournament) return

    const flightWinners = []
    const leaderboard   = {}

    for (const fl of FLIGHTS) {
      const ps     = calcFlightPOY(data[tid]?.[fl] ?? [])
      const ranked = [...ps].filter(p => p.rank != null).sort((a, b) => a.rank - b.rank || b.plusMinus - a.plusMinus)
      const unranked = ps.filter(p => p.rank == null)
      const allRows  = [...ranked, ...unranked]

      leaderboard[fl] = allRows.map(p => ({
        rank:       p.rank ?? 0,
        name:       p.name,
        poy:        p.poy  ?? 0,
        points:     Number(p.score) || 0,
        ptm:        Number(p.ptm)   || 0,
        plusMinus:  p.plusMinus ?? 0,
      }))

      if (ranked[0]) {
        flightWinners.push({ flight: fl, winner: ranked[0].name, points: ranked[0].poy ?? 0 })
      }
    }

    const resultFile = {
      id:     tid,
      name:   tournament.name,
      date:   tournament.date,
      course: tournament.course,
      format: 'Individual Stroke Play',
      status: 'completed',
      flightWinners,
      leaderboard,
    }

    // poy.json — per-flight POY standings sorted by POY desc
    const newPoy = { flights: {} }
    for (const fl of FLIGHTS) {
      const ps     = calcFlightPOY(data[tid]?.[fl] ?? [])
      const sorted = [...ps].sort((a, b) => (b.poy ?? -1) - (a.poy ?? -1))
      newPoy.flights[fl] = sorted.map((p, i) => ({
        rank:   i + 1,
        name:   p.name,
        points: p.poy ?? 0,
        events: 1,
      }))
    }

    // standings.json — all players sorted by Score desc
    const all = []
    for (const fl of FLIGHTS) {
      calcFlightPOY(data[tid]?.[fl] ?? []).forEach(p => all.push({ ...p, flight: fl }))
    }
    all.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0) || (b.plusMinus ?? 0) - (a.plusMinus ?? 0))
    const newStandings = all.map((p, i) => ({
      rank:         i + 1,
      name:         p.name,
      flight:       p.flight,
      points:       Number(p.score) || 0,
      eventsPlayed: 1,
      trend:        'up',
    }))

    const slug = tid.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    downloadJSON(resultFile, `${slug}-results.json`)
    setTimeout(() => downloadJSON(newPoy,       'poy.json'),       200)
    setTimeout(() => downloadJSON(newStandings, 'standings.json'), 400)

    setExportNote(
      `3 files downloaded.\n` +
      `1. Place ${slug}-results.json in src/data/results/\n` +
      `2. Replace poy.json and standings.json in src/data/\n` +
      `3. In Results.jsx add:\n` +
      `   import r${slug.replace(/-/g,'_')} from '../data/results/${slug}-results.json'\n` +
      `   and add '${tid}': r${slug.replace(/-/g,'_')} to resultFiles`
    )
  }

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
        <label className="block text-xs font-sans font-semibold uppercase tracking-widest text-forest mb-2">
          Tournament
        </label>
        <select
          value={tid}
          onChange={e => { setTid(e.target.value); setFlight(FLIGHTS[0]); setSearch('') }}
          className="border border-gray-300 rounded px-3 py-2 text-sm font-sans w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-forest"
        >
          {schedule.map(t => (
            <option key={t.id} value={t.id}>{t.name} — {t.date}</option>
          ))}
        </select>
        {tournament && (
          <p className="text-xs text-gray-400 font-sans mt-1.5">
            {tournament.course} · {tournament.format} · {totalPlayers} player{totalPlayers !== 1 ? 's' : ''} entered
          </p>
        )}
      </div>

      {/* Flight tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FLIGHTS.map(f => {
          const cnt = data[tid]?.[f]?.length ?? 0
          return (
            <button
              key={f}
              onClick={() => switchFlight(f)}
              className={`px-3 py-1.5 text-xs font-sans font-medium rounded transition-colors ${
                flight === f
                  ? 'bg-gold text-forest'
                  : 'bg-white text-gray-500 border border-gray-200 hover:text-forest hover:border-gold'
              }`}
            >
              {f}{cnt > 0 && <span className="ml-1 opacity-60">({cnt})</span>}
            </button>
          )
        })}
      </div>

      {/* Score entry card */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
        {/* Card header */}
        <div className="bg-forest px-4 py-2.5 flex items-center justify-between">
          <span className="text-white font-sans text-sm font-semibold">{flight}</span>
          <div className="flex items-center gap-3">
            <span className="text-gold font-mono text-xs">{rawPlayers.length} players</span>
            {rawPlayers.length > 0 && (
              <button
                onClick={clearFlight}
                className="text-gray-300 hover:text-red-300 text-xs font-sans transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Add player search */}
        <div className="px-4 py-3 border-b border-gray-100 relative">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && search.trim()) {
                if (suggestions.length > 0) {
                  addPlayer(suggestions[0].name)
                } else {
                  addPlayer(search.trim())
                }
              }
              if (e.key === 'Escape') setSearch('')
            }}
            onBlur={() => setTimeout(() => setSearch(''), 200)}
            placeholder="Search to add player… (Enter to add, works for unlisted names too)"
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-forest"
          />
          {suggestions.length > 0 && (
            <div className="absolute left-4 right-4 z-20 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 overflow-hidden">
              {suggestions.map(m => (
                <button
                  key={m.name}
                  onMouseDown={() => addPlayer(m.name)}
                  className="w-full text-left px-4 py-2 text-sm font-sans hover:bg-gray-50 border-b border-gray-50 last:border-0 text-darktext"
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Score table */}
        {players.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="table-header text-gray-400 text-left w-12">Rank</th>
                  <th className="table-header text-gray-400 text-left">Player</th>
                  <th className="table-header text-gray-400 text-center">PTM</th>
                  <th className="table-header text-gray-400 text-center">Score</th>
                  <th className="table-header text-gray-400 text-center">+/-</th>
                  <th className="table-header text-gray-400 text-center">POY</th>
                  <th className="table-header text-gray-400 text-center">Eligible</th>
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
                    <td className="px-4 py-2">
                      <span className={`stat-number text-xs font-semibold ${
                        p.rank != null && p.rank <= 3 ? 'text-gold' : 'text-gray-400'
                      }`}>
                        {p.rank ?? '—'}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="px-4 py-2 font-sans text-sm text-darktext whitespace-nowrap">{p.name}</td>

                    {/* PTM input */}
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="number"
                        value={p.ptm}
                        onChange={e => updatePlayer(idx, 'ptm', e.target.value)}
                        className="w-14 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                      />
                    </td>

                    {/* Score input */}
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="number"
                        value={p.score}
                        onChange={e => updatePlayer(idx, 'score', e.target.value)}
                        className="w-14 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                      />
                    </td>

                    {/* +/- auto */}
                    <td className="px-4 py-2 text-center">
                      <span className={`stat-number text-xs font-semibold ${
                        p.plusMinus == null ? 'text-gray-300'
                        : p.plusMinus > 0   ? 'text-green-600'
                        : p.plusMinus < 0   ? 'text-red-500'
                        : 'text-gray-400'
                      }`}>
                        {fmtPM(p.plusMinus)}
                      </span>
                    </td>

                    {/* POY auto */}
                    <td className="px-4 py-2 text-center">
                      <span className={`stat-number text-xs font-semibold ${
                        p.eligible === false ? 'text-red-400'
                        : p.poy == null      ? 'text-gray-300'
                        : 'text-darktext'
                      }`}>
                        {fmtPOY(p)}
                      </span>
                    </td>

                    {/* Eligible checkbox */}
                    <td className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={p.eligible !== false}
                        onChange={e => updatePlayer(idx, 'eligible', e.target.checked)}
                        className="accent-forest cursor-pointer w-4 h-4"
                      />
                    </td>

                    {/* Remove */}
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => removePlayer(idx)}
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
          <p className="text-gray-400 font-sans text-sm text-center py-10">
            No players added yet. Search above to add players to this flight.
          </p>
        )}
      </div>

      {/* Export section */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-forest font-sans text-xs font-semibold uppercase tracking-widest mb-1">
          Export & Publish
        </h2>
        <p className="text-gray-500 font-sans text-xs mb-4 leading-relaxed">
          Downloads 3 updated JSON files — results, POY standings, and overall standings.
          Replace the files in <code className="bg-gray-100 px-1 rounded text-xs">src/data/</code> and commit to publish sitewide.
        </p>
        <button onClick={doExport} className="btn-primary">
          Download All JSON Files
        </button>

        {exportNote && (
          <pre className="mt-4 bg-gray-50 border border-gray-200 rounded p-3 text-xs font-mono text-gray-600 whitespace-pre-wrap leading-relaxed">
            {exportNote}
          </pre>
        )}
      </div>
    </PageWrapper>
  )
}
