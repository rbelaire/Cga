import HeroSection from '../components/sections/HeroSection'
import NextTournament from '../components/sections/NextTournament'
import QuickLinks from '../components/sections/QuickLinks'
import SponsorBar from '../components/sections/SponsorBar'
import StandingsTable from '../components/ui/StandingsTable'
import { Link } from 'react-router-dom'
import standings from '../data/standings.json'

export default function Home() {
  const top5 = standings.slice(0, 5)

  return (
    <>
      <HeroSection />
      <NextTournament />
      <QuickLinks />

      {/* Mini standings preview */}
      <section className="py-16 bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="section-title text-offwhite">2026 Standings</h2>
              <div className="gold-divider" />
            </div>
            <Link to="/standings" className="text-gold text-sm font-sans hover:text-gold-light transition-colors mb-7">
              Full standings →
            </Link>
          </div>
          <StandingsTable data={top5} />
        </div>
      </section>

      {/* Dues CTA */}
      <section className="py-16 bg-forest">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-offwhite font-serif text-2xl font-bold mb-1">2026 Dues Now Open</h2>
            <p className="text-gray-300 font-sans text-sm">Annual membership dues are $75. Pay via Venmo to stay active for the season.</p>
          </div>
          <a
            href="https://venmo.com/CGA-Pay"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary whitespace-nowrap"
          >
            Pay Dues on Venmo
          </a>
        </div>
      </section>

      <SponsorBar />
    </>
  )
}
