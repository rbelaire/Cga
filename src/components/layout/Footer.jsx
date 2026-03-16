import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-charcoal text-offwhite mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full border-2 border-gold flex items-center justify-center">
                <span className="text-gold font-serif font-bold text-sm">CGA</span>
              </div>
              <div>
                <span className="text-offwhite font-serif text-base font-semibold block leading-tight">
                  Carencro Golf Association
                </span>
                <span className="text-gold text-xs font-sans tracking-widest uppercase">
                  Carencro, Louisiana
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-400 font-sans leading-relaxed">
              Bringing golfers together in the heart of Acadiana since 2000.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-gold font-sans text-xs font-semibold uppercase tracking-widest mb-3">
              Quick Links
            </h3>
            <ul className="space-y-2">
              {[
                ['/', 'Home'],
                ['/schedule', 'Tournament Schedule'],
                ['/standings', 'Season Standings'],
                ['/results', 'Results'],
                ['/eligibility', 'Eligibility Rules'],
              ].map(([to, label]) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="text-sm text-gray-400 hover:text-gold transition-colors font-sans"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Pay dues */}
          <div>
            <h3 className="text-gold font-sans text-xs font-semibold uppercase tracking-widest mb-3">
              Pay Dues
            </h3>
            <p className="text-sm text-gray-400 font-sans mb-4">
              2026 annual dues are $75. Pay securely via Venmo.
            </p>
            <a
              href="https://venmo.com/CGA-Pay"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-gold text-forest text-sm font-sans font-semibold px-5 py-2.5 rounded hover:bg-gold-dark transition-colors"
            >
              Pay on Venmo →
            </a>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-500 font-sans">
            © 2026 Carencro Golf Association. All rights reserved.
          </p>
          <p className="text-xs text-gray-500 font-sans">
            Built by{' '}
            <a
              href="https://belairestudio.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:text-gold-light transition-colors"
            >
              Belaire Studio
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
