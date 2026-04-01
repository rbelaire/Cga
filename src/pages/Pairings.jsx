import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import flowControlPairings from '../data/pairings/2026-flow-control-pairings.json'
import { formatName } from '../utils/formatName'

const pairingsById = {
  '2026-01': flowControlPairings,
}

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
  const data = pairingsById[tournamentId]

  useEffect(() => {
    document.title = data ? `Pairings | ${data.tournament}` : 'Pairings | CGA 2026'
  }, [data])

  if (!data) {
    return (
      <PageWrapper>
        <div className="py-16 text-center">
          <h1 className="section-title text-3xl sm:text-4xl mb-2">Pairings Not Found</h1>
          <p className="text-gray-500 font-sans text-sm mb-6">
            No pairings are available for this tournament yet.
          </p>
          <Link to="/schedule" className="btn-primary">Back to Schedule</Link>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
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
