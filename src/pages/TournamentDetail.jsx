import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import scheduleData from '../data/schedule.json'
import { DB } from '../db'
import { useSubscription } from '../hooks/useSubscription'
import { feeLabel, mergeSchedule } from '../domain/schedule'
import { pairingGroups } from '../domain/pairings'
import { formatDateFull } from '../utils/formatDate'
import { buildRoundsByName, capProvisionalLeaderboard } from '../utils/poy'
import { formatName } from '../utils/formatName'
import { compareFlights, NEW_PLAYERS_FLIGHT } from '../utils/flightOrder'
import PageWrapper from '../components/layout/PageWrapper'
import Empty from '../components/ui/Empty'

export default function TournamentDetail() {
  const { tournamentId } = useParams()
  const status = useSubscription(DB.listenTournamentStatus, [])
  const members = useSubscription(DB.listenMembers, [])
  const event = useMemo(() => mergeSchedule(scheduleData, status).find((item) => item.id === tournamentId), [status, tournamentId])
  const result = useSubscription((cb) => DB.listenResult(tournamentId, cb), [tournamentId])
  const pairingDoc = useSubscription((cb) => DB.listenPairingsForTournament(tournamentId, cb), [tournamentId])
  const groups = pairingGroups(pairingDoc)
  useEffect(() => { document.title = event ? `${event.name} | CGA` : 'Tournament | CGA' }, [event])
  const roundsByName = useMemo(() => buildRoundsByName(members || []), [members])
  const leaderboard = result?.leaderboard ? capProvisionalLeaderboard(result.leaderboard, roundsByName) : null

  if (!event) {
    return <PageWrapper><Empty title="That event is not on the 2026 schedule."><Link to="/tournaments" className="underline">Back to the schedule</Link></Empty></PageWrapper>
  }

  return (
    <PageWrapper>
      <Link to="/tournaments" className="text-sm text-forest font-heading font-semibold">← Schedule</Link>
      <h1 className="section-title mt-3">{event.name}</h1>
      <div className="gold-divider" />
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8 text-sm">
        <div className="bg-white border border-[#E5E0D4] rounded-xl p-4"><dt className="text-gray-500">Date</dt><dd className="font-semibold">{formatDateFull(event.date)}</dd></div>
        <div className="bg-white border border-[#E5E0D4] rounded-xl p-4"><dt className="text-gray-500">Course</dt><dd className="font-semibold">{event.course}</dd></div>
        <div className="bg-white border border-[#E5E0D4] rounded-xl p-4"><dt className="text-gray-500">Start</dt><dd className="font-semibold">{event.teeTime} · {event.format}</dd></div>
        <div className="bg-white border border-[#E5E0D4] rounded-xl p-4"><dt className="text-gray-500">Entry</dt><dd className="font-semibold">{feeLabel(event.entryFee) || 'See the club'}</dd></div>
      </dl>

      <h2 className="font-heading font-bold text-xl text-forest mb-3">Results</h2>
      {!leaderboard ? <Empty title="Results are not posted yet." /> : (
        <div className="space-y-5 mb-8">
          {Object.keys(leaderboard).sort((a, b) => compareFlights(a, b)).map((flight) => (
            <section key={flight} className="bg-white border border-[#E5E0D4] rounded-xl p-4">
              <h3 className="font-heading font-semibold text-forest mb-2">{flight}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="py-1 pr-3">Place</th><th className="py-1 pr-3">Player</th><th className="py-1 pr-3">Score</th>{flight !== NEW_PLAYERS_FLIGHT && <th className="py-1">+/-</th>}</tr></thead>
                  <tbody>
                    {(leaderboard[flight] || []).map((row) => (
                      <tr key={row.name} className="border-t border-[#E5E0D4]">
                        <td className="py-2 pr-3 stat-number">{row.wd ? 'WD' : row.rank || '—'}</td>
                        <td className="py-2 pr-3">{formatName(row.name)}</td>
                        <td className="py-2 pr-3 stat-number">{row.points}</td>
                        {flight !== NEW_PLAYERS_FLIGHT && <td className="py-2 stat-number">{row.plusMinus > 0 ? `+${row.plusMinus}` : row.plusMinus}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      <h2 className="font-heading font-bold text-xl text-forest mb-3">Pairings</h2>
      {groups.length === 0 ? <Empty title="Pairings are not posted yet." /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groups.map((group) => (
            <article key={group.pairing} className="bg-white border border-[#E5E0D4] rounded-xl p-4">
              <h3 className="font-heading font-semibold text-forest">{group.pairing}</h3>
              <ul className="mt-2 text-sm space-y-1">
                {(group.players || []).map((player) => <li key={player.name}>{formatName(player.name)} <span className="text-gray-500">· {player.flight}</span></li>)}
              </ul>
            </article>
          ))}
        </div>
      )}
      <Link to={`/pairings/${event.id}`} className="inline-block mt-4 text-sm font-heading font-semibold text-forest underline">Open the pairings page</Link>
    </PageWrapper>
  )
}
