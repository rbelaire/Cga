import { Link } from 'react-router-dom'
import CountdownTimer from '../ui/CountdownTimer'
import schedule from '../../data/schedule.json'
import { formatDate } from '../../utils/formatDate'

export default function NextTournament() {
  const next = schedule.find((t) => t.status === 'upcoming')
  if (!next) return null

  return (
    <section className="bg-gray-50 border-y border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          {/* Info */}
          <div>
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
              <span className="text-gold text-xs font-sans font-semibold uppercase tracking-widest">
                Next Tournament
              </span>
            </div>
            <h2 className="text-darktext text-2xl sm:text-3xl font-serif font-bold mb-1">{next.name}</h2>
            <p className="text-gray-500 font-sans text-sm mb-3">
              {formatDate(next.date)} &nbsp;·&nbsp; {next.course}
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs bg-forest text-white px-2.5 py-1 rounded-full font-sans">
                {next.format}
              </span>
              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-sans font-medium stat-number">
                {isNaN(next.entryFee) ? next.entryFee : `$${next.entryFee}`}
              </span>
            </div>
          </div>

          {/* Countdown */}
          <div className="flex flex-col items-start lg:items-end gap-4">
            <CountdownTimer targetDate={next.date} />
            <Link to="/schedule" className="text-sm text-forest hover:text-gold font-sans font-medium transition-colors">
              Full schedule →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
