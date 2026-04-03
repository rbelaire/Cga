import { HashRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'
import Home from './pages/Home'
import Schedule from './pages/Schedule'
import Results from './pages/Results'
import PointsToMake from './pages/PointsToMake'
import Standings from './pages/Standings'
import Members from './pages/Members'
import Eligibility from './pages/Eligibility'
import Board from './pages/Board'
import Sponsors from './pages/Sponsors'
import Rules from './pages/Rules'
import Admin from './pages/Admin'
import Pairings from './pages/Pairings'

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
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/results" element={<Results />} />
          <Route path="/points-to-make" element={<PointsToMake />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/poy" element={<Navigate to="/standings" replace />} />
          <Route path="/members" element={<Members />} />
          <Route path="/eligibility" element={<Eligibility />} />
          <Route path="/board" element={<Board />} />
          <Route path="/sponsors" element={<Sponsors />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/pairings/:tournamentId" element={<Pairings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Footer />
      </div>
    </HashRouter>
  )
}
