import { useState } from 'react'

function isBubble(events) {
  return typeof events === 'number' && events >= 1 && events < 4
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

export default function StandingsTable({ data, columns, highlightTop = 3 }) {
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

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = a[sortKey]
        const bv = b[sortKey]
        const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
        return sortDir === 'asc' ? cmp : -cmp
      })
    : data

  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50 py-12 text-center">
        <p className="text-gray-400 font-sans text-sm">No players in this flight yet.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full min-w-[540px] text-left text-sm">
        <thead>
          <tr className="bg-forest border-b border-forest">
            {defaultColumns.map((col) => (
              <th
                key={col.key}
                className="table-header text-white"
                onClick={() => col.sortable && handleSort(col.key)}
                style={col.sortable ? { cursor: 'pointer' } : {}}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span className="text-gold">{sortDir === 'asc' ? '↑' : '↓'}</span>
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
                  {col.key === 'rank' && (
                    <span
                      className={`stat-number font-semibold ${
                        idx < highlightTop ? 'text-gold' : 'text-gray-500'
                      }`}
                    >
                      {idx < highlightTop ? `#${row.rank || idx + 1}` : row.rank || idx + 1}
                    </span>
                  )}
                  {col.key === 'name' && (
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <span className={`font-sans ${idx < highlightTop ? 'text-darktext font-semibold' : 'text-darktext'}`}>
                        {row.name}
                      </span>
                      {isBubble(row.events) && (
                        <span className="text-xs font-sans font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200 whitespace-nowrap">
                          Bubble
                        </span>
                      )}
                    </span>
                  )}
                  {col.key === 'points' && (
                    <span className="stat-number text-darktext font-medium">{row.points}</span>
                  )}
                  {col.key === 'poy' && (
                    <span className={`stat-number font-semibold ${row.poy > 0 ? 'text-gold' : 'text-gray-400'}`}>
                      {row.poy}
                    </span>
                  )}
                  {col.key === 'ptm' && (
                    <span className="stat-number text-gray-600">{row.ptm ?? '—'}</span>
                  )}
                  {col.key === 'ptmDelta' && (() => {
                    const d = row.ptmDelta
                    if (d == null || d === 0) return <span className="stat-number text-gray-400">—</span>
                    const color = d > 0 ? 'text-red-500' : 'text-green-600'
                    const label = d > 0 ? `+${d}` : `${d}`
                    return <span className={`stat-number font-semibold ${color}`}>{label}</span>
                  })()}
                  {col.key === 'latestScore' && (
                    <span className="stat-number text-darktext font-medium">{row.latestScore ?? '—'}</span>
                  )}
                  {col.key === 'eventsPlayed' && (
                    <span className="stat-number text-gray-500">{row.eventsPlayed ?? row.events}</span>
                  )}
                  {col.key === 'events' && (
                    <span className="stat-number text-gray-500">{row.events}</span>
                  )}
                  {col.key === 'trend' && row.trend && (
                    <span className={`text-base font-bold ${TREND_COLORS[row.trend]}`}>
                      {TREND_ICONS[row.trend]}
                    </span>
                  )}
                  {col.key === 'flight' && (
                    <span className="text-xs text-forest font-sans bg-blue-50 border border-blue-100 px-2 py-0.5 rounded whitespace-nowrap">
                      {row.flight}
                    </span>
                  )}
                  {!['rank', 'name', 'points', 'poy', 'ptm', 'ptmDelta', 'latestScore', 'eventsPlayed', 'events', 'trend', 'flight'].includes(col.key) && (
                    <span className="text-darktext font-sans">{row[col.key]}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
