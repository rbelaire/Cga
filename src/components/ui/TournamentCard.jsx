import { Link } from 'react-router-dom'
import { formatDate } from '../../utils/formatDate'

const statusStyles = {
  upcoming: 'bg-green-900 text-green-300',
  completed: 'bg-gray-700 text-gray-400',
  cancelled: 'bg-red-900 text-red-300',
}

export default function TournamentCard({ tournament, compact = false }) {
  const { id, name, date, course, format, entryFee, flights, status, notes } = tournament
  const isPast = status === 'completed'

  return (
    <div
      className={`rounded-lg overflow-hidden border transition-transform duration-200 hover:-translate-y-0.5 ${
        isPast
          ? 'bg-gray-900 border-gray-700 opacity-70'
          : 'bg-charcoal border-gray-700 hover:border-gold'
      }`}
    >
      {/* Date strip */}
      <div className={`px-4 py-2 flex items-center justify-between ${isPast ? 'bg-gray-800' : 'bg-forest'}`}>
        <span className="text-gold font-mono text-sm font-medium stat-number">
          {formatDate(date)}
        </span>
        <span
          className={`text-xs font-sans font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${
            statusStyles[status] || statusStyles.upcoming
          }`}
        >
          {status}
        </span>
      </div>

      {/* Body */}
      <div className="p-4">
        <h3 className="text-offwhite font-serif text-xl font-semibold mb-1">{name}</h3>
        <p className="text-gray-400 text-sm font-sans mb-3">{course}</p>

        {!compact && (
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded font-sans">
              {format}
            </span>
            <span className="text-xs bg-gray-800 text-gold px-2 py-1 rounded font-sans font-medium stat-number">
              {isNaN(entryFee) ? entryFee : `$${entryFee}`}
            </span>
          </div>
        )}

        {!compact && flights && flights.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {flights.map((flight) => (
              <span key={flight} className="text-xs border border-gray-600 text-gray-400 px-2 py-0.5 rounded font-sans">
                {flight}
              </span>
            ))}
          </div>
        )}

        {notes && !compact && (
          <p className="text-xs text-gray-500 italic font-sans mt-2">{notes}</p>
        )}

        {status === 'completed' && (
          <Link
            to={`/results/${id}`}
            className="mt-3 inline-block text-gold text-sm font-sans font-medium hover:text-gold-light transition-colors"
          >
            View Results →
          </Link>
        )}
      </div>
    </div>
  )
}
