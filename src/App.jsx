import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'
import Home from './pages/Home'
import Schedule from './pages/Schedule'
import Results from './pages/Results'
import Standings from './pages/Standings'
import PlayerOfTheYear from './pages/PlayerOfTheYear'
import Members from './pages/Members'
import Eligibility from './pages/Eligibility'
import Board from './pages/Board'
import Sponsors from './pages/Sponsors'

function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24">
      <p className="text-gold font-mono text-5xl font-bold mb-4">404</p>
      <h1 className="text-darktext font-serif text-2xl font-bold mb-2">Page not found</h1>
      <p className="text-gray-500 font-sans text-sm mb-6">The page you're looking for doesn't exist.</p>
      <a href="/" className="btn-primary">Back to Home</a>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/results" element={<Results />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/poy" element={<PlayerOfTheYear />} />
          <Route path="/members" element={<Members />} />
          <Route path="/eligibility" element={<Eligibility />} />
          <Route path="/board" element={<Board />} />
          <Route path="/sponsors" element={<Sponsors />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Footer />
      </div>
    </BrowserRouter>
  )
}
