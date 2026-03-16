import { Link } from 'react-router-dom'

export default function HeroSection() {
  return (
    <section
      className="relative bg-forest overflow-hidden"
      style={{
        backgroundImage: 'radial-gradient(ellipse at 70% 50%, rgba(200,169,81,0.08) 0%, transparent 60%)',
      }}
    >
      {/* Decorative stripe */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold opacity-40" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        <div className="max-w-2xl">
          {/* Season tag */}
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-0.5 bg-gold" />
            <span className="text-gold text-xs font-sans font-semibold uppercase tracking-widest">
              2026 Season
            </span>
          </div>

          <h1 className="text-offwhite text-4xl sm:text-5xl lg:text-6xl font-serif font-bold leading-tight mb-4">
            Carencro<br />
            <span className="text-gold">Golf Association</span>
          </h1>

          <p className="text-gray-300 text-base sm:text-lg font-sans leading-relaxed mb-8 max-w-lg">
            Bringing Acadiana's finest golfers together. Compete, connect, and celebrate the game in the heart of Lafayette Parish.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link to="/schedule" className="btn-primary">
              View Schedule
            </Link>
            <Link to="/standings" className="btn-outline">
              2026 Standings
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
