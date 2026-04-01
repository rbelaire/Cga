import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import TournamentCard from '../components/ui/TournamentCard'
import schedule from '../data/schedule.json'

export default function Schedule() {
  useEffect(() => { document.title = 'Schedule | CGA 2026' }, [])

  const upcoming = schedule.filter((t) => t.status === 'upcoming')
  const completed = schedule.filter((t) => t.status === 'completed')
  const pct = Math.round((completed.length / schedule.length) * 100)

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
        {completed.length > 0 && (
          <div className="mt-3 flex justify-end">
            <Link
              to="/results"
              className="text-xs font-sans font-medium text-gold hover:text-gold/80 transition-colors flex items-center gap-1"
            >
              View tournament results
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}
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
    </PageWrapper>
  )
}
