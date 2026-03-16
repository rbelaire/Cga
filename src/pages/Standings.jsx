import PageWrapper from '../components/layout/PageWrapper'
import StandingsTable from '../components/ui/StandingsTable'
import standings from '../data/standings.json'

const columns = [
  { key: 'rank', label: 'Rank', sortable: false },
  { key: 'name', label: 'Player', sortable: true },
  { key: 'flight', label: 'Flight', sortable: true },
  { key: 'points', label: 'Points', sortable: true },
  { key: 'eventsPlayed', label: 'Events', sortable: true },
]

export default function Standings() {
  return (
    <PageWrapper>
      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">2026 Season Standings</h1>
        <div className="gold-divider" />
        <p className="text-gray-600 font-sans text-sm">
          Points are awarded based on finish position within each flight. 1 event played. Click column headers to sort.
        </p>
      </div>

      <div className="bg-gray-950 rounded-xl p-1 mb-3">
        <StandingsTable data={standings} columns={columns} highlightTop={3} />
      </div>
    </PageWrapper>
  )
}
