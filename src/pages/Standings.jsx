import { useState, useEffect, useMemo } from 'react'
import PageWrapper from '../components/layout/PageWrapper'
import StandingsTable from '../components/ui/StandingsTable'
import TeeTag from '../components/ui/TeeTag'
import { computeScratch } from '../utils/computeScratch'
import { formatName } from '../utils/formatName'
import { useFireData } from '../hooks/useFireData'
import { DB } from '../db'

const FLIGHTS = ['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight']
const HISTORY_LABELS = ['New', '2nd', '3rd', '4th', '5th', '6th', '7th']

const hdcpColumns = [
  { key: 'rank',        label: 'Rank',         sortable: false },
  { key: 'name',        label: 'Player',        sortable: true  },
  { key: 'poy',         label: 'HDCP',          sortable: true,  tooltip: 'Handicap Player of the Year points. Top finishers per flight earn points each tournament (base 350, −25 per position).' },
  { key: 'ptm',         label: 'PTM',           sortable: true,  tooltip: 'Points to Make — your handicap target score calculated from your last 7 rounds.' },
  { key: 'ptmDelta',    label: 'PTM Δ',         sortable: true,  tooltip: 'Change in PTM from the Koasati tournament to current PTM. ▼ green = improved (lower target). ▲ red = higher target.' },
  { key: 'latestScore', label: 'Latest Score',  sortable: true,  tooltip: 'Your Stableford score at the most recent tournament.' },
  { key: 'events',      label: 'Events',        sortable: true,  tooltip: 'Number of tournaments played this season.' },
  { key: 'trend',       label: '',              sortable: false  },
]

const scratchColumns = [
  { key: 'rank',       label: 'Rank',        sortable: false },
  { key: 'name',       label: 'Player',       sortable: true  },
  { key: 'scratchPts', label: 'Scratch Pts', sortable: true,  tooltip: 'Total Stableford points scored across all completed tournaments.' },
  { key: 'events',     label: 'Events',       sortable: true,  tooltip: 'Number of tournaments played this season.' },
]

// ── PTM sub-components ───────────────────────────────────────────────────────

function roundPtm(val) {
  if (val == null) return null
  return Math.round(val)
}

function ScoreCell({ value }) {
  if (value == null) return <span className="text-gray-300 stat-number">—</span>
  return <span className="stat-number text-darktext font-medium">{value}</span>
}

function TrendArrow({ ptmDelta }) {
  if (typeof ptmDelta !== 'number') return null
  if (Math.abs(ptmDelta) < Number.EPSILON) return null
  if (ptmDelta > 0) {
    return (
      <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-label="PTM increased">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
      </svg>
    )
  }
  if (ptmDelta < 0) {
    return (
      <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-label="PTM decreased">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
      </svg>
    )
  }
  return null
}

function SortHeader({ label, colKey, sortKey, sortDir, onSort, className = '', tooltip }) {
  return (
    <th
      className={`table-header text-white cursor-pointer select-none ${className}`}
      onClick={() => onSort(colKey)}
      title={tooltip}
    >
      <span className="flex items-center gap-1">
        {label}
        {tooltip && <span className="text-white/40 text-xs" aria-hidden="true">ⓘ</span>}
        {sortKey === colKey
          ? <span className="text-gold">{sortDir === 'asc' ? '↑' : '↓'}</span>
          : <span className="text-white/30">⇅</span>
        }
      </span>
    </th>
  )
}

