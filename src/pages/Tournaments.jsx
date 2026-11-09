import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import scheduleData from '../data/schedule.json'
import { DB } from '../db'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../hooks/useSubscription'
import { listenSavedFilter, listenSavedView, saveSavedFilter, saveSavedView } from '../lib/firebase/firestore'
import { feeLabel, mergeSchedule } from '../domain/schedule'
import { formatDate } from '../utils/formatDate'
import { buildRoundsByName, capProvisionalLeaderboard } from '../utils/poy'
import { buildFlightWinnerCards } from '../utils/flightWinners'
import { compareFlights, NEW_PLAYERS_FLIGHT } from '../utils/flightOrder'
import { formatName } from '../utils/formatName'
import PageWrapper from '../components/layout/PageWrapper'
import Empty from '../components/ui/Empty'

function useSaved(uid, page, listen, pick) {
  const [value, setValue] = useState(undefined)
  useEffect(() => {
    if (!uid || uid === 'practice') return undefined
    let alive = true
    const unsubscribe = listen(uid, page, (doc) => {
      queueMicrotask(() => { if (alive) setValue(pick(doc)) })
    })
    return () => { alive = false; unsubscribe?.() }
  }, [uid, page, listen, pick])
  return value
}

const pickView = (doc) => doc?.filters?.seasonView
const pickExpanded = (doc) => doc?.settings?.expandedTournament

