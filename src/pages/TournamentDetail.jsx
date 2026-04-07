import { useEffect, useState, useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import CountdownTimer from '../components/ui/CountdownTimer'
import schedule from '../data/schedule.json'
import { formatDate, formatDateLong } from '../utils/formatDate'
import { DB } from '../db'
import { buildFlightWinnerCards } from '../utils/flightWinners'
import FlightWinnerCards from '../components/ui/FlightWinnerCards'

function DetailItem({ label, value }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-gray-400 font-sans uppercase tracking-widest mb-1">{label}</p>
      <p className="text-sm text-darktext font-sans">{value}</p>
    </div>
  )
}

export default function TournamentDetail() {
  const { tournamentId } = useParams()
  const tournament = useMemo(
    () => schedule.find((item) => item.id === tournamentId),
    [tournamentId],
  )

  // Subscribe only to this tournament's documents instead of the entire
  // results/pairings/lifecycle maps.  This keeps reads bounded regardless
  // of how many tournaments have been entered historically.
  const [result,       setResult]       = useState(null)
  const [pairingsDoc,  setPairingsDoc]  = useState(null)
  const [lifecycleDoc, setLifecycleDoc] = useState(null)

  useEffect(() => {
    if (!tournamentId) return
    const u1 = DB.listenResult(tournamentId, setResult)
    const u2 = DB.listenPairingsForTournament(tournamentId, setPairingsDoc)
    const u3 = DB.listenLifecycleForTournament(tournamentId, setLifecycleDoc)
    return () => { u1(); u2(); u3() }
  }, [tournamentId])

  const pairingsState     = lifecycleDoc?.pairingsState
  const hasLegacyPairings = Boolean(pairingsDoc)
  const isPairingsPublished = pairingsState === 'published' || (!pairingsState && hasLegacyPairings)
  const pairings = isPairingsPublished ? pairingsDoc : null

  const hasPublishedContent = Boolean(result) || Boolean(pairings)

  useEffect(() => {
    document.title = tournament
      ? `${tournament.name} | CGA 2026`
      : 'Tournament | CGA 2026'
  }, [tournament])

  if (!tournament) {
    return <Navigate to="/tournaments" replace />
  }

  return (
    <PageWrapper>
      <nav className="flex items-center gap-1.5 text-xs font-sans text-gray-400 mb-6">
        <Link to="/" className="hover:text-forest transition-colors">Home</Link>
        <span>/</span>
        <Link to="/tournaments" className="hover:text-forest transition-colors">Schedule</Link>
        <span>/</span>
        <span className="text-darktext font-medium">Tournament</span>
      </nav>

      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">{tournament.name}</h1>
        <div className="gold-divider" />
        <p className="text-gray-500 font-sans text-sm">{formatDateLong(tournament.date)}</p>
      </div>

      <section className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <DetailItem label="Date" value={formatDate(tournament.date)} />
          <DetailItem label="Course" value={tournament.course} />
          <DetailItem label="Format" value={tournament.format} />
          <DetailItem label="Entry" value={isNaN(tournament.entryFee) ? tournament.entryFee : `$${tournament.entryFee}`} />
          <DetailItem label="Tee Time" value={tournament.teeTime} />
        </div>

        {(tournament.status === 'upcoming') && (
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 font-sans uppercase tracking-widest mb-2">Countdown</p>
            <CountdownTimer targetDate={tournament.date} />
          </div>
        )}
      </section>

      {tournament.notes && (
        <section className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
          <h2 className="text-forest text-xs font-sans font-semibold uppercase tracking-widest mb-2">
            Details
          </h2>
          <p className="text-gray-600 font-sans text-sm">{tournament.notes}</p>
        </section>
      )}

      {!hasPublishedContent && (
        <section className="bg-amber-50 border border-amber-100 rounded-lg p-6 mb-6 text-center">
          <p className="text-amber-800 font-sans text-base font-semibold mb-2">Registration in progress</p>
          <p className="text-amber-700 font-sans text-sm">
            Tournament details will be posted soon. Check back for pairings, results, and updates.
          </p>
        </section>
      )}

      {pairings && (
        <section className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
          <h2 className="text-forest text-xs font-sans font-semibold uppercase tracking-widest mb-2">
            Published Pairings
          </h2>
          <p className="text-gray-500 font-sans text-sm mb-4">
            {pairings.pairings?.length ?? 0} groups are currently posted for this event.
          </p>
          <Link to={`/pairings/${tournamentId}`} className="btn-outline text-sm py-2 px-4">
            View Pairings
          </Link>
        </section>
      )}

      {result && (
        <section className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5">
          <h2 className="text-forest text-xs font-sans font-semibold uppercase tracking-widest mb-2.5">
            Published Results
          </h2>
          {buildFlightWinnerCards(result, tournament.format).length > 0 && (
            <FlightWinnerCards winners={buildFlightWinnerCards(result, tournament.format)} className="mb-4" />
          )}
          <Link
            to="/tournaments"
            state={{ expand: tournamentId }}
            className="inline-block text-forest text-sm font-sans font-medium hover:text-gold transition-colors"
          >
            View Full Results →
          </Link>
        </section>
      )}
    </PageWrapper>
  )
}
