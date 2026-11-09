import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import scheduleData from '../data/schedule.json'
import { DB } from '../db'
import { useSubscription } from '../hooks/useSubscription'
import { mergeSchedule } from '../domain/schedule'
import { pairingGroups } from '../domain/pairings'
import { formatDateLong } from '../utils/formatDate'
import { formatName } from '../utils/formatName'
import PageWrapper from '../components/layout/PageWrapper'
import Empty from '../components/ui/Empty'

export default function Pairings() {
  const { tournamentId } = useParams()
  const status = useSubscription(DB.listenTournamentStatus, [])
  const event = useMemo(() => mergeSchedule(scheduleData, status).find((item) => item.id === tournamentId), [status, tournamentId])
  const doc = useSubscription((cb) => DB.listenPairingsForTournament(tournamentId, cb), [tournamentId])
  const groups = pairingGroups(doc)
  useEffect(() => { document.title = event ? `Pairings · ${event.name}` : 'Pairings | CGA' }, [event])

  return (
    <PageWrapper>
      <Link to={event ? `/tournaments/${event.id}` : '/tournaments'} className="text-sm font-heading font-semibold text-forest">← Event</Link>
      <h1 className="section-title mt-3">Pairings</h1>
      <div className="gold-divider" />
      {event && <p className="text-sm text-gray-600 mb-6">{event.name} · {formatDateLong(event.date)} · {event.course}</p>}
      {!event ? <Empty title="That event is not on the schedule." /> : groups.length === 0 ? (
        <Empty title="Pairings are not posted yet.">Check back after the board posts groups.</Empty>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.map((group) => (
            <article key={group.pairing} className="bg-white border border-[#E5E0D4] rounded-xl p-4">
              <h2 className="font-heading font-semibold text-forest">{group.pairing || 'Group'}</h2>
              <ul className="mt-3 space-y-2">
                {(group.players || []).map((player) => (
                  <li key={player.name} className="flex items-center justify-between gap-3 text-sm">
                    <span>{formatName(player.name)}</span>
                    <span className="text-xs text-gray-500">{player.flight}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </PageWrapper>
  )
}
