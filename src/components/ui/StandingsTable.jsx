import { useState } from 'react'

const TREND_ICONS = {
  up: '↑',
  down: '↓',
  stable: '–',
}
const TREND_COLORS = {
  up: 'text-green-400',
  down: 'text-red-400',
  stable: 'text-gray-500',
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

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-forest border-b border-gray-700">
            {defaultColumns.map((col) => (
              <th
                key={col.key}
                className="table-header"
                onClick={() => col.sortable && handleSort(col.key)}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span className="text-gold-light">{sortDir === 'asc' ? '↑' : '↓'}</span>
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
              className={`border-b border-gray-800 transition-colors hover:bg-gray-800 ${
                idx % 2 === 0 ? 'bg-charcoal' : 'bg-gray-900'
              }`}
            >
              {defaultColumns.map((col) => (
                <td key={col.key} className="px-4 py-3">
                  {col.key === 'rank' && (
                    <span
                      className={`stat-number font-medium ${
                        idx < highlightTop ? 'text-gold' : 'text-gray-400'
                      }`}
                    >
                      {idx < highlightTop ? `#${row.rank || idx + 1}` : row.rank || idx + 1}
                    </span>
                  )}
                  {col.key === 'name' && (
                    <span className={`font-sans ${idx < highlightTop ? 'text-offwhite font-medium' : 'text-gray-300'}`}>
                      {row.name}
                    </span>
                  )}
                  {col.key === 'points' && (
                    <span className="stat-number text-offwhite">{row.points}</span>
                  )}
                  {col.key === 'eventsPlayed' && (
                    <span className="stat-number text-gray-400">{row.eventsPlayed ?? row.events}</span>
                  )}
                  {col.key === 'events' && (
                    <span className="stat-number text-gray-400">{row.events}</span>
                  )}
                  {col.key === 'trend' && row.trend && (
                    <span className={`text-base font-bold ${TREND_COLORS[row.trend]}`}>
                      {TREND_ICONS[row.trend]}
                    </span>
                  )}
                  {!['rank', 'name', 'points', 'eventsPlayed', 'events', 'trend'].includes(col.key) && (
                    <span className="text-gray-300 font-sans">{row[col.key]}</span>
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
