import { useState } from 'react'
import { formatName } from '../../utils/formatName'

function isBubble(rounds) {
  return typeof rounds === 'number' && rounds >= 1 && rounds < 4
}

function getBubbleRounds(row) {
  if (typeof row.rounds === 'number') return row.rounds
  return row.events
}

const TREND_ICONS = {
  up: '↑',
  down: '↓',
  stable: '–',
}
const TREND_COLORS = {
  up: 'text-green-600',
  down: 'text-red-500',
  stable: 'text-gray-400',
}

function CellValue({ col, row, idx, highlightTop, showBubble }) {
  if (col.key === 'rank') return (
    <span className={`stat-number font-semibold ${idx < highlightTop ? 'text-gold' : 'text-gray-500'}`}>
      {idx < highlightTop ? `#${row.rank || idx + 1}` : row.rank || idx + 1}
    </span>
  )
  if (col.key === 'name') return (
    <span className="flex items-center gap-1.5 flex-wrap">
      <span className={`font-sans ${idx < highlightTop ? 'text-darktext font-semibold' : 'text-darktext'}`}>
        {formatName(row.name)}
      </span>
      {showBubble && isBubble(getBubbleRounds(row)) && (
        <span className="text-xs font-sans font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200 whitespace-nowrap">
          Bubble
        </span>
      )}
    </span>
  )
  if (col.key === 'points') return (
    <span className="stat-number text-darktext font-medium">{row.points}</span>
  )
  if (col.key === 'poy') return (
    <span className={`stat-number font-semibold ${row.poy > 0 ? 'text-gold' : 'text-gray-400'}`}>
      {row.poy}
    </span>
  )
  if (col.key === 'ptm') return (
    <span className="stat-number text-gray-600">{row.ptm ?? '—'}</span>
  )
  if (col.key === 'ptmDelta') {
    const d = row.ptmDelta
    if (d == null || d === 0) return <span className="stat-number text-gray-400">—</span>
    const color = d > 0 ? 'text-red-500' : 'text-green-600'
    const icon = d > 0 ? '▲' : '▼'
    const label = d > 0 ? `+${d}` : `${d}`
    return <span className={`stat-number font-semibold ${color}`}>{icon} {label}</span>
  }
  if (col.key === 'latestScore') return (
    <span className="stat-number text-darktext font-medium">{row.latestScore ?? '—'}</span>
  )
  if (col.key === 'eventsPlayed') return (
    <span className="stat-number text-gray-500">{row.eventsPlayed ?? row.events}</span>
  )
  if (col.key === 'events') return (
    <span className="stat-number text-gray-500">{row.events}</span>
  )
  if (col.key === 'scratchPts') return (
    <span className="stat-number font-semibold text-darktext">{row.scratchPts ?? '—'}</span>
  )
  if (col.key === 'trend') return row.trend ? (
    <span className={`text-base font-bold ${TREND_COLORS[row.trend]}`}>
      {TREND_ICONS[row.trend]}
    </span>
  ) : null
  if (col.key === 'flight') return (
    <span className="text-xs text-forest font-sans bg-blue-50 border border-blue-100 px-2 py-0.5 rounded whitespace-nowrap">
      {row.flight}
    </span>
  )
  return <span className="text-darktext font-sans">{row[col.key]}</span>
}

export default function StandingsTable({ data, columns, highlightTop = 3, showBubble = true }) {
  const defaultColumns = columns || [
    { key: 'rank', label: 'Rank', sortable: false },
    { key: 'name', label: 'Player', sortable: true },
    { key: 'points', label: 'Points', sortable: true },
    { key: 'eventsPlayed', label: 'Events', sortable: true },
    { key: 'trend', label: '', sortable: false },
  ]

  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50 py-12 text-center">
        <p className="text-gray-400 font-sans text-sm">No players in this flight yet.</p>
      </div>
    )
  }

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = a[sortKey]
        const bv = b[sortKey]
        if (av == null && bv == null) return 0
        if (av == null) return 1
        if (bv == null) return -1
        const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
        return sortDir === 'asc' ? cmp : -cmp
      })
    : data

  const metricCols = defaultColumns.filter(c => !['rank', 'name', 'trend'].includes(c.key))
  const primaryMetricCol = metricCols.find((c) => ['poy', 'scratchPts', 'points'].includes(c.key))
  const secondaryMetricCols = metricCols.filter((c) => c.key !== primaryMetricCol?.key)

  return (
    <div>
      {/* Mobile cards — visible below sm breakpoint */}
      <div className="sm:hidden space-y-2">
        {sorted.map((row, idx) => (
          <div
            key={row.name || idx}
            className={`border border-gray-200 rounded-lg p-3 ${
              idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
            }`}
          >
            {/* Card header: rank + name + trend */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`stat-number font-semibold text-sm w-7 flex-shrink-0 ${
                idx < highlightTop ? 'text-gold' : 'text-gray-400'
              }`}>
                {idx < highlightTop ? `#${row.rank || idx + 1}` : row.rank || idx + 1}
              </span>
              <span className={`font-sans text-darktext flex-1 min-w-0 truncate ${
                idx < highlightTop ? 'font-semibold' : 'font-medium'
              }`}>
                {formatName(row.name)}
              </span>
              {showBubble && isBubble(getBubbleRounds(row)) && (
                <span className="text-xs font-sans font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200 whitespace-nowrap">
                  Bubble
                </span>
              )}
              {row.trend && (
                <span className={`text-base font-bold flex-shrink-0 ${TREND_COLORS[row.trend]}`}>
                  {TREND_ICONS[row.trend]}
                </span>
              )}
            </div>
            {/* Primary metric */}
            {primaryMetricCol && (
              <div className="pl-7 mb-1.5">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 font-sans">{primaryMetricCol.label}</p>
                <div className="text-lg leading-tight">
                  <CellValue col={primaryMetricCol} row={row} idx={idx} highlightTop={highlightTop} showBubble={showBubble} />
                </div>
              </div>
            )}
            {/* Secondary metrics */}
            {secondaryMetricCols.length > 0 && (
              <div className="pl-7 flex flex-wrap items-center gap-x-3 gap-y-1">
                {secondaryMetricCols.map(col => (
                  <div key={col.key} className="flex items-center gap-1">
                    <span className="text-gray-400 font-sans text-[11px]">{col.label}:</span>
                    <span className="text-xs">
                      <CellValue col={col} row={row} idx={idx} highlightTop={highlightTop} showBubble={showBubble} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop table — hidden below sm */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[540px] text-left text-sm">
          <thead>
            <tr className="bg-forest border-b border-forest">
              {defaultColumns.map((col) => (
                <th
                  key={col.key}
                  className="table-header text-white"
                  onClick={() => col.sortable && handleSort(col.key)}
                  title={col.tooltip}
                  style={col.sortable ? { cursor: 'pointer' } : {}}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.tooltip && (
                      <span className="text-white/40 text-xs" aria-hidden="true">ⓘ</span>
                    )}
                    {col.sortable && (
                      sortKey === col.key
                        ? <span className="text-gold">{sortDir === 'asc' ? '↑' : '↓'}</span>
                        : <span className="text-white/30">⇅</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => (
              <tr
                key={row.name || idx}
                className={`border-b border-gray-100 transition-colors hover:bg-blue-50 ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                {defaultColumns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <CellValue col={col} row={row} idx={idx} highlightTop={highlightTop} showBubble={showBubble} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
