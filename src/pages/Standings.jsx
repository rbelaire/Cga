import { useState, useEffect } from 'react'
import PageWrapper from '../components/layout/PageWrapper'
import StandingsTable from '../components/ui/StandingsTable'
import standings from '../data/standings.json'
import ptmData from '../data/ptm.json'

const FLIGHTS = ['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight']

const roundsFromPtm = {}
for (const player of ptmData) {
  if (player.name && typeof player.rounds === 'number') {
    roundsFromPtm[player.name] = player.rounds
  }
}

function withRounds(row) {
  const rounds = roundsFromPtm[row.name]
  return rounds != null ? { ...row, rounds } : row
}

const columns = [
  { key: 'rank',        label: 'Rank',         sortable: false },
  { key: 'name',        label: 'Player',        sortable: true  },
  { key: 'poy',         label: 'POY Pts',       sortable: true  },
  { key: 'ptm',         label: 'PTM',           sortable: true  },
  { key: 'ptmDelta',    label: 'PTM Δ',         sortable: true  },
  { key: 'latestScore', label: 'Latest Score',  sortable: true  },
  { key: 'events',      label: 'Events',        sortable: true  },
  { key: 'trend',       label: '',              sortable: false  },
]

export default function Standings() {
  useEffect(() => { document.title = 'Standings | CGA 2026' }, [])
  const [tab, setTab] = useState(0)

  const currentFlight = FLIGHTS[tab]
  const flightData = (standings.flights[currentFlight] || []).map(withRounds)

  // Find latest tournament name from first player that has one
  const latestTournament = flightData.find(p => p.latestTournament)?.latestTournament ?? null

  return (
    <PageWrapper>
      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">2026 Season Standings</h1>
        <div className="gold-divider" />
        <p className="text-gray-600 font-sans text-sm">
          Ranked by Player of the Year points. Click column headers to sort.
          {latestTournament && (
            <span className="ml-1">Latest score from <span className="font-medium text-forest">{latestTournament}</span>.</span>
          )}
          <span className="ml-1">
            <span className="font-medium text-forest">PTM Δ</span> shows the change in Points to Make since the previous tournament
            (<span className="text-green-600 font-medium">negative = improved</span>,{' '}
            <span className="text-red-500 font-medium">positive = higher target</span>).
          </span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {FLIGHTS.map((label, i) => {
          const count = (standings.flights[label] || []).length
          return (
            <button
              key={label}
              onClick={() => setTab(i)}
              className={`px-4 py-2 text-sm font-sans font-medium rounded-lg transition-colors ${
                tab === i
                  ? 'bg-gold text-forest'
                  : 'bg-white text-gray-500 border border-gray-200 hover:text-forest hover:border-gold'
              }`}
            >
              {label}
              <span className="ml-1.5 text-xs opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      <StandingsTable data={flightData} columns={columns} highlightTop={3} />
    </PageWrapper>
  )
}
