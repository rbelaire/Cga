import { useState, useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'

const navLinks = [
  { to: '/schedule', label: 'Schedule' },
  { to: '/results', label: 'Results' },
  { to: '/standings', label: 'Standings' },
  { to: '/poy', label: 'POY' },
  { to: '/members', label: 'Members' },
  { to: '/rules', label: 'Rules' },
  { to: '/board', label: 'Board' },
  { to: '/sponsors', label: 'Sponsors' },
]

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

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
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3" onClick={() => setMenuOpen(false)}>
            <img
              src={`${import.meta.env.BASE_URL}cga-logo.jpg`}
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

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-3 py-2 text-sm font-sans font-medium rounded transition-colors duration-150 ${
                    isActive
                      ? 'text-gold border-b-2 border-gold'
                      : 'text-white/90 hover:text-gold'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Mobile hamburger */}
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

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden bg-forest-dark border-t border-forest-light/30">
          <nav className="px-4 py-3 flex flex-col gap-1">
            {navLinks.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-4 py-3 text-sm font-sans font-medium rounded ${
                    isActive
                      ? 'text-gold bg-forest'
                      : 'text-white/80 hover:text-gold hover:bg-forest'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}