function PtmTab({ ptmList, liveMembers, ptmDeltaLookup }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [showAll, setShowAll] = useState(false)

  const ptmData = useMemo(() => {
    const memberToPtmRow = (m) => {
      const history = Array.isArray(m.history) ? m.history : Array(7).fill(null)
      const rounds = history.filter(v => typeof v === 'number').length
      return { name: m.name, tee: m.tee ?? null, ptm: m.ptm ?? null, history, rounds, ptmDelta: ptmDeltaLookup[m.name] ?? null }
    }
    return (liveMembers ?? []).map(m => {
      if (Array.isArray(m.history) && m.history.some(v => v != null)) return memberToPtmRow(m)
      const ptmEntry = ptmList?.find(p => p.name === m.name)
      if (ptmEntry) return { ...ptmEntry, ptmDelta: ptmDeltaLookup[m.name] ?? null }
      return memberToPtmRow(m)
    })
  }, [liveMembers, ptmList, ptmDeltaLookup])

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return ptmData.filter(p => !q || p.name.toLowerCase().includes(q))
  }, [search, ptmData])

  const active = useMemo(
    () => showAll ? filtered : filtered.filter(p => p.ptm != null),
    [filtered, showAll]
  )

  const sorted = useMemo(() => {
    return [...active].sort((a, b) => {
      if (sortKey === 'name') {
        const cmp = formatName(a.name ?? '').localeCompare(formatName(b.name ?? ''))
        return sortDir === 'asc' ? cmp : -cmp
      }
      let av = sortKey === 'ptm' ? (roundPtm(a.ptm) ?? -Infinity) : (a[sortKey] ?? -Infinity)
      let bv = sortKey === 'ptm' ? (roundPtm(b.ptm) ?? -Infinity) : (b[sortKey] ?? -Infinity)
      return sortDir === 'asc' ? av - bv : bv - av
    })
  }, [active, sortKey, sortDir])

  return (
    <div>
      <p className="text-gray-600 font-sans text-sm max-w-2xl leading-relaxed mb-5">
        Each player's target score (PTM) plus their last 7 rounds from most recent (New) to oldest (7th).
      </p>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search player…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm font-sans border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-sans text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} className="accent-forest rounded" />
          Show players without PTM
        </label>
      </div>

      <div className="flex flex-wrap gap-4 mb-5 text-sm font-sans text-gray-500">
        <span>Showing <span className="text-darktext font-semibold stat-number">{sorted.length}</span> players</span>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2 mb-6">
        {sorted.length === 0 ? (
          <p className="text-center text-gray-400 font-sans text-sm py-8">No players found.</p>
        ) : sorted.map((player, idx) => {
          const displayPtm = roundPtm(player.ptm)
          const noPtm = displayPtm == null
          return (
            <div key={player.name} className={`border border-gray-200 rounded-lg p-3 ${noPtm ? 'opacity-50 bg-white' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-sans text-darktext font-medium flex-1 min-w-0 truncate">{formatName(player.name)}</span>
                <TeeTag tee={player.tee} />
                {displayPtm != null ? (
                  <span className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 font-sans">PTM</span>
                    <span className="stat-number font-bold text-forest">{displayPtm}</span>
                    <TrendArrow ptmDelta={player.ptmDelta} />
                  </span>
                ) : <span className="text-gray-300 stat-number text-sm">—</span>}
              </div>
              <div className="flex items-end gap-3 flex-wrap">
                {player.history.slice(0, 5).map((score, hi) => (
                  <div key={hi} className="flex flex-col items-center">
                    <span className="text-gray-400 font-sans text-xs leading-none mb-0.5">{HISTORY_LABELS[hi]}</span>
                    <ScoreCell value={score} />
                  </div>
                ))}
                <span className="ml-auto stat-number text-gray-400 text-xs self-end">{player.rounds}/7</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="bg-forest border-b border-forest">
              <SortHeader label="Player" colKey="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortHeader label="PTM" colKey="ptm" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} tooltip="Points to Make — your handicap target score, calculated from your last 7 rounds." />
              {HISTORY_LABELS.map(lbl => (
                <th key={lbl} className="table-header text-white/70 font-normal">{lbl}</th>
              ))}
              <th className="table-header text-white/70 font-normal">Rounds</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-gray-400 font-sans">No players found.</td></tr>
            ) : sorted.map((player, idx) => {
              const displayPtm = roundPtm(player.ptm)
              const noPtm = displayPtm == null
              return (
                <tr key={player.name} className={`border-b border-gray-100 transition-colors hover:bg-blue-50 ${noPtm ? 'opacity-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-darktext font-medium">{formatName(player.name)}</span>
                      <TeeTag tee={player.tee} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {displayPtm != null ? (
                      <span className="flex items-center gap-1">
                        <span className="stat-number font-bold text-forest text-base">{displayPtm}</span>
                        <TrendArrow ptmDelta={player.ptmDelta} />
                      </span>
                    ) : <span className="text-gray-300 stat-number">—</span>}
                  </td>
                  {player.history.map((score, hi) => (
                    <td key={hi} className="px-4 py-2.5"><ScoreCell value={score} /></td>
                  ))}
                  <td className="px-4 py-2.5"><span className="stat-number text-gray-400 text-xs">{player.rounds}/7</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-8 bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-forest font-serif text-base font-semibold mb-3">How PTM Is Calculated</h3>
        <ul className="space-y-1.5 text-sm font-sans text-gray-600">
          {[
            'Round 1 — Score posted; PTM is set to this score.',
            'Round 2 — On the "Bubble." PTM = Round 1 score.',
            'Round 3 — On the "Bubble." PTM = best of first 2 scores.',
            'Rounds 4–7 — Drop lowest, average the rest.',
            'Round 8+ — Drop lowest two, average the remaining five.',
            "A player's last 7 rounds are recorded at any time. Minimum PTM is 6.",
          ].map((line, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ── Main Standings page ──────────────────────────────────────────────────────

export default function Standings() {
  useEffect(() => { document.title = 'Standings | CGA 2026' }, [])
  const [mode, setMode] = useState('ptm')
  const [selectedFlight, setSelectedFlight] = useState('All')

  const { data: standings } = useFireData(DB.listenStandings, { flights: {} })
  const { data: ptmList } = useFireData(DB.listenPtm, [])
  const { data: allResults } = useFireData(DB.listenResults, {})
  const { data: liveMembers } = useFireData(DB.listenMembers, [])

  const roundsFromPtm = useMemo(() => {
    const lookup = {}
    for (const player of ptmList || []) {
      if (player.name && typeof player.rounds === 'number') lookup[player.name] = player.rounds
    }
    return lookup
  }, [ptmList])

  const ptmDeltaLookup = useMemo(() => {
    const lookup = {}
    for (const flight of FLIGHTS) {
      for (const player of standings?.flights?.[flight] || []) {
        if (player?.name && typeof player.ptmDelta === 'number') lookup[player.name] = player.ptmDelta
      }
    }
    return lookup
  }, [standings])

  const liveMemberFlightLookup = useMemo(() => {
    const lookup = {}
    for (const member of liveMembers || []) {
      if (member?.name && member?.flight) lookup[member.name] = member.flight
    }
    return lookup
  }, [liveMembers])

  const flightData = useMemo(
    () => FLIGHTS.flatMap((flight) => (standings?.flights?.[flight] || []).map(row => {
      const rounds = roundsFromPtm[row.name]
      const nextRowBase = { ...row, flight }
      return rounds != null ? { ...nextRowBase, rounds } : nextRowBase
    })),
    [standings, roundsFromPtm]
  )

  const filteredFlightData = useMemo(
    () => selectedFlight === 'All' ? flightData : flightData.filter(row => row.flight === selectedFlight),
    [flightData, selectedFlight]
  )

  const scratchData = useMemo(
    () => computeScratch(allResults ?? {}).map(row => ({
      ...row,
      flight: liveMemberFlightLookup[row.name] ?? null,
    })),
    [allResults, liveMemberFlightLookup]
  )

  const filteredScratchData = useMemo(
    () => selectedFlight === 'All' ? scratchData : scratchData.filter(row => row.flight === selectedFlight),
    [scratchData, selectedFlight]
  )

  const filteredPtmList = useMemo(
    () => selectedFlight === 'All'
      ? ptmList
      : (ptmList ?? []).filter(player => liveMemberFlightLookup[player.name] === selectedFlight),
    [ptmList, selectedFlight, liveMemberFlightLookup]
  )

  const filteredLiveMembers = useMemo(
    () => selectedFlight === 'All'
      ? liveMembers
      : (liveMembers ?? []).filter(member => member.flight === selectedFlight),
    [liveMembers, selectedFlight]
  )

  const latestTournament = filteredFlightData.find(p => p.latestTournament)?.latestTournament ?? null

  const modes = [
    { key: 'hdcp',    label: 'HDCP POY' },
    { key: 'scratch', label: 'Scratch' },
    { key: 'ptm',     label: 'Points to Make' },
  ]

  return (
    <PageWrapper>
      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">2026 Season Standings</h1>
        <div className="gold-divider" />
        {mode === 'hdcp' && (
          <p className="text-gray-600 font-sans text-sm">
            Ranked by Handicap POY points. Click column headers to sort.
            {latestTournament && (
              <span className="ml-1">Latest score from <span className="font-medium text-forest">{latestTournament}</span>.</span>
            )}
          </p>
        )}
        {mode === 'scratch' && (
          <p className="text-gray-600 font-sans text-sm">Ranked by total Stableford points across all completed tournaments.</p>
        )}
      </div>

      {/* Mode tabs */}
      <div className="mb-6 -mx-1 px-1 overflow-x-auto">
        <div className="flex gap-2 w-max min-w-full whitespace-nowrap">
          {modes.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`px-5 py-2 text-sm font-sans font-semibold rounded-lg transition-colors ${
                mode === key ? 'bg-forest text-white' : 'bg-white text-gray-500 border border-gray-200 hover:text-forest hover:border-forest'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <label htmlFor="standings-flight-filter" className="text-sm font-sans font-medium text-gray-600">
          Flight:
        </label>
        <select
          id="standings-flight-filter"
          value={selectedFlight}
          onChange={(e) => setSelectedFlight(e.target.value)}
          className="px-3 py-2 text-sm font-sans rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
        >
          <option value="All">All</option>
          {FLIGHTS.map((flight) => (
            <option key={flight} value={flight}>{flight}</option>
          ))}
        </select>
      </div>

      {mode === 'hdcp' && (
        <div className="animate-tab-in">
          <StandingsTable data={filteredFlightData} columns={hdcpColumns} highlightTop={3} />
        </div>
      )}

      {mode === 'scratch' && (
        <div className="animate-tab-in">
          <StandingsTable data={filteredScratchData} columns={scratchColumns} highlightTop={3} showBubble={false} />
        </div>
      )}

      {mode === 'ptm' && (
        <div className="animate-tab-in">
          <PtmTab ptmList={filteredPtmList} liveMembers={filteredLiveMembers} ptmDeltaLookup={ptmDeltaLookup} />
        </div>
      )}
    </PageWrapper>
  )
}
