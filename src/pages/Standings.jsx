import PageWrapper from '../components/layout/PageWrapper'
import StandingsTable from '../components/ui/StandingsTable'
import standings from '../data/standings.json'

export default function Standings() {
  return (
    <PageWrapper>
      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">2026 Season Standings</h1>
        <div className="gold-divider" />
        <p className="text-gray-600 font-sans text-sm">
          Points are awarded based on finish position within each flight. Click column headers to sort.
        </p>
      </div>

      <div className="bg-gray-950 rounded-xl p-1 mb-3">
        <StandingsTable data={standings} highlightTop={3} />
      </div>

      <p className="text-xs text-gray-500 font-sans mt-4">
        * Top 3 qualify for the Championship Flight at the CGA Championship in October.
      </p>
    </PageWrapper>
  )
}
