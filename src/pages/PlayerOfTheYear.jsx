import { useState } from 'react'
import PageWrapper from '../components/layout/PageWrapper'
import StandingsTable from '../components/ui/StandingsTable'
import poy from '../data/poy.json'

const TABS = ['Scratch POY', 'Handicap POY', 'Championship', 'A Flight', 'B Flight', 'C Flight']

const eventsColumns = [
  { key: 'rank', label: 'Rank', sortable: false },
  { key: 'name', label: 'Player', sortable: true },
  { key: 'points', label: 'Points', sortable: true },
  { key: 'events', label: 'Events', sortable: true },
]

export default function PlayerOfTheYear() {
  const [tab, setTab] = useState(0)

  const getData = () => {
    if (tab === 0) return poy.scratch
    if (tab === 1) return poy.handicap
    const flightName = TABS[tab]
    return poy.flights[flightName] || []
  }

  return (
    <PageWrapper>
      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">Player of the Year</h1>
        <div className="gold-divider" />
        <p className="text-gray-600 font-sans text-sm">
          POY standings track cumulative season points across all eligible tournaments.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((label, i) => (
          <button
            key={label}
            onClick={() => setTab(i)}
            className={`px-4 py-2 text-sm font-sans font-medium rounded-lg transition-colors ${
              tab === i
                ? 'bg-gold text-forest'
                : 'bg-charcoal text-gray-400 border border-gray-700 hover:text-gold hover:border-gold'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-gray-950 rounded-xl p-1">
        <StandingsTable data={getData()} columns={eventsColumns} highlightTop={1} />
      </div>
    </PageWrapper>
  )
}
