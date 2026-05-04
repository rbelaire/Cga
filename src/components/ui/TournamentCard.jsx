import { Link } from 'react-router-dom'
import { formatDate } from '../../utils/formatDate'
import { sortFlights } from '../../utils/flightOrder'

const statusStyles = {
  upcoming: 'bg-[#F6F4EF] text-[#0B1F3A] border border-[#E5E0D4]',
  completed: 'bg-gray-100 text-charcoal border border-[#E5E0D4]',
  cancelled: 'bg-red-100 text-red-600',
}

export default function TournamentCard({ tournament, compact = false }) {
  const { id, name, date, course, format, entryFee, flights, status, notes } = tournament
  const isPast = status === 'completed'
  const orderedFlights = sortFlights(flights ?? [], { includeNewPlayers: true })

  return (
    <div
      className={`rounded-lg overflow-hidden border transition-shadow duration-200 hover:shadow-sm ${
        isPast
          ? 'bg-gray-50 border-gray-200'
          : 'bg-white border-[#E5E0D4] hover:border-gold'
      }`}
    >
      {/* Date strip */}
      <div className={`px-3 py-1.5 flex items-center justify-between ${isPast ? 'bg-gray-50 border-b border-gray-200' : 'bg-forest'}`}>
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
      <div className="p-3">
        <h3 className="text-darktext font-serif text-xl font-semibold mb-1">{name}</h3>
        <p className="text-charcoal/80 text-sm font-sans mb-2">{course}</p>

        {!compact && (
          <div className="flex flex-wrap gap-2 mb-2.5">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-sans border border-gray-200">
              {format}
            </span>
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded font-sans font-medium stat-number">
              {isNaN(entryFee) ? entryFee : `$${entryFee}`}
            </span>
          </div>
        )}

        {!compact && orderedFlights.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2.5">
            {orderedFlights.map((flight) => (
              <span key={flight} className="text-xs border border-gray-200 text-charcoal px-2 py-0.5 rounded font-sans">
                {flight}
              </span>
            ))}
          </div>
        )}

        {notes && !compact && (
          <p className="text-xs text-gray-400 italic font-sans mt-2">{notes}</p>
        )}

        {status === 'completed' && (
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <Link
              to="/tournaments"
              state={{ expand: id }}
              className="inline-block text-forest text-sm font-sans font-medium hover:text-gold transition-colors"
            >
              View Results →
            </Link>
            <Link
              to={`/pairings/${id}`}
              className="inline-block text-forest text-sm font-sans font-medium hover:text-gold transition-colors"
            >
              View Pairings →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
