import { useState, useMemo, useEffect } from 'react'
import PageWrapper from '../components/layout/PageWrapper'
import TeeTag from '../components/ui/TeeTag'
import { formatName } from '../utils/formatName'
import { useFireData } from '../hooks/useFireData'
import { DB } from '../db'
import { FLIGHT_ORDER } from '../utils/flightOrder'
import { roundPtm } from '../utils/roundPtm'

// ── Computation ──────────────────────────────────────────────────────────────

function countCurrentYearRounds(allResults) {
  const year = String(new Date().getFullYear())
  const byPlayer = {}
  for (const result of Object.values(allResults ?? {})) {
    if (result?.status !== 'completed') continue
    if (!String(result?.date ?? '').startsWith(year)) continue
    for (const players of Object.values(result.leaderboard ?? {})) {
      for (const player of players ?? []) {
        if (player?.name) byPlayer[player.name] = (byPlayer[player.name] ?? 0) + 1
      }
    }
  }
  return byPlayer
}

function buildRows(ptmList, beginningPtmList, allResults, memberFlightLookup) {
  if (!beginningPtmList?.length || !ptmList?.length) return []

  const beginningLookup = {}
  for (const p of beginningPtmList) {
    if (p.name) beginningLookup[p.name] = p
  }

  const yearRounds = countCurrentYearRounds(allResults)

  return ptmList
    .filter(p => p.name && p.ptm != null && beginningLookup[p.name] != null)
    .map(p => {
      const beg = beginningLookup[p.name]
      // Rule 5: display ACTUAL ptm values — no 6-point floor applied here
      const beginningPtm = beg.ptm
      const currentPtm = p.ptm
      const delta = +(currentPtm - beginningPtm).toFixed(2)
      const totalRounds = p.rounds ?? 0
      const currentYearRounds = yearRounds[p.name] ?? 0
      const qualified = totalRounds >= 7 && currentYearRounds >= 3
      return {
        name: p.name,
        tee: p.tee ?? beg.tee ?? null,
        flight: memberFlightLookup[p.name] ?? beg.flight ?? null,
        beginningPtm,
        currentPtm,
        delta,
        totalRounds,
        currentYearRounds,
        qualified,
      }
    })
}

// ── Sub-components ───────────────────────────────────────────────────────────

function formatDelta(delta) {
  if (delta == null) return '—'
  if (delta === 0) return '0'
  return delta > 0 ? `+${delta}` : `${delta}`
}

function DeltaCell({ delta }) {
  if (delta == null) return <span className="stat-number text-gray-400">—</span>
  const color = delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-gray-500'
  return <span className={`stat-number font-semibold ${color}`}>{formatDelta(delta)}</span>
}

function LeaderBadge() {
  return (
    <span className="ml-1.5 text-[10px] font-sans font-bold px-1.5 py-0.5 rounded bg-gold/20 text-amber-700 border border-gold/40 whitespace-nowrap leading-none">
      Leader
    </span>
  )
}

function NQBadge() {
  return (
    <span className="ml-1.5 text-[10px] font-sans font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap leading-none">
      NQ
    </span>
  )
}

