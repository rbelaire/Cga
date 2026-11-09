import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Home from './pages/Home'
import Tournaments from './pages/Tournaments'
import Standings from './pages/Standings'
import Members from './pages/Members'
import Info from './pages/Info'
import Pairings from './pages/Pairings'
import Sponsors from './pages/Sponsors'
import TournamentDetail from './pages/TournamentDetail'
import Login from './pages/Login'
import NotFound from './pages/NotFound'

const AdminApp = lazy(() => import('./admin/AdminApp'))

function Shell() {
  const location = useLocation()
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <ErrorBoundary resetKey={`${location.pathname}${location.search}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tournaments" element={<Tournaments />} />
          <Route path="/tournaments/:tournamentId" element={<TournamentDetail />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/members" element={<Members />} />
          <Route path="/info" element={<Info />} />
          <Route path="/sponsors" element={<Sponsors />} />
          <Route path="/pairings/:tournamentId" element={<Pairings />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin/*" element={
            <ProtectedRoute>
              <Suspense fallback={<div className="flex-1 flex items-center justify-center py-24 text-sm text-gray-500">Loading admin…</div>}>
                <AdminApp />
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/schedule" element={<Navigate to="/tournaments" replace />} />
          <Route path="/results" element={<Navigate to="/tournaments" replace />} />
          <Route path="/points-to-make" element={<Navigate to="/standings" replace />} />
          <Route path="/poy" element={<Navigate to="/standings" replace />} />
          <Route path="/most-improved" element={<Navigate to="/standings" replace />} />
          <Route path="/rules" element={<Navigate to="/info" replace />} />
          <Route path="/board" element={<Navigate to="/info" replace />} />
          <Route path="/eligibility" element={<Navigate to="/info" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}
