import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'
import Home from './pages/Home'
import Tournaments from './pages/Tournaments'
import Standings from './pages/Standings'
import Members from './pages/Members'
import Info from './pages/Info'
import Pairings from './pages/Pairings'
import Sponsors from './pages/Sponsors'
import TournamentDetail from './pages/TournamentDetail'
import Login from './pages/Login'
import ProtectedRoute from './components/auth/ProtectedRoute'

// Admin is lazy-loaded so its heavy dependencies (jsPDF, XLSX) are excluded
// from the main bundle and only fetched when a user navigates to /admin.
const Admin = lazy(() => import('./pages/Admin'))

function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24">
      <p className="text-gold font-mono text-5xl font-bold mb-4">404</p>
      <h1 className="text-darktext font-serif text-2xl font-bold mb-2">Page not found</h1>
      <p className="text-gray-500 font-sans text-sm mb-6">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn-primary">Back to Home</Link>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <div className="flex flex-col min-h-screen">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tournaments" element={<Tournaments />} />
          <Route path="/tournaments/:tournamentId" element={<TournamentDetail />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/members" element={<Members />} />
          <Route path="/info" element={<Info />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={
            <ProtectedRoute>
              <Suspense fallback={<div className="flex-1 flex items-center justify-center py-24"><span className="text-gray-400 font-sans text-sm">Loading admin…</span></div>}>
                <Admin />
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/pairings/:tournamentId" element={<Pairings />} />
          <Route path="/sponsors" element={<Sponsors />} />
          {/* Legacy redirects */}
          <Route path="/schedule" element={<Navigate to="/tournaments" replace />} />
          <Route path="/results" element={<Navigate to="/tournaments" replace />} />
          <Route path="/points-to-make" element={<Navigate to="/standings" replace />} />
          <Route path="/poy" element={<Navigate to="/standings" replace />} />
          <Route path="/rules" element={<Navigate to="/info" replace />} />
          <Route path="/board" element={<Navigate to="/info" replace />} />
          <Route path="/eligibility" element={<Navigate to="/info" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Footer />
      </div>
    </HashRouter>
  )
}
