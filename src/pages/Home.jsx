import { useEffect } from 'react'
import HeroSection from '../components/sections/HeroSection'
import NextTournament from '../components/sections/NextTournament'
import QuickLinks from '../components/sections/QuickLinks'
import SponsorBar from '../components/sections/SponsorBar'
import { Link } from 'react-router-dom'
import standings from '../data/standings.json'

const FLIGHTS = ['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight']

export default function Home() {
  useEffect(() => { document.title = 'Carencro Golf Association' }, [])

  return (
    <>
      <HeroSection />
      <NextTournament />
      <QuickLinks />

      {/* Per-flight standings preview */}
      <section className="py-10 sm:py-14 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="section-title">2026 Flight Standings</h2>
              <div className="gold-divider" />
            </div>
            <Link
              to="/standings"
              className="mb-7 px-4 py-2 text-sm font-sans font-medium rounded-lg border border-forest text-forest hover:bg-forest hover:text-white transition-colors"
            >
              Full Standings →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FLIGHTS.map((flight) => {
              const top5 = (standings.flights[flight] || []).slice(0, 5)
              return (
                <div key={flight} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-forest px-4 py-3">
                    <h3 className="text-white font-sans text-sm font-semibold uppercase tracking-widest">{flight}</h3>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {top5.map((player, idx) => (
                      <li key={player.name} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className={`stat-number text-xs font-semibold w-5 text-right ${idx < 3 ? 'text-gold' : 'text-gray-400'}`}>
                            {player.rank}
                          </span>
                          <span className={`font-sans text-sm ${idx < 3 ? 'text-darktext font-semibold' : 'text-darktext'}`}>
                            {player.name}
                          </span>
                        </div>
                        <span className="stat-number text-xs text-gray-500">{player.poy} pts</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Dues CTA */}
      <section className="py-10 bg-amber-50 border-y border-amber-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
          <div>
            <h2 className="text-darktext font-serif text-xl font-bold mb-1">2026 Dues Now Open</h2>
            <p className="text-gray-600 font-sans text-sm">Annual membership dues are $75. Pay via Venmo to stay active for the season.</p>
          </div>
          <a
            href="https://venmo.com/CGA-Pay"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary whitespace-nowrap shrink-0"
          >
            Pay Dues on Venmo
          </a>
        </div>
      </section>

      <SponsorBar />
    </>
  )
}
