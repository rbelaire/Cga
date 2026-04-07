import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import { formatName } from '../utils/formatName'
import { DB } from '../db'

const flightTagStyles = {
  Championship: 'bg-amber-50 text-amber-700 border-amber-200',
  '1st Flight': 'bg-blue-50 text-blue-700 border-blue-200',
  '2nd Flight': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  '3rd Flight': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '4th Flight': 'bg-purple-50 text-purple-700 border-purple-200',
  '5th Flight': 'bg-pink-50 text-pink-700 border-pink-200',
  Unassigned: 'bg-gray-100 text-gray-600 border-gray-200',
}

function EmptyPairingsIcon() {
  return (
    <svg className="w-14 h-14 mb-4 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21V4m0 0h10l-2.5 3L17 10H7" />
      <circle cx="7" cy="21" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export default function Pairings() {
  const { tournamentId } = useParams()

  // Subscribe only to this tournament's documents — avoids loading the entire
  // pairings map which grows with every tournament added.
  const [pairingsDoc,  setPairingsDoc]  = useState(null)
  const [lifecycleDoc, setLifecycleDoc] = useState(null)

  useEffect(() => {
    if (!tournamentId) return
    const u1 = DB.listenPairingsForTournament(tournamentId, setPairingsDoc)
    const u2 = DB.listenLifecycleForTournament(tournamentId, setLifecycleDoc)
    return () => { u1(); u2() }
  }, [tournamentId])

  const pairingsState     = lifecycleDoc?.pairingsState
  const hasLegacyPairings = Boolean(pairingsDoc)
  const isPublished = pairingsState === 'published' || (!pairingsState && hasLegacyPairings)
  const data = isPublished ? pairingsDoc : null

  useEffect(() => {
    document.title = data ? `Pairings | ${data.tournament}` : 'Pairings | CGA 2026'
  }, [data])

  if (!data) {
    return (
      <PageWrapper>
        <div className="py-16 text-center max-w-md mx-auto">
          <EmptyPairingsIcon />
          <h1 className="section-title text-2xl sm:text-3xl mb-2">Pairings Not Posted Yet</h1>
          <p className="text-gray-500 font-sans text-sm mb-2">
            No pairings are available for this tournament yet.
          </p>
          <p className="text-gray-400 font-sans text-xs mb-8">
            Pairings are typically posted 3–5 days before the tournament date. Check back closer to the event.
          </p>
          <Link to="/tournaments" className="btn-primary">← Back to Schedule</Link>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <nav className="flex items-center gap-1.5 text-xs font-sans text-gray-400 mb-6">
        <Link to="/" className="hover:text-forest transition-colors">Home</Link>
        <span>/</span>
        <Link to="/tournaments" className="hover:text-forest transition-colors">Schedule</Link>
        <span>/</span>
        <span className="text-darktext font-medium">Pairings</span>
      </nav>

      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">{data.tournament} Pairings</h1>
        <div className="gold-divider" />
        <p className="text-gray-500 font-sans text-sm">
          {data.source ? `Source: ${data.source}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.pairings.map((group) => (
          <section key={group.pairing} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <header className="bg-forest px-4 py-2.5">
              <h2 className="text-white font-sans text-sm font-semibold uppercase tracking-widest">
                {group.pairing}
              </h2>
            </header>
            <ul className="divide-y divide-gray-100">
              {group.players.map((player) => (
                <li key={player.name} className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-darktext font-sans text-sm font-medium">{formatName(player.name)}</span>
                  <span
                    className={`text-xs border px-2 py-0.5 rounded-full font-sans ${flightTagStyles[player.flight] || flightTagStyles.Unassigned}`}
                  >
                    {player.flight}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PageWrapper>
  )
}
