import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import scheduleData from '../data/schedule.json'
import sponsors from '../data/sponsors.json'
import { DB } from '../db'
import { useSubscription } from '../hooks/useSubscription'
import { latestResultTournament, mergeSchedule, nextTournament, feeLabel } from '../domain/schedule'
import { formatDateLong, timeUntil } from '../utils/formatDate'
import { computeScratch } from '../utils/computeScratch'
import { buildRoundsByName, capProvisionalLeaderboard } from '../utils/poy'
import { FLIGHT_ORDER } from '../utils/flightOrder'
import { buildFlightWinnerCards } from '../utils/flightWinners'
import RankList from '../components/ui/RankList'

export default function Home() {
  useEffect(() => { document.title = 'Carencro Golf Association' }, [])
  const standings = useSubscription(DB.listenStandings, [])
  const results = useSubscription(DB.listenResults, [])
  const members = useSubscription(DB.listenMembers, [])
  const status = useSubscription(DB.listenTournamentStatus, [])
  const schedule = useMemo(() => mergeSchedule(scheduleData, status), [status])
  const upcoming = nextTournament(schedule)
  const countdown = upcoming ? timeUntil(upcoming.date) : null
  const roundsByName = useMemo(() => buildRoundsByName(members || []), [members])
  const capped = useMemo(() => {
    const out = {}
    for (const [id, result] of Object.entries(results || {})) {
      out[id] = result?.leaderboard
        ? { ...result, leaderboard: capProvisionalLeaderboard(result.leaderboard, roundsByName) }
        : result
    }
    return out
  }, [results, roundsByName])
  const latest = latestResultTournament(schedule, capped)
  const latestResult = latest ? capped[latest.id] : null
  const winners = latestResult ? buildFlightWinnerCards(latestResult, latest?.format) : []
  const hdcp = useMemo(() => FLIGHT_ORDER.flatMap((flight) => standings?.flights?.[flight] || [])
    .sort((a, b) => (b.poy ?? 0) - (a.poy ?? 0)).slice(0, 10), [standings])
  const scratch = useMemo(() => computeScratch(results || {}).slice(0, 10), [results])
  const sponsorNames = [...(sponsors.tournament || []), ...(sponsors.banquet || []), ...(sponsors.trophy || [])]

  return (
    <div className="flex-1">
      <section className="bg-forest text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <p className="text-gold text-xs font-heading font-semibold uppercase tracking-[0.2em]">Carencro, Louisiana</p>
          <h1 className="mt-2 text-3xl sm:text-5xl font-heading font-bold">Carencro Golf Association</h1>
          <p className="mt-3 max-w-2xl text-white/80">The 2026 season schedule, pairings, and standings.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/tournaments" className="bg-gold text-forest font-heading font-semibold px-4 py-2.5 rounded-md">See the schedule</Link>
            <a href="https://venmo.com/CGA-Pay" className="border border-white/30 px-4 py-2.5 rounded-md font-heading font-semibold" target="_blank" rel="noreferrer">Pay $75 dues on Venmo</a>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="rounded-xl border border-[#E5E0D4] bg-white p-5 sm:p-6">
          <p className="text-xs font-heading font-semibold uppercase tracking-widest text-gold">Next tournament</p>
          {upcoming ? (
            <>
              <h2 className="mt-1 text-2xl font-heading font-bold text-forest">{upcoming.name}</h2>
              <p className="mt-1 text-sm text-gray-600">{formatDateLong(upcoming.date)} · {upcoming.course} · {upcoming.teeTime} · {feeLabel(upcoming.entryFee)}</p>
              {countdown ? (
                <p className="mt-4 stat-number text-lg text-forest">{countdown.days}d {countdown.hours}h {countdown.minutes}m</p>
              ) : (
                <p className="mt-4 text-sm text-gray-500">This event is today.</p>
              )}
              <Link to={`/tournaments/${upcoming.id}`} className="inline-block mt-4 text-sm font-heading font-semibold text-forest underline">Event details</Link>
            </>
          ) : (
            <h2 className="mt-1 text-2xl font-heading font-bold text-forest">No upcoming events</h2>
          )}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
        <div className="flex items-end justify-between gap-4 mb-4">
          <h2 className="section-title text-2xl">Latest results</h2>
          <Link to="/tournaments" className="text-sm font-heading font-semibold text-forest">All events</Link>
        </div>
        {!latestResult ? <p className="text-sm text-gray-500">Results will show here after the first event is published.</p> : (
          <div className="bg-white border border-[#E5E0D4] rounded-xl p-5">
            <h3 className="font-heading font-bold text-lg text-forest">{latest.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{formatDateLong(latest.date)} · {latest.course}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {winners.map((card) => (
                <div key={card.flight} className="rounded-lg bg-cream px-3 py-3">
                  <p className="text-xs uppercase tracking-wide text-gold font-heading font-semibold">{card.flight}</p>
                  {card.players.map((player) => (
                    <p key={player.name} className="mt-1 text-sm">{player.name}{player.score ? ` · ${player.score}` : ''}{player.relative ? ` · ${player.relative}` : ''}</p>
                  ))}
                </div>
              ))}
            </div>
            <Link to={`/tournaments/${latest.id}`} className="inline-block mt-4 text-sm font-heading font-semibold text-forest underline">Full leaderboard</Link>
          </div>
        )}
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
        <h2 className="section-title text-2xl">Season rankings</h2>
        <div className="gold-divider" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RankList title="Handicap" note="Top 10" rows={hdcp} value={(row) => `${row.poy ?? 0} pts`} />
          <RankList title="Scratch" note="Top 10" rows={scratch} value={(row) => `${row.scratchPts} pts`} />
        </div>
      </section>

      <section className="bg-white border-y border-[#E5E0D4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <p className="text-xs font-heading font-semibold uppercase tracking-widest text-gold mb-3">Sponsors</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sponsorNames.map((sponsor) => (
              <span key={sponsor.name} className="shrink-0 rounded-full border border-[#E5E0D4] px-3 py-1 text-sm text-forest">{sponsor.name}</span>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
