import { useEffect } from 'react'
import PageWrapper from '../components/layout/PageWrapper'
import TournamentCard from '../components/ui/TournamentCard'
import schedule from '../data/schedule.json'

export default function Schedule() {
  useEffect(() => { document.title = 'Schedule | CGA 2026' }, [])

  const upcoming = schedule.filter((t) => t.status === 'upcoming')
  const past = schedule.filter((t) => t.status === 'completed')
  const pct = Math.round((past.length / schedule.length) * 100)

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
            {past.length} of {schedule.length} events completed
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

      {past.length > 0 && (
        <div>
          <h2 className="text-lg font-sans font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Completed
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {past.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        </div>
      )}
    </PageWrapper>
  )
}
