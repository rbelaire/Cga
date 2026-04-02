import { useEffect, useMemo } from 'react'
import HeroSection from '../components/sections/HeroSection'
import NextTournament from '../components/sections/NextTournament'
import QuickLinks from '../components/sections/QuickLinks'
import SponsorBar from '../components/sections/SponsorBar'
import { Link } from 'react-router-dom'
import { formatName } from '../utils/formatName'
import { computeScratch } from '../utils/computeScratch'
import { useFireData } from '../hooks/useFireData'
import { DB } from '../db'

const FLIGHTS = ['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight']

export default function Home() {
  useEffect(() => { document.title = 'Carencro Golf Association' }, [])
  const { data: standings } = useFireData(DB.listenStandings, { flights: {} })
  const { data: allResults } = useFireData(DB.listenResults, {})

  const hdcpTop10 = useMemo(() => {
    const all = []
    for (const flight of FLIGHTS) {
      for (const player of (standings?.flights?.[flight] || [])) {
        all.push(player)
      }
    }
    return all.sort((a, b) => (b.poy ?? 0) - (a.poy ?? 0)).slice(0, 10)
  }, [standings])

  const scratchTop10 = useMemo(() => computeScratch(allResults ?? {}).slice(0, 10), [allResults])

  return (
    <>
      <HeroSection />
      <NextTournament />
      <QuickLinks />

      {/* Rankings preview */}
      <section className="py-10 sm:py-14 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="section-title">2026 Season Rankings</h2>
              <div className="gold-divider" />
            </div>
            <Link to="/standings" className="btn-outline mb-7 text-sm py-2 px-4">
              Full Standings →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* HDCP Rankings */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-forest px-4 py-3 flex items-center justify-between">
                <h3 className="text-white font-sans text-sm font-semibold uppercase tracking-widest">HDCP Rankings</h3>
                <span className="text-white/50 font-sans text-xs">Top 10</span>
              </div>
              {hdcpTop10.length === 0 ? (
                <p className="text-gray-400 font-sans text-sm text-center py-8">No data yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {hdcpTop10.map((player, idx) => (
                    <li key={player.name} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className={`stat-number text-xs font-semibold w-5 text-right ${idx < 3 ? 'text-gold' : 'text-gray-400'}`}>
                          {idx + 1}
                        </span>
                        <span className={`font-sans text-sm ${idx < 3 ? 'text-darktext font-semibold' : 'text-darktext'}`}>
                          {formatName(player.name)}
                        </span>
                      </div>
                      <span className="stat-number text-xs text-gray-500">{player.poy} pts</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Scratch Rankings */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-forest px-4 py-3 flex items-center justify-between">
                <h3 className="text-white font-sans text-sm font-semibold uppercase tracking-widest">Scratch Rankings</h3>
                <span className="text-white/50 font-sans text-xs">Top 10</span>
              </div>
              {scratchTop10.length === 0 ? (
                <p className="text-gray-400 font-sans text-sm text-center py-8">No data yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {scratchTop10.map((player, idx) => (
                    <li key={player.name} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className={`stat-number text-xs font-semibold w-5 text-right ${idx < 3 ? 'text-gold' : 'text-gray-400'}`}>
                          {idx + 1}
                        </span>
                        <span className={`font-sans text-sm ${idx < 3 ? 'text-darktext font-semibold' : 'text-darktext'}`}>
                          {formatName(player.name)}
                        </span>
                      </div>
                      <span className="stat-number text-xs text-gray-500">{player.scratchPts} pts</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
