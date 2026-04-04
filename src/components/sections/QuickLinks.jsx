import { Link } from 'react-router-dom'

const links = [
  {
    to: '/tournaments',
    label: 'Tournaments',
    description: 'Schedule & results',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    to: '/standings',
    label: 'Standings',
    description: 'POY & scratch rankings',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    to: '/members',
    label: 'Members',
    description: 'Member directory',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    to: '/info',
    label: 'Info',
    description: 'Rules, eligibility & board',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
]

export default function QuickLinks() {
  return (
    <section className="py-8 sm:py-10 bg-gray-50 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {links.map(({ to, label, description, icon }) => (
            <Link
              key={label}
              to={to}
              className="group flex flex-col items-center text-center px-2 py-5 sm:p-6 bg-white border border-gray-200 rounded-xl hover:border-gold hover:shadow-sm active:scale-95 transition-all duration-150"
            >
              <div className="w-12 h-12 flex items-center justify-center rounded-full bg-forest/5 text-forest mb-3 group-hover:bg-gold/10 group-hover:text-gold transition-colors duration-150">
                {icon}
              </div>
              <span className="text-darktext text-xs sm:text-sm font-sans font-semibold leading-tight mb-1">
                {label}
              </span>
              <span className="text-gray-400 text-xs font-sans hidden sm:block leading-snug">
                {description}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
