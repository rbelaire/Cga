import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import TournamentCard from '../components/ui/TournamentCard'
import StandingsTable from '../components/ui/StandingsTable'
import schedule from '../data/schedule.json'
import { formatDateLong } from '../utils/formatDate'
import { useFireData } from '../hooks/useFireData'
import { DB } from '../db'
import { buildFlightWinnerCards } from '../utils/flightWinners'
import { useAuth } from '../context/AuthContext'
import {
  listenFavorites,
  listenSavedFilter,
  listenSavedView,
  removeFavorite,
  saveSavedFilter,
  saveSavedView,
  setFavorite,
} from '../lib/firebase/firestore'

function FlightLeaderboards({ leaderboard }) {
  const [flight, setFlight] = useState(Object.keys(leaderboard)[0])
  const flights = Object.keys(leaderboard)

  const scoreColumns = [
    { key: 'rank', label: 'Rank', sortable: false },
    { key: 'name', label: 'Player', sortable: true },
    { key: 'poy', label: 'POY', sortable: true, tooltip: 'Player of the Year points earned at this tournament.' },
    { key: 'points', label: 'Score', sortable: true, tooltip: 'Stableford score posted at this tournament.' },
    { key: 'ptm', label: 'PTM', sortable: true, tooltip: 'Points to Make — handicap target for this tournament.' },
    { key: 'plusMinus', label: '+/−', sortable: true, tooltip: 'Score minus PTM. Positive = above target (better).' },
  ]

  return (
    <div>
      <h4 className="text-gold text-xs font-sans font-semibold uppercase tracking-widest mb-3">
        Full Leaderboard
      </h4>
      <div className="mb-4 -mx-1 px-1 overflow-x-auto">
        <div className="flex gap-2 w-max min-w-full whitespace-nowrap">
          {flights.map((f) => (
            <button
              key={f}
              onClick={() => setFlight(f)}
              className={`px-3 py-1.5 text-xs font-sans font-medium rounded transition-colors ${
                flight === f
                  ? 'bg-gold text-forest'
                  : 'bg-white text-gray-500 border border-gray-200 hover:text-forest hover:border-gold'
              }`}
            >
              {f}
              <span className="ml-1 opacity-60">({(leaderboard[f] || []).length})</span>
            </button>
          ))}
        </div>
      </div>
      <div key={flight} className="animate-tab-in">
        <StandingsTable data={leaderboard[flight]} columns={scoreColumns} highlightTop={3} />
      </div>
    </div>
  )
}

