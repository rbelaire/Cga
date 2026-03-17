import { Link } from 'react-router-dom'
import sponsors from '../../data/sponsors.json'

export default function SponsorBar() {
  const all = [...sponsors.tournament, ...sponsors.banquet, ...sponsors.trophy]

  return (
    <section className="bg-gray-50 border-t border-gray-200 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-6">
          <p className="text-gray-400 text-xs font-sans uppercase tracking-widest">
            2026 Sponsors
          </p>
          <div className="flex-1 h-px bg-gray-200" />
          <Link to="/sponsors" className="text-forest text-xs font-sans hover:text-gold transition-colors">
            View all →
          </Link>
        </div>
        <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
          {all.map((s) => (
            s.url ? (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-forest text-sm font-sans transition-colors px-3 py-1.5 border border-gray-200 hover:border-forest rounded"
              >
                {s.name}
              </a>
            ) : (
              <span
                key={s.name}
                className="text-gray-500 text-sm font-sans px-3 py-1.5 border border-gray-200 rounded"
              >
                {s.name}
              </span>
            )
          ))}
        </div>
      </div>
    </section>
  )
}
