import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import { formatName } from '../utils/formatName'
import { useFireData } from '../hooks/useFireData'
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

export default function Pairings() {
  const { tournamentId } = useParams()
  const { data: pairingsMap } = useFireData(DB.listenPairings, {})

  const data = pairingsMap?.[tournamentId] ?? null

  useEffect(() => {
    document.title = data ? `Pairings | ${data.tournament}` : 'Pairings | CGA 2026'
  }, [data])

  if (!data) {
    return (
      <PageWrapper>
        <div className="py-16 text-center max-w-md mx-auto">
          <div className="text-5xl mb-4">🏌️</div>
          <h1 className="section-title text-2xl sm:text-3xl mb-2">Pairings Not Posted Yet</h1>
          <p className="text-gray-500 font-sans text-sm mb-2">
            No pairings are available for this tournament yet.
          </p>
          <p className="text-gray-400 font-sans text-xs mb-8">
            Pairings are typically posted 3–5 days before the tournament date. Check back closer to the event.
          </p>
          <Link to="/schedule" className="btn-primary">← Back to Schedule</Link>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <nav className="flex items-center gap-1.5 text-xs font-sans text-gray-400 mb-6">
        <Link to="/" className="hover:text-forest transition-colors">Home</Link>
        <span>/</span>
        <Link to="/schedule" className="hover:text-forest transition-colors">Schedule</Link>
        <span>/</span>
        <span className="text-darktext font-medium">Pairings</span>
      </nav>

      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">{data.tournament} Pairings</h1>
        <div className="gold-divider" />
        <p className="text-gray-500 font-sans text-sm">
          Source: {data.source}
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