function Leaderboard({ result }) {
  const flights = Object.keys(result?.leaderboard || {}).sort((a, b) => compareFlights(a, b))
  if (!flights.length) return <Empty title="The leaderboard is not posted yet." />
  return (
    <div className="space-y-4">
      {flights.map((flight) => (
        <div key={flight}>
          <h4 className="font-heading font-semibold text-forest mb-2">{flight}</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-1 pr-3">Place</th>
                  <th className="py-1 pr-3">Player</th>
                  <th className="py-1 pr-3">Score</th>
                  {flight !== NEW_PLAYERS_FLIGHT && <th className="py-1 pr-3">+/-</th>}
                  {flight !== NEW_PLAYERS_FLIGHT && <th className="py-1">POY</th>}
                </tr>
              </thead>
              <tbody>
                {(result.leaderboard[flight] || []).map((row) => (
                  <tr key={row.name} className="border-t border-[#E5E0D4]">
                    <td className="py-2 pr-3 stat-number">{row.wd ? 'WD' : row.rank || '—'}</td>
                    <td className="py-2 pr-3">{formatName(row.name)}</td>
                    <td className="py-2 pr-3 stat-number">{row.points}</td>
                    {flight !== NEW_PLAYERS_FLIGHT && <td className="py-2 pr-3 stat-number">{row.plusMinus > 0 ? `+${row.plusMinus}` : row.plusMinus}</td>}
                    {flight !== NEW_PLAYERS_FLIGHT && <td className="py-2 stat-number">{row.poy}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Tournaments() {
  useEffect(() => { document.title = 'Tournaments | CGA 2026' }, [])
  const { state } = useLocation()
  const { user } = useAuth()
  const status = useSubscription(DB.listenTournamentStatus, [])
  const results = useSubscription(DB.listenResults, [])
  const members = useSubscription(DB.listenMembers, [])
  const schedule = useMemo(() => mergeSchedule(scheduleData, status), [status])
  const completed = schedule.filter((event) => event.status === 'completed')
  const upcoming = schedule.filter((event) => event.status === 'upcoming')
  const savedView = useSaved(user?.uid, 'tournaments', listenSavedFilter, pickView)
  const savedExpanded = useSaved(user?.uid, 'tournaments', listenSavedView, pickExpanded)
  const [viewChoice, setViewChoice] = useState(null)
  const [openChoice, setOpenChoice] = useState(state?.expand ?? null)
  const seasonView = viewChoice || savedView || 'all'
  const openId = openChoice ?? savedExpanded ?? completed[0]?.id ?? null
  const roundsByName = useMemo(() => buildRoundsByName(members || []), [members])
  const capped = useMemo(() => Object.fromEntries(Object.entries(results || {}).map(([id, result]) => [
    id,
    result?.leaderboard ? { ...result, leaderboard: capProvisionalLeaderboard(result.leaderboard, roundsByName) } : result,
  ])), [results, roundsByName])

  async function chooseView(next) {
    setViewChoice(next)
    if (user?.uid && user.uid !== 'practice') await saveSavedFilter(user.uid, 'tournaments', { seasonView: next })
  }

  async function toggle(id) {
    const next = openId === id ? '' : id
    setOpenChoice(next)
    if (user?.uid && user.uid !== 'practice' && next) await saveSavedView(user.uid, 'tournaments', { expandedTournament: next })
  }

  return (
    <PageWrapper>
      <h1 className="section-title">2026 Tournaments</h1>
      <div className="gold-divider" />
      <p className="text-sm text-gray-600 mb-4">{completed.length} of {schedule.length} events are finished.</p>
      <div className="h-2 rounded-full bg-[#E5E0D4] mb-6 overflow-hidden">
        <div className="h-full bg-gold" style={{ width: `${Math.round((completed.length / schedule.length) * 100)}%` }} />
      </div>
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {['all', 'upcoming', 'completed'].map((key) => (
          <button key={key} type="button" onClick={() => chooseView(key)} className={`px-3 py-2 rounded-md text-sm font-heading font-semibold capitalize ${seasonView === key ? 'bg-forest text-white' : 'bg-white border border-[#E5E0D4]'}`}>{key}</button>
        ))}
      </div>

      {(seasonView === 'all' || seasonView === 'upcoming') && (
        <section className="mb-8">
          <h2 className="font-heading font-bold text-xl text-forest mb-3">Upcoming</h2>
          {upcoming.length === 0 ? <Empty title="No upcoming events." /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {upcoming.map((event) => (
                <Link key={event.id} to={`/tournaments/${event.id}`} className="block bg-white border border-[#E5E0D4] rounded-xl p-4 hover:border-gold">
                  <p className="text-xs text-gold font-heading font-semibold uppercase">{formatDate(event.date)}</p>
                  <h3 className="font-heading font-bold text-lg text-forest">{event.name}</h3>
                  <p className="text-sm text-gray-600">{event.course}</p>
                  <p className="text-sm text-gray-600">{event.teeTime} · {event.format} · {feeLabel(event.entryFee)}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {(seasonView === 'all' || seasonView === 'completed') && (
        <section>
          <h2 className="font-heading font-bold text-xl text-forest mb-3">Completed</h2>
          {completed.length === 0 ? <Empty title="No completed events yet." /> : (
            <div className="space-y-3">
              {completed.map((event) => {
                const result = capped[event.id]
                const open = openId === event.id
                return (
                  <article key={event.id} className="bg-white border border-[#E5E0D4] rounded-xl">
                    <button type="button" className="w-full text-left px-4 py-3" aria-expanded={open} onClick={() => toggle(event.id)}>
                      <p className="text-xs text-gold font-heading font-semibold uppercase">{formatDate(event.date)}</p>
                      <h3 className="font-heading font-bold text-forest">{event.name}</h3>
                      <p className="text-sm text-gray-500">{event.course}</p>
                    </button>
                    {open && (
                      <div className="px-4 pb-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                          {buildFlightWinnerCards(result, event.format).map((card) => (
                            <div key={card.flight} className="rounded-lg bg-cream px-3 py-2 text-sm">
                              <p className="text-xs uppercase text-gold font-heading font-semibold">{card.flight}</p>
                              {card.players.map((player) => <p key={player.name}>{player.name}{player.score ? ` · ${player.score}` : ''}</p>)}
                            </div>
                          ))}
                        </div>
                        <Leaderboard result={result} />
                        <Link to={`/tournaments/${event.id}`} className="inline-block mt-3 text-sm font-heading font-semibold text-forest underline">Event page</Link>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}
    </PageWrapper>
  )
}
