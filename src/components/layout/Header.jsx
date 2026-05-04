import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const navLinks = [
  { to: '/tournaments', label: 'Schedule' },
  { to: '/standings', label: 'Standings' },
  { to: '/members', label: 'Members' },
  { to: '/info', label: 'Info' },
  { to: '/admin', label: 'Admin' },
]

const linkBase = 'px-3 py-2 text-sm font-semibold text-forest-dark border-b-2 border-transparent hover:border-gold hover:text-forest transition-colors'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, signOut } = useAuth()

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#E5E0D4]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 text-forest-dark" onClick={() => setMenuOpen(false)}>
            <img src={`${import.meta.env.BASE_URL}cga.svg`} alt="Carencro Golf Association" className="h-9 w-auto" onError={(event) => {event.currentTarget.style.display = 'none'}}/>
            <span className="hidden sm:inline text-xs tracking-[0.18em] uppercase text-gold">Carencro Golf Association</span>
          </Link>
          
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `${linkBase} ${isActive ? 'border-gold text-forest font-bold' : ''}`}
              >
                {label}
              </NavLink>
            ))}
            {user ? (
              <button type="button" onClick={signOut} className="ml-3 px-4 py-2 text-sm font-semibold text-forest border border-[#E5E0D4] rounded-md hover:bg-[#F6F4EF]">
                Sign out
              </button>
            ) : (
              <NavLink to="/login" className="ml-3 px-4 py-2 text-sm font-semibold text-white bg-forest rounded-md hover:bg-forest-dark">
                Login
              </NavLink>
            )}
          </nav>

          <button
            className="lg:hidden text-forest-dark p-2 rounded-md border border-[#E5E0D4]"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="lg:hidden bg-white border-t border-[#E5E0D4]">
          <nav className="px-4 py-3 flex flex-col">
            {navLinks.map(({ to, label }) => (
              <NavLink key={to} to={to} onClick={() => setMenuOpen(false)} className={({ isActive }) => `block px-2 py-3 text-base font-semibold border-b border-[#E5E0D4] ${isActive ? 'text-forest border-l-2 border-l-gold pl-3' : 'text-charcoal'}`}>
                {label}
              </NavLink>
            ))}
            {user ? (
              <button type="button" onClick={() => { signOut(); setMenuOpen(false) }} className="text-left px-2 py-3 mt-1 text-base font-semibold text-forest">
                Sign out
              </button>
            ) : (
              <NavLink to="/login" onClick={() => setMenuOpen(false)} className="block px-2 py-3 mt-1 text-base font-semibold text-forest">
                Login
              </NavLink>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