function MobileCard({ row, isLeader }) {
  return (
    <div className={`border rounded-lg p-3 ${row.qualified ? 'bg-white border-gray-200' : 'bg-amber-50 border-amber-200'}`}>
      <div className="flex items-center gap-2 mb-2">
        {row.rank != null ? (
          <span className={`stat-number font-semibold text-sm w-7 flex-shrink-0 ${isLeader ? 'text-gold' : 'text-gray-400'}`}>
            #{row.rank}
          </span>
        ) : (
          <span className="stat-number text-sm w-7 flex-shrink-0 text-gray-300">—</span>
        )}
        <span className="font-sans text-darktext font-medium flex-1 min-w-0 truncate">
          {formatName(row.name)}
        </span>
        {isLeader && <LeaderBadge />}
        {!row.qualified && <NQBadge />}
        <TeeTag tee={row.tee} />
      </div>
      <div className="pl-7 flex flex-wrap gap-x-4 gap-y-1 text-xs font-sans">
        <div>
          <span className="text-gray-400 uppercase tracking-wide">Improvement</span>
          <div className="text-sm"><DeltaCell delta={row.delta} /></div>
        </div>
        <div>
          <span className="text-gray-400 uppercase tracking-wide">Beg PTM</span>
          <div className="stat-number text-darktext">{roundPtm(row.beginningPtm) ?? '—'}</div>
        </div>
        <div>
          <span className="text-gray-400 uppercase tracking-wide">Cur PTM</span>
          <div className="stat-number text-darktext">{roundPtm(row.currentPtm) ?? '—'}</div>
        </div>
        <div>
          <span className="text-gray-400 uppercase tracking-wide">Rounds</span>
          <div className="stat-number text-gray-500">{row.totalRounds}/7 · {row.currentYearRounds} yr</div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function MostImproved() {
  useEffect(() => { document.title = 'Most/Least Improved | CGA 2026' }, [])

  const [mode, setMode] = useState('most')
  const [selectedFlight, setSelectedFlight] = useState('All')
  const [search, setSearch] = useState('')

  const { data: ptmList }          = useFireData(DB.listenPtm, [])
  const { data: beginningPtmList } = useFireData(DB.listenBeginningPtm, [])
  const { data: allResults }       = useFireData(DB.listenResults, {})
  const { data: liveMembers }      = useFireData(DB.listenMembers, [])

  const memberFlightLookup = useMemo(() => {
    const lookup = {}
    for (const m of liveMembers ?? []) {
      if (m?.name) lookup[m.name] = m.flight
    }
    return lookup
  }, [liveMembers])

  const allRows = useMemo(
    () => buildRows(ptmList, beginningPtmList, allResults, memberFlightLookup),
    [ptmList, beginningPtmList, allResults, memberFlightLookup]
  )

  // Sort, then assign sequential rank only to qualified players
  const sortedWithRank = useMemo(() => {
    const list = [...allRows].sort((a, b) =>
      mode === 'most' ? b.delta - a.delta : a.delta - b.delta
    )
    let rank = 0
    return list.map(row => ({ ...row, rank: row.qualified ? ++rank : null }))
  }, [allRows, mode])

  const filtered = useMemo(() => {
    let rows = sortedWithRank
    if (selectedFlight !== 'All') rows = rows.filter(r => r.flight === selectedFlight)
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(r => r.name?.toLowerCase().includes(q))
    }
    return rows
  }, [sortedWithRank, selectedFlight, search])

  // The leader is the first qualified player in the visible filtered list
  const leaderName = filtered.find(r => r.qualified)?.name ?? null

  const hasData = (beginningPtmList?.length ?? 0) > 0

  return (
    <PageWrapper>
      {/* Header */}
      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">Most / Least Improved</h1>
        <div className="gold-divider" />
        <p className="text-gray-600 font-sans text-sm max-w-2xl leading-relaxed">
          Players ranked by the change in PTM from the start of the season to today.
          Qualification requires 7 or more total rounds and at least 3 in the current year.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="mb-6 flex gap-2">
        {[
          { key: 'most',  label: 'Most Improved'  },
          { key: 'least', label: 'Least Improved' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`px-5 py-2 text-sm font-sans font-semibold rounded-lg transition-colors ${
              mode === key
                ? 'bg-forest text-white'
                : 'bg-white text-gray-500 border border-gray-200 hover:text-forest hover:border-forest'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-3">
          <label htmlFor="mi-flight" className="text-sm font-sans font-medium text-gray-600">Flight:</label>
          <select
            id="mi-flight"
            value={selectedFlight}
            onChange={e => setSelectedFlight(e.target.value)}
            className="px-3 py-2 text-sm font-sans rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
          >
            <option value="All">All</option>
            {FLIGHT_ORDER.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
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
      </div>

      {!hasData ? (
        <div className="rounded-lg border border-gray-100 bg-gray-50 py-16 text-center">
          <p className="text-gray-400 font-sans text-sm">No beginning-of-year PTM data set yet.</p>
          <p className="text-gray-400 font-sans text-xs mt-1">An admin must save the beginning-of-year PTM snapshot before this page is active.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-100 bg-gray-50 py-12 text-center">
          <p className="text-gray-400 font-sans text-sm">No players found.</p>
        </div>
      ) : (
        <>
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-4 text-xs font-sans text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-50 border border-amber-200 inline-block flex-shrink-0" />
              Not qualified (highlighted)
            </span>
            <span>Highest non-highlighted player = leader</span>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2 mb-6">
            {filtered.map(row => (
              <MobileCard key={row.name} row={row} isLeader={row.name === leaderName} />
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="bg-forest border-b border-forest">
                  <th className="table-header text-white">Rank</th>
                  <th className="table-header text-white">Player</th>
                  <th className="table-header text-white" title="Change in PTM from beginning of year to today. Positive = improved.">
                    <span className="flex items-center gap-1">
                      Improvement <span className="text-white/40 text-xs" aria-hidden="true">ⓘ</span>
                    </span>
                  </th>
                  <th className="table-header text-white/80 font-normal" title="PTM at start of season">Beg PTM</th>
                  <th className="table-header text-white/80 font-normal" title="Current PTM">Cur PTM</th>
                  <th className="table-header text-white/80 font-normal" title="Total rounds / current-year rounds">Rounds</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, idx) => {
                  const isLeader = row.name === leaderName
                  return (
                    <tr
                      key={row.name}
                      className={`border-b border-gray-100 transition-colors hover:bg-blue-50 ${
                        row.qualified
                          ? idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                          : 'bg-amber-50'
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        {row.rank != null ? (
                          <span className={`stat-number font-semibold ${isLeader ? 'text-gold' : 'text-gray-500'}`}>
                            {isLeader ? `#${row.rank}` : row.rank}
                          </span>
                        ) : (
                          <span className="stat-number text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-sans text-darktext ${isLeader ? 'font-semibold' : 'font-medium'}`}>
                            {formatName(row.name)}
                          </span>
                          <TeeTag tee={row.tee} />
                          {isLeader && <LeaderBadge />}
                          {!row.qualified && <NQBadge />}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <DeltaCell delta={row.delta} />
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="stat-number text-darktext">{roundPtm(row.beginningPtm) ?? '—'}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="stat-number text-darktext">{roundPtm(row.currentPtm) ?? '—'}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="stat-number text-gray-500 text-xs">
                          {row.totalRounds}/7 · <span className={row.currentYearRounds < 3 ? 'text-amber-600' : ''}>{row.currentYearRounds} yr</span>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Rules box */}
      <div className="mt-8 bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-forest font-serif text-base font-semibold mb-3">Qualification &amp; Rules</h3>
        <ul className="space-y-1.5 text-sm font-sans text-gray-600">
          {[
            'A player must have a minimum of 7 rounds played totally and 3 in the current year.',
            "Players' current PTM is compared to their beginning-of-year PTM. The resulting +/− determines standing.",
            'Non-qualified players are highlighted. The highest non-highlighted player is the leader.',
            'If a player has less than 6 PTM, the 6-point minimum does not apply — actual PTM values are displayed.',
          ].map((line, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </PageWrapper>
  )
}
