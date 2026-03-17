import { useState } from 'react'
import PageWrapper from '../components/layout/PageWrapper'
import StandingsTable from '../components/ui/StandingsTable'
import poy from '../data/poy.json'

const FLIGHTS = ['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight']

const eventsColumns = [
  { key: 'rank', label: 'Rank', sortable: false },
  { key: 'name', label: 'Player', sortable: true },
  { key: 'points', label: 'Points', sortable: true },
  { key: 'events', label: 'Events', sortable: true },
]

export default function PlayerOfTheYear() {
  const [tab, setTab] = useState(0)

  return (
    <PageWrapper>
      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">Player of the Year</h1>
        <div className="gold-divider" />
        <p className="text-gray-600 font-sans text-sm">
          POY standings track cumulative season points across all eligible tournaments. 1 event played.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FLIGHTS.map((label, i) => (
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
          </button>
        ))}
      </div>

      <div>
        <StandingsTable
          data={poy.flights[FLIGHTS[tab]] || []}
          columns={eventsColumns}
          highlightTop={3}
        />
      </div>
    </PageWrapper>
  )
}
