import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import TournamentCard from '../components/ui/TournamentCard'
import StandingsTable from '../components/ui/StandingsTable'
import schedule from '../data/schedule.json'
import koasati from '../data/results/2026-koasati-flow-control.json'
import { formatDateLong } from '../utils/formatDate'

const resultFiles = {
  '2026-01': koasati,
}

export default function Schedule() {
  useEffect(() => { document.title = 'Schedule | CGA 2026' }, [])

  const { state } = useLocation()

  const upcoming = schedule.filter((t) => t.status === 'upcoming')
  const completed = schedule.filter((t) => t.status === 'completed')
  const pct = Math.round((completed.length / schedule.length) * 100)

  const [expanded, setExpanded] = useState(state?.expand ?? completed[0]?.id ?? null)

  return (
    <PageWrapper>
      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">2026 Tournament Schedule</h1>
        <div className="gold-divider" />
        <p className="text-gray-600 font-sans text-sm max-w-xl">
          {schedule.length} tournaments scheduled for the 2026 season. Entry fee is paid at the course on the day of play.
        </p>
      </div>

      {/* Season progress */}
      <div className="mb-8 bg-white border border-gray-200 rounded-lg px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-sans font-medium text-darktext">Season Progress</span>
          <span className="stat-number text-sm text-gray-500">
            {completed.length} of {schedule.length} events completed
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-forest rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {upcoming.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-sans font-semibold text-forest uppercase tracking-widest mb-4">
            Upcoming
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcoming.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-sans font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Completed
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {completed.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        </div>
      )}

      {/* Results section */}
      {completed.length > 0 && (
        <div id="results">
          <h2 className="text-lg font-sans font-semibold text-forest uppercase tracking-widest mb-4">
            Tournament Results
          </h2>

          <div className="space-y-4">
            {completed.map((t) => {
              const result = resultFiles[t.id]
              const isOpen = expanded === t.id
              return (
                <div key={t.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    className="w-full text-left p-5 flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : t.id)}
                    aria-expanded={isOpen}
                  >
                    <div>
                      <h3 className="text-darktext font-serif text-xl font-semibold mb-1">{t.name}</h3>
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

                  {isOpen && result && (
                    <div className="border-t border-gray-100 p-5">
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
                      <FlightLeaderboards leaderboard={result.leaderboard} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </PageWrapper>
  )
}

function FlightLeaderboards({ leaderboard }) {
  const [flight, setFlight] = useState(Object.keys(leaderboard)[0])
  const flights = Object.keys(leaderboard)

  const scoreColumns = [
    { key: 'rank',      label: 'Rank',   sortable: false },
    { key: 'name',      label: 'Player', sortable: true  },
    { key: 'poy',       label: 'POY',    sortable: true  },
    { key: 'points',    label: 'Score',  sortable: true  },
    { key: 'ptm',       label: 'PTM',    sortable: true  },
    { key: 'plusMinus', label: '+/-',    sortable: true  },
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
            <span className="ml-1 opacity-60">({(leaderboard[f] || []).length})</span>
          </button>
        ))}
      </div>
      <StandingsTable data={leaderboard[flight]} columns={scoreColumns} highlightTop={3} />
    </div>
  )
}
