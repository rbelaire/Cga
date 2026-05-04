import { Link } from 'react-router-dom'
import schedule from '../../data/schedule.json'
import { formatDateLong } from '../../utils/formatDate'
import { FLIGHT_ORDER, normalizeFlight } from '../../utils/flightOrder'

const FLIGHT_LABELS = {
  Championship: 'Championship',
  '1st Flight': '1st',
  '2nd Flight': '2nd',
  '3rd Flight': '3rd',
  '4th Flight': '4th',
  '5th Flight': '5th',
}

function toScoreLabel(row = {}) {
  if (typeof row.points === 'number') return Number.isInteger(row.points) ? `${row.points}` : row.points.toFixed(1)
  if (typeof row.score === 'number') return Number.isInteger(row.score) ? `${row.score}` : row.score.toFixed(1)
  return '—'
}

function toRelative(row = {}) {
  if (typeof row.plusMinus !== 'number') return null
  if (row.plusMinus === 0) return 'E'
  return `${row.plusMinus > 0 ? '+' : ''}${row.plusMinus}`
}

export default function LatestTournamentResults({ allResults = {} }) {
  const completedByDate = [...schedule]
    .filter((t) => t.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date))

  const latestTournament = completedByDate.find((t) => {
    const leaderboard = allResults?.[t.id]?.leaderboard
    return leaderboard && Object.keys(leaderboard).length > 0
  })

  if (!latestTournament) {
    return (
      <section className="py-8 sm:py-10 bg-[#F6F4EF] border-t border-[#E5E0D4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#C9A227]">Recently Published</p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-serif font-semibold text-[#0B1F3A]">Latest Tournament Results</h2>
          <div className="mt-4 rounded-2xl border border-[#E5E0D4] bg-white p-4 sm:p-5">
            <p className="text-sm text-gray-600">Latest tournament results will appear here after results are published.</p>
          </div>
        </div>
      </section>
    )
  }

  const leaderboard = allResults[latestTournament.id]?.leaderboard || {}
  const cards = FLIGHT_ORDER.map((flight) => {
    const flightRows = Object.entries(leaderboard).find(([name]) => normalizeFlight(name) === flight)?.[1] || []
    const topRows = flightRows.slice(0, 5)
    return { flight, rows: topRows }
  }).filter((card) => card.rows.length > 0)

  if (cards.length === 0) {
    return (
      <section className="py-8 sm:py-10 bg-[#F6F4EF] border-t border-[#E5E0D4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#C9A227]">Recently Published</p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-serif font-semibold text-[#0B1F3A]">Latest Tournament Results</h2>
          <div className="mt-4 rounded-2xl border border-[#E5E0D4] bg-white p-4 sm:p-5">
            <p className="text-sm text-gray-600">Latest tournament results will appear here after results are published.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-8 sm:py-10 bg-[#F6F4EF] border-t border-[#E5E0D4]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-5">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#C9A227]">Recently Published</p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-serif font-semibold text-[#0B1F3A]">Latest Tournament Results</h2>
            <p className="mt-1 text-sm text-gray-600">{latestTournament.name} · {formatDateLong(latestTournament.date)}</p>
          </div>
          <Link to="/tournaments" state={{ expand: latestTournament.id }} className="btn-outline text-sm py-2 px-4 self-start sm:self-auto">
            Full Results →
          </Link>
        </div>

        <div className="overflow-x-auto snap-x snap-mandatory">
          <div className="flex gap-3 sm:gap-4 pb-1">
            {cards.map((card) => (
              <article key={card.flight} className="snap-start min-w-[260px] sm:min-w-[280px] lg:min-w-[300px] rounded-2xl border border-[#E5E0D4] bg-white p-4">
                <h3 className="text-[#0B1F3A] font-semibold text-sm uppercase tracking-wide">{FLIGHT_LABELS[card.flight] ?? card.flight}</h3>
                <div className="mt-2 border-t border-[#E7D18A] pt-2">
                  <ul className="space-y-1.5">
                    {card.rows.map((player, idx) => (
                      <li key={`${card.flight}-${player.name}-${idx}`} className="grid grid-cols-[1.25rem_1fr_auto_auto] items-center gap-2 text-sm">
                        <span className="text-[#C9A227] font-semibold">{idx + 1}.</span>
                        <span className="text-[#111111] truncate">{player.name}</span>
                        <span className="font-semibold text-[#111111]">{toScoreLabel(player)}</span>
                        <span className="text-xs text-gray-500 min-w-[1.5rem] text-right">{toRelative(player) ?? ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
