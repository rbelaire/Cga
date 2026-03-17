import { Link } from 'react-router-dom'
import { formatDate } from '../../utils/formatDate'

const statusStyles = {
  upcoming: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-600',
}

export default function TournamentCard({ tournament, compact = false }) {
  const { id, name, date, course, format, entryFee, flights, status, notes } = tournament
  const isPast = status === 'completed'

  return (
    <div
      className={`rounded-lg overflow-hidden border transition-shadow duration-200 hover:shadow-md ${
        isPast
          ? 'bg-white border-gray-200 opacity-75'
          : 'bg-white border-gray-200 hover:border-gold'
      }`}
    >
      {/* Date strip */}
      <div className={`px-4 py-2 flex items-center justify-between ${isPast ? 'bg-gray-50 border-b border-gray-200' : 'bg-forest'}`}>
        <span className={`font-mono text-sm font-medium stat-number ${isPast ? 'text-gray-500' : 'text-gold'}`}>
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
        <h3 className="text-darktext font-serif text-xl font-semibold mb-1">{name}</h3>
        <p className="text-gray-500 text-sm font-sans mb-3">{course}</p>

        {!compact && (
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-sans border border-gray-200">
              {format}
            </span>
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded font-sans font-medium stat-number">
              {isNaN(entryFee) ? entryFee : `$${entryFee}`}
            </span>
          </div>
        )}

        {!compact && flights && flights.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {flights.map((flight) => (
              <span key={flight} className="text-xs border border-gray-200 text-gray-500 px-2 py-0.5 rounded font-sans">
                {flight}
              </span>
            ))}
          </div>
        )}

        {notes && !compact && (
          <p className="text-xs text-gray-400 italic font-sans mt-2">{notes}</p>
        )}

        {status === 'completed' && (
          <Link
            to={`/results/${id}`}
            className="mt-3 inline-block text-forest text-sm font-sans font-medium hover:text-gold transition-colors"
          >
            View Results →
          </Link>
        )}
      </div>
    </div>
  )
}
