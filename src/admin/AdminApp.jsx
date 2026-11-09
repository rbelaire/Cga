import { NavLink, useLocation, useSearchParams } from 'react-router-dom'
import scheduleData from '../data/schedule.json'
import { DB, practiceMode } from '../db'
import { useAuth } from '../context/AuthContext'
import { mergeSchedule } from '../domain/schedule'
import { formatDate } from '../utils/formatDate'
import { computeTournamentWorkflowState } from '../utils/tournamentWorkflow'
import ClubProvider from './ClubProvider'
import { useClub } from './useClub'
import FieldStep from './steps/FieldStep'
import FlightsStep from './steps/FlightsStep'
import PairingsStep from './steps/PairingsStep'
import ScoresStep from './steps/ScoresStep'
import ReviewStep from './steps/ReviewStep'
import PublishStep from './steps/PublishStep'
import RosterPage from './RosterPage'
import PeoplePage from './PeoplePage'
import ExportsPage from './ExportsPage'
import HistoryPage from './HistoryPage'
import { Notice } from './ui'

const STEPS = [
  ['field', 'Who is playing'],
  ['flights', 'Flights'],
  ['pairings', 'Pairings'],
  ['scores', 'Scores'],
  ['review', 'Review'],
  ['publish', 'Publish'],
]

const LINKS = [
  ['/admin', 'Events'],
  ['/admin/roster', 'Roster'],
  ['/admin/people', 'Accounts'],
  ['/admin/exports', 'Downloads'],
  ['/admin/history', 'History'],
]

export default function AdminApp() {
  const { isAdmin, loading, usersReady } = useAuth()
  if (loading || !usersReady) {
    return <p className="flex-1 text-center py-16 text-sm text-gray-500">Checking access…</p>
  }
  if (!isAdmin) {
    return <p className="flex-1 text-center py-16 text-sm text-gray-600">This account is signed in, but it is not a board admin.</p>
  }
  return (
    <ClubProvider>
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {practiceMode && <Notice>Practice mode. Nothing on these screens is saved to the live site.</Notice>}
        <h1 className="font-heading font-bold text-2xl text-forest">Run the club</h1>
        <p className="text-sm text-gray-600 mb-4">Pick an event and follow the steps. Each save is stored immediately.</p>
        <nav className="flex gap-2 overflow-x-auto mb-6">
          {LINKS.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/admin'} className={({ isActive }) => `px-3 py-2 rounded-md text-sm font-heading font-semibold whitespace-nowrap ${isActive ? 'bg-forest text-white' : 'bg-white border border-[#E5E0D4]'}`}>{label}</NavLink>
          ))}
        </nav>
        <AdminPage />
      </div>
    </ClubProvider>
  )
}

function AdminPage() {
  const { pathname } = useLocation()
  if (pathname.endsWith('/roster')) return <RosterPage />
  if (pathname.endsWith('/people')) return <PeoplePage />
  if (pathname.endsWith('/exports')) return <ExportsPage />
  if (pathname.endsWith('/history')) return <HistoryPage />
  return <EventDesk />
}

function EventDesk() {
  const club = useClub()
  const [params, setParams] = useSearchParams()
  const tid = params.get('event')
  const step = params.get('step') || 'field'
  const schedule = mergeSchedule(scheduleData, club.status)
  const event = schedule.find((item) => item.id === tid)
  if (!event) {
    return (
      <div className="space-y-3">
        {!club.ready && <Notice>Loading saved events…</Notice>}
        {schedule.map((item) => {
          const state = computeTournamentWorkflowState({
            tournamentId: item.id,
            tournament: item,
            scoresByTournament: club.scores,
            pairingsByTournament: club.pairings,
            paymentsByTournament: club.payments,
            resultsByTournament: club.results,
            lifecycleByTournament: club.lifecycle,
          })
          const next = state.steps.find((part) => part.status !== 'complete')
          return (
            <article key={item.id} className="bg-white border border-[#E5E0D4] rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-gold font-heading font-semibold">{formatDate(item.date)} · {item.status}</p>
              <h2 className="font-heading font-bold text-lg text-forest">{item.name}</h2>
              <ul className="text-sm text-gray-600 mt-2 space-y-1">
                {state.steps.map((part) => <li key={part.key}>{part.title}: {part.label}</li>)}
              </ul>
              <button type="button" className="btn-primary mt-3" onClick={() => setParams({ event: item.id, step: next?.key === 'payments' || next?.key === 'entries' ? 'field' : next?.key === 'results' ? 'publish' : next?.key || 'field' })}>
                {next ? `Next: ${next.title}` : 'Review this event'}
              </button>
              {item.status === 'upcoming' && (
                <button type="button" className="btn-outline mt-3 ml-2" onClick={() => mark(item.id, true, club)}>Mark finished</button>
              )}
              {club.status?.completed?.[item.id] && (
                <button type="button" className="btn-outline mt-3 ml-2" onClick={() => mark(item.id, false, club)}>Reopen</button>
              )}
            </article>
          )
        })}
      </div>
    )
  }

  const index = Math.max(0, STEPS.findIndex(([key]) => key === step))
  const Step = [FieldStep, FlightsStep, PairingsStep, ScoresStep, ReviewStep, PublishStep][index] || FieldStep
  const next = STEPS[index + 1]

  return (
    <div>
      <button type="button" className="text-sm font-heading font-semibold text-forest mb-3" onClick={() => setParams({})}>← All events</button>
      <h2 className="font-heading font-bold text-xl text-forest">{event.name}</h2>
      <p className="text-sm text-gray-500 mb-4">{formatDate(event.date)} · {event.course}</p>
      <div className="flex gap-2 overflow-x-auto mb-4">
        {STEPS.map(([key, label], stepIndex) => (
          <button key={key} type="button" onClick={() => setParams({ event: event.id, step: key })} className={`px-3 py-2 rounded-md text-sm whitespace-nowrap ${stepIndex === index ? 'bg-forest text-white' : 'bg-white border border-[#E5E0D4]'}`}>{stepIndex + 1}. {label}</button>
        ))}
      </div>
      <Step event={event} />
      {next && <button type="button" className="btn-primary mt-4" onClick={() => setParams({ event: event.id, step: next[0] })}>Next: {next[1]}</button>}
    </div>
  )
}

async function mark(id, done, club) {
  const completed = { ...(club.status?.completed || {}) }
  if (done) completed[id] = true
  else delete completed[id]
  await DB.saveTournamentStatus({ ...(club.status || {}), completed })
}
