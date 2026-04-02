import { useState, useEffect, useMemo } from 'react'
import PageWrapper from '../components/layout/PageWrapper'
import membersStatic from '../data/members.json'
import ptmStatic from '../data/ptm.json'
import { formatName } from '../utils/formatName'
import TeeTag from '../components/ui/TeeTag'
import { useFireData } from '../hooks/useFireData'
import { DB } from '../db'

const HISTORY_LABELS = ['New', '2nd', '3rd', '4th', '5th', '6th', '7th']

function roundPtm(val) {
  if (val == null) return null
  return Math.round(val)
}

/**
 * Derive PTM-page data from a member record.
 * Members gain history/rounds/ptmAtFlowControl once the Excel has been imported via admin.
 * Falls back to ptm.json shape for backward compat.
 */
function memberToPtmRow(m) {
  const history = Array.isArray(m.history) ? m.history : Array(7).fill(null)
  const rounds = typeof m.rounds === 'number'
    ? m.rounds
    : history.filter(v => v != null).length
  return {
    name:              m.name,
    tee:               m.tee ?? null,
    ptm:               m.ptm ?? null,
    ptmAtFlowControl:  m.ptmAtFlowControl ?? null,
    history,
    rounds,
  }
}

function ScoreCell({ value, ptm }) {
  if (value == null) return <span className="text-gray-300 stat-number">—</span>
  if (ptm == null) return <span className="stat-number text-gray-500">{value}</span>
  const diff = value - ptm
  const color = diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-500'
  const icon = diff > 0 ? '▲' : diff < 0 ? '▼' : null
  return (
    <span className={`stat-number font-medium ${color} inline-flex items-center gap-0.5`}>
      {icon && <span className="text-xs leading-none">{icon}</span>}
      {value}
    </span>
  )
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

function TrendArrow({ ptm, ptmAtFlowControl }) {
  if (ptmAtFlowControl == null || ptm == null) return null
  const roundedCurrent = roundPtm(ptm)
  const roundedPrev = roundPtm(ptmAtFlowControl)
  if (roundedCurrent > roundedPrev) {
    return (
      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
      </svg>
    )
  }
  if (roundedCurrent < roundedPrev) {
    return (
      <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
      </svg>
    )
  }
  return null
}

export default function PointsToMake() {
  useEffect(() => { document.title = 'Points to Make | CGA 2026' }, [])

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [showAll, setShowAll] = useState(false)

  // Use live member data from Firestore; fall back to static members
  // Once the Excel is imported via admin, members will have history/rounds fields
  const { data: liveMembers } = useFireData(DB.listenMembers, membersStatic)

  // Derive ptmData from live members. If a member has no history in Firestore yet,
  // try to find a matching row in the static ptm.json as a secondary fallback.
  const staticPtmByName = useMemo(
    () => Object.fromEntries(ptmStatic.map(r => [r.name, r])),
    []
  )

  const ptmData = useMemo(() => {
    const source = liveMembers ?? membersStatic
    return source.map(m => {
      // If Firestore member already has history, use it directly
      if (Array.isArray(m.history) && m.history.some(v => v != null)) {
        return memberToPtmRow(m)
      }
      // Fall back to static ptm.json for this member if available
      if (staticPtmByName[m.name]) {
        return staticPtmByName[m.name]
      }
      return memberToPtmRow(m)
    })
  }, [liveMembers, staticPtmByName])

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return ptmData.filter(p => !q || p.name.toLowerCase().includes(q))
  }, [search, ptmData])

  const active = useMemo(
    () => showAll ? filtered : filtered.filter(p => p.ptm != null || p.ptmAtFlowControl != null),
    [filtered, showAll]
  )

  const sorted = useMemo(() => {
    return [...active].sort((a, b) => {
      let av = a[sortKey]
      let bv = b[sortKey]
      if (sortKey === 'name') {
        const ca = formatName(av ?? '')
        const cb = formatName(bv ?? '')
        const cmp = ca.localeCompare(cb)
        return sortDir === 'asc' ? cmp : -cmp
      }
      if (sortKey === 'ptm') {
        av = roundPtm(a.ptm) ?? -Infinity
        bv = roundPtm(b.ptm) ?? -Infinity
        return sortDir === 'asc' ? av - bv : bv - av
      }
      av = av ?? -Infinity
      bv = bv ?? -Infinity
      return sortDir === 'asc' ? av - bv : bv - av
    })
  }, [active, sortKey, sortDir])

  return (
    <PageWrapper>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">Points to Make</h1>
        <div className="gold-divider" />
        <p className="text-gray-600 font-sans text-sm max-w-2xl leading-relaxed mt-3">
          Each player's PTM (the target they were playing against at the Flow Control Open) plus
          their last 7 rounds from most recent (New) to oldest (7th). When a new score is added,
          all scores shift right and the 7th drops off.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
          <input
            type="checkbox"
            checked={showAll}
            onChange={e => setShowAll(e.target.checked)}
            className="accent-forest rounded"
          />
          Show players without PTM
        </label>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-4 mb-5 text-sm font-sans text-gray-500">
        <span>
          Showing <span className="text-darktext font-semibold stat-number">{sorted.length}</span> players
        </span>
        <span>·</span>
        <span>
          <span className="text-green-600 font-semibold">▲</span>
          <span className="text-green-600 font-semibold stat-number ml-0.5">Green</span> = above PTM
          &nbsp;·&nbsp;
          <span className="text-red-500 font-semibold">▼</span>
          <span className="text-red-500 font-semibold stat-number ml-0.5">Red</span> = below PTM
        </span>
      </div>

      {/* Mobile cards — visible below sm */}
      <div className="sm:hidden space-y-2 mb-6">
        {sorted.length === 0 ? (
          <p className="text-center text-gray-400 font-sans text-sm py-8">No players found.</p>
        ) : sorted.map((player, idx) => {
          const displayPtm = roundPtm(player.ptm)
          const noPtm = displayPtm == null
          return (
            <div
              key={player.name}
              className={`border border-gray-200 rounded-lg p-3 ${
                noPtm ? 'opacity-50 bg-white' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
              }`}
            >
              {/* Header: name + PTM */}
              <div className="flex items-center gap-2 mb-2">
                <span className="font-sans text-darktext font-medium flex-1 min-w-0 truncate">
                  {formatName(player.name)}
                </span>
                <TeeTag tee={player.tee} />
                {displayPtm != null ? (
                  <span className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 font-sans">PTM</span>
                    <span className="stat-number font-bold text-forest">{displayPtm}</span>
                    <TrendArrow ptm={player.ptm} ptmAtFlowControl={player.ptmAtFlowControl} />
                  </span>
                ) : (
                  <span className="text-gray-300 stat-number text-sm">—</span>
                )}
              </div>
              {/* Recent scores row */}
              <div className="flex items-end gap-3 flex-wrap">
                {player.history.slice(0, 5).map((score, hi) => (
                  <div key={hi} className="flex flex-col items-center">
                    <span className="text-gray-400 font-sans text-xs leading-none mb-0.5">
                      {HISTORY_LABELS[hi]}
                    </span>
                    <ScoreCell value={score} ptm={displayPtm} />
                  </div>
                ))}
                <span className="ml-auto stat-number text-gray-400 text-xs self-end">
                  {player.rounds}/7
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop table — hidden below sm */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="bg-forest border-b border-forest">
              <SortHeader
                label="Player" colKey="name"
                sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
              />
              <SortHeader
                label="PTM" colKey="ptm"
                sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
                tooltip="Points to Make — your handicap target score, calculated from your last 7 rounds."
              />
              {HISTORY_LABELS.map((lbl) => (
                <th key={lbl} className="table-header text-white/70 font-normal">
                  {lbl}
                </th>
              ))}
              <th className="table-header text-white/70 font-normal">Rounds</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-gray-400 font-sans">
                  No players found.
                </td>
              </tr>
            ) : (
              sorted.map((player, idx) => {
                const displayPtm = roundPtm(player.ptm)
                const noPtm = displayPtm == null
                return (
                  <tr
                    key={player.name}
                    className={`border-b border-gray-100 transition-colors hover:bg-blue-50 ${
                      noPtm ? 'opacity-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-sans text-darktext font-medium">{formatName(player.name)}</span>
                        <TeeTag tee={player.tee} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {displayPtm != null
                        ? (
                          <span className="flex items-center gap-1">
                            <span className="stat-number font-bold text-forest text-base">{displayPtm}</span>
                            <TrendArrow ptm={player.ptm} ptmAtFlowControl={player.ptmAtFlowControl} />
                          </span>
                        )
                        : <span className="text-gray-300 stat-number">—</span>
                      }
                    </td>
                    {player.history.map((score, hi) => (
                      <td key={hi} className="px-4 py-2.5">
                        <ScoreCell value={score} ptm={displayPtm} />
                      </td>
                    ))}
                    <td className="px-4 py-2.5">
                      <span className="stat-number text-gray-400 text-xs">{player.rounds}/7</span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Legend / PTM rule reference */}
      <div className="mt-8 bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-forest font-serif text-base font-semibold mb-3">How PTM Is Calculated</h2>
        <ul className="space-y-1.5 text-sm font-sans text-gray-600">
          {[
            'Round 1 — Score posted; PTM is set to this score.',
            'Round 2 — On the "Bubble." PTM = Round 1 score.',
            'Round 3 — On the "Bubble." PTM = best of first 2 scores.',
            'Rounds 4–7 — Drop lowest, average the rest.',
            'Round 8+ — Drop lowest two, average the remaining five.',
            'A player\'s last 7 rounds are recorded at any time. Minimum PTM is 6.',
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
