import { useState, useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/standings', label: 'Standings' },
  { to: '/members', label: 'Members' },
  { to: '/info', label: 'Info' },
  { to: '/admin', label: 'Admin', highlight: true },
]

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { user, signOut } = useAuth()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 transition-shadow duration-300 bg-forest ${
        scrolled ? 'shadow-lg shadow-black/30' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3" onClick={() => setMenuOpen(false)}>
            <img
              src={`${import.meta.env.BASE_URL}cga.svg`}
              alt="CGA Logo"
              className="h-10 w-10 object-contain"
            />
            <div className="hidden sm:block">
              <span className="text-white font-serif text-base font-semibold tracking-wide leading-tight block">
                Carencro Golf
              </span>
              <span className="text-gold text-xs font-sans tracking-widest uppercase">
                Association
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map(({ to, label, highlight }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-3 py-2 text-sm font-sans font-medium rounded transition-colors duration-150 inline-flex items-center gap-1.5 ${
                    isActive
                      ? 'text-gold bg-white/12 ring-1 ring-gold/40'
                      : highlight
                        ? 'text-gold/80 hover:text-gold hover:bg-white/5'
                        : 'text-white/90 hover:text-gold hover:bg-white/5'
                  }`
                }
              >
                <span className={`w-1.5 h-1.5 rounded-full ${highlight ? 'bg-gold/60' : 'bg-white/50'}`} />
                {label}
              </NavLink>
            ))}
            {user ? (
              <button
                type="button"
                onClick={signOut}
                className="ml-2 px-3 py-2 text-xs font-semibold rounded border border-gold/40 text-gold hover:bg-white/10"
              >
                Sign out
              </button>
            ) : (
              <NavLink to="/login" className="ml-2 px-3 py-2 text-xs font-semibold rounded border border-white/30 text-white hover:bg-white/10">
                Login
              </NavLink>
            )}
          </nav>

          <button
            className="lg:hidden text-white p-2 rounded focus:outline-none focus:ring-2 focus:ring-gold"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="lg:hidden bg-forest-dark border-t border-forest-light/30">
          <nav className="px-4 py-3 flex flex-col gap-1">
            {navLinks.map(({ to, label, highlight }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-4 py-3 text-sm font-sans font-medium rounded border ${
                    isActive
                      ? 'text-gold bg-forest border-gold/40'
                      : highlight
                        ? 'text-gold/80 border-transparent hover:text-gold hover:bg-forest'
                        : 'text-white/80 border-transparent hover:text-gold hover:bg-forest'
                  }`
                }
              >
                {({ isActive }) => (
                  <span className="inline-flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-gold' : highlight ? 'bg-gold/60' : 'bg-white/60'}`} />
                    {label}
                  </span>
                )}
              </NavLink>
            ))}
            {user ? (
              <button
                type="button"
                onClick={() => {
                  signOut()
                  setMenuOpen(false)
                }}
                className="text-left px-4 py-3 text-sm font-medium rounded border border-gold/40 text-gold"
              >
                Sign out
              </button>
            ) : (
              <NavLink to="/login" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm font-medium rounded border border-white/30 text-white/80">
                Login
              </NavLink>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