export default function Tournaments() {
  useEffect(() => { document.title = 'Tournaments | CGA 2026' }, [])

  const { state } = useLocation()
  const { user } = useAuth()

  const [seasonView, setSeasonView] = useState('all')
  const [favoriteIds, setFavoriteIds] = useState(new Set())

  const upcoming = schedule.filter((t) => t.status === 'upcoming')
  const completed = schedule.filter((t) => t.status === 'completed')
  const pct = Math.round((completed.length / schedule.length) * 100)

  const [expanded, setExpanded] = useState(state?.expand ?? completed[0]?.id ?? null)
  const { data: allResults, status: resultsStatus } = useFireData(DB.listenResults, {})

  useEffect(() => {
    if (!user?.uid) return undefined
    return listenSavedFilter(user.uid, 'tournaments', (doc) => {
      if (doc?.filters?.seasonView) {
        setSeasonView(doc.filters.seasonView)
      }
    })
  }, [user?.uid])

  useEffect(() => {
    if (!user?.uid) return undefined
    return listenSavedView(user.uid, 'tournaments', (doc) => {
      if (doc?.settings?.expandedTournament) {
        setExpanded(doc.settings.expandedTournament)
      }
    })
  }, [user?.uid])

  useEffect(() => {
    if (!user?.uid) return undefined

    return listenFavorites(user.uid, 'tournament', (docs) => {
      setFavoriteIds(new Set(docs.map((d) => d.entityId)))
    })
  }, [user?.uid])

  const saveFilterPreference = async (nextView) => {
    setSeasonView(nextView)
    if (user?.uid) {
      await saveSavedFilter(user.uid, 'tournaments', { seasonView: nextView })
    }
  }

  const toggleFavorite = async (tournament) => {
    if (!user?.uid) return

    if (favoriteIds.has(tournament.id)) {
      await removeFavorite(user.uid, 'tournament', tournament.id)
      return
    }

    await setFavorite(user.uid, 'tournament', tournament.id, tournament.name)
  }

  const onToggleExpanded = async (tournamentId, isOpen) => {
    const nextExpanded = isOpen ? null : tournamentId
    setExpanded(nextExpanded)

    if (user?.uid && nextExpanded) {
      await saveSavedView(user.uid, 'tournaments', { expandedTournament: nextExpanded })
    }
  }

  const showUpcoming = seasonView === 'all' || seasonView === 'upcoming'
  const showCompleted = seasonView === 'all' || seasonView === 'completed'

  return (
    <PageWrapper>
      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">2026 Tournaments</h1>
        <div className="gold-divider" />
        <p className="text-gray-600 font-sans text-sm max-w-xl">
          {schedule.length} tournaments scheduled for the 2026 season. Entry fee is paid at the course on the day of play.
        </p>
      </div>

      <div className="mb-8 bg-white border border-gray-200 rounded-lg px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-sans font-medium text-darktext">Season Progress</span>
          <span className="stat-number text-sm text-gray-500">
            {completed.length} of {schedule.length} completed
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-forest rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 items-center">
        {['all', 'upcoming', 'completed'].map((view) => (
          <button
            key={view}
            onClick={() => saveFilterPreference(view)}
            className={`px-3 py-1.5 text-xs rounded-full border ${seasonView === view ? 'bg-forest text-white border-forest' : 'bg-white text-gray-600 border-gray-200'}`}
          >
            {view[0].toUpperCase() + view.slice(1)}
          </button>
        ))}
        <span className="text-xs text-gray-400">{user ? 'Filter saved to your account' : 'Sign in to save filter preference'}</span>
      </div>

      {showUpcoming && upcoming.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-sans font-semibold text-forest uppercase tracking-widest mb-4">Upcoming</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcoming.map((t) => (
              <div key={t.id} className="relative">
                {user && (
                  <button
                    type="button"
                    onClick={() => toggleFavorite(t)}
                    className="absolute right-3 top-3 z-10 text-sm px-2 py-1 rounded bg-white/90 border border-gray-200"
                    aria-label={`Favorite ${t.name}`}
                  >
                    {favoriteIds.has(t.id) ? '★' : '☆'}
                  </button>
                )}
                <TournamentCard tournament={t} />
              </div>
            ))}
          </div>
        </div>
      )}

      {showCompleted && completed.length > 0 && (
        <div>
          <h2 className="text-lg font-sans font-semibold text-forest uppercase tracking-widest mb-4">Completed</h2>
          <div className="space-y-4">
            {completed.map((t) => {
              const result = allResults[t.id]
              const isOpen = expanded === t.id
              return (
                <div key={t.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    className="w-full text-left p-5 flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors"
                    onClick={() => onToggleExpanded(t.id, isOpen)}
                    aria-expanded={isOpen}
                  >
                    <div>
                      <h3 className="text-darktext font-serif text-xl font-semibold mb-1">{t.name} {favoriteIds.has(t.id) && <span title="Favorite">★</span>}</h3>
                      <p className="text-gray-500 font-sans text-sm">{formatDateLong(t.date)} · {t.course}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {user && (
                        <span className="text-xs text-gray-500 hidden sm:block">{favoriteIds.has(t.id) ? 'Favorited' : 'Not favorited'}</span>
                      )}
                      <span className="text-xs bg-gray-100 text-gray-600 border border-gray-200 px-2.5 py-1 rounded-full font-sans hidden sm:block">
                        {t.format}
                      </span>
                      <svg className={`w-5 h-5 text-gold transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {isOpen && !result && resultsStatus === 'loading' && (
                    <div className="border-t border-gray-100 p-5 text-center py-10">
                      <p className="text-gray-400 font-sans text-sm">Loading results…</p>
                    </div>
                  )}

                  {isOpen && result && (
                    <div className="border-t border-gray-100 p-5">
                      <h4 className="text-forest text-xs font-sans font-semibold uppercase tracking-widest mb-3">Flight Winners</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                        {buildFlightWinnerCards(result, t.format).map((fw) => (
                          <div key={fw.flight} className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5">
                            <p className="text-forest text-xs font-sans font-semibold uppercase tracking-wide mb-0.5">{fw.flight}</p>
                            <div className="space-y-1">
                              {fw.players.map((player) => (
                                <div key={`${fw.flight}-${player.name}`} className="leading-tight">
                                  <p className="text-darktext font-sans text-sm">{player.name}</p>
                                  {player.pending ? (
                                    <p className="text-gray-500 text-xs font-sans">Results pending</p>
                                  ) : (
                                    <>
                                      <p className="text-darktext font-sans text-lg font-bold">{player.score}</p>
                                      {player.relative && <p className="text-gray-500 text-xs font-sans">{player.relative}</p>}
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <FlightLeaderboards leaderboard={result.leaderboard} />
                    </div>
                  )}

                  {isOpen && !result && resultsStatus !== 'loading' && (
                    <div className="border-t border-gray-100 p-5 text-center py-8">
                      <p className="text-gray-400 font-sans text-sm">Results not yet available.</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </PageWrapper>
  )
}
