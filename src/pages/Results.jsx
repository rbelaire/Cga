import { useState } from 'react'
import PageWrapper from '../components/layout/PageWrapper'
import schedule from '../data/schedule.json'
import koasati from '../data/results/2026-koasati-flow-control.json'
import { formatDateLong } from '../utils/formatDate'
import StandingsTable from '../components/ui/StandingsTable'

const resultFiles = {
  '2026-00': koasati,
}

const scoreColumns = [
  { key: 'rank', label: 'Rank', sortable: false },
  { key: 'name', label: 'Player', sortable: true },
  { key: 'points', label: 'Points', sortable: true },
]

export default function Results() {
  const completed = schedule.filter((t) => t.status === 'completed')
  const [expanded, setExpanded] = useState(completed[0]?.id ?? null)

  return (
    <PageWrapper>
      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">Tournament Results</h1>
        <div className="gold-divider" />
      </div>

      {completed.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">⛳</div>
          <p className="text-gray-500 font-sans text-lg">No results yet.</p>
          <p className="text-gray-600 font-sans text-sm mt-2">Check back after the first tournament.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {completed.map((t) => {
            const result = resultFiles[t.id]
            const isOpen = expanded === t.id
            return (
              <div key={t.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {/* Header row */}
                <button
                  className="w-full text-left p-5 flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : t.id)}
                  aria-expanded={isOpen}
                >
                  <div>
                    <h2 className="text-darktext font-serif text-xl font-semibold mb-1">{t.name}</h2>
                    <p className="text-gray-500 font-sans text-sm">{formatDateLong(t.date)} · {t.course}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs bg-gray-100 text-gray-600 border border-gray-200 px-2.5 py-1 rounded-full font-sans hidden sm:block">
                      {t.format}
                    </span>
                    <svg
                      className={`w-5 h-5 text-gold transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && result && (
                  <div className="border-t border-gray-100 p-5">
                    {/* Flight winners */}
                    <h3 className="text-forest text-xs font-sans font-semibold uppercase tracking-widest mb-3">
                      Flight Winners
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                      {result.flightWinners.map((fw) => (
                        <div key={fw.flight} className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5">
                          <p className="text-forest text-xs font-sans font-semibold uppercase tracking-wide mb-0.5">
                            {fw.flight}
                          </p>
                          <p className="text-darktext font-sans text-sm font-medium">{fw.winner}</p>
                          <p className="stat-number text-gray-500 text-xs">{fw.points} pts</p>
                        </div>
                      ))}
                    </div>

                    {/* Per-flight leaderboards */}
                    <FlightLeaderboards leaderboard={result.leaderboard} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </PageWrapper>
  )
}

function FlightLeaderboards({ leaderboard }) {
  const [flight, setFlight] = useState(Object.keys(leaderboard)[0])
  const flights = Object.keys(leaderboard)

  const scoreColumns = [
    { key: 'rank', label: 'Rank', sortable: false },
    { key: 'name', label: 'Player', sortable: true },
    { key: 'points', label: 'Points', sortable: true },
  ]

  return (
    <div>
      <h3 className="text-gold text-xs font-sans font-semibold uppercase tracking-widest mb-3">
        Full Leaderboard
      </h3>
      <div className="flex flex-wrap gap-2 mb-4">
        {flights.map((f) => (
          <button
            key={f}
            onClick={() => setFlight(f)}
            className={`px-3 py-1.5 text-xs font-sans font-medium rounded transition-colors ${
              flight === f
                ? 'bg-gold text-forest'
                : 'bg-white text-gray-500 border border-gray-200 hover:text-forest hover:border-gold'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <StandingsTable data={leaderboard[flight]} columns={scoreColumns} highlightTop={3} />
    </div>
  )
}
