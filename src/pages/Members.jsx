import { useState, useEffect, useMemo } from 'react'
import PageWrapper from '../components/layout/PageWrapper'
import MemberCard from '../components/ui/MemberCard'
import SearchBar from '../components/ui/SearchBar'
import { compareByLastName } from '../utils/formatName'
import { useFireData } from '../hooks/useFireData'
import { DB } from '../db'

const FLIGHTS = ['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight']
const TABS = ['All', ...FLIGHTS, 'New Players']

export default function Members() {
  useEffect(() => { document.title = 'Members | CGA 2026' }, [])
  const [tab, setTab] = useState('All')
  const [query, setQuery] = useState('')

  // Live member roster from Firestore
  const { data: liveMembers } = useFireData(DB.listenMembers, [])

  // Build events lookup from live standings
  const { data: standings } = useFireData(DB.listenStandings, { flights: {} })
  const { data: ptmList } = useFireData(DB.listenPtm, [])
  const eventsFromStandings = useMemo(() => {
    const lookup = {}
    for (const flight of FLIGHTS) {
      for (const player of standings.flights?.[flight] ?? []) {
        if (player.name && typeof player.events === 'number') {
          lookup[player.name] = player.events
        }
      }
    }
    return lookup
  }, [standings])

  const roundsFromPtm = useMemo(() => {
    const lookup = {}
    for (const player of ptmList ?? []) {
      if (!player?.name) continue
      if (typeof player.rounds === 'number') {
        lookup[player.name] = player.rounds
        continue
      }
      if (Array.isArray(player.history)) {
        lookup[player.name] = player.history.filter(v => typeof v === 'number').length
      }
    }
    return lookup
  }, [ptmList])

  const enrichedMembers = useMemo(
    () => (liveMembers ?? []).map((m) => {
      const events = m.events ?? eventsFromStandings[m.name] ?? null
      const rounds = typeof m.rounds === 'number'
        ? m.rounds
        : Array.isArray(m.history)
          ? m.history.filter(v => typeof v === 'number').length
          : roundsFromPtm[m.name] ?? null

      if (events === null && rounds === null) return m
      return { ...m, ...(events !== null ? { events } : {}), ...(rounds !== null ? { rounds } : {}) }
    }),
    [liveMembers, eventsFromStandings, roundsFromPtm]
  )

  const byFlight = useMemo(() =>
    Object.fromEntries(
      FLIGHTS.map((flight) => {
        const players = enrichedMembers
          .filter((m) => m.flight === flight)
          .sort(compareByLastName)
        return [flight, players]
      })
    ),
    [enrichedMembers]
  )

  const unassigned = useMemo(
    () => enrichedMembers.filter((m) => !m.flight).sort(compareByLastName),
    [enrichedMembers]
  )

  const newPlayers = useMemo(
    () => enrichedMembers.filter((m) => m.memberSince === 2026).sort(compareByLastName),
    [enrichedMembers]
  )

  function switchTab(label) {
    setTab(label)
    setQuery('')
  }

  const baseList = useMemo(() => {
    if (tab === 'All') return [...enrichedMembers].sort(compareByLastName)
    if (tab === 'New Players') return newPlayers
    return byFlight[tab] ?? []
  }, [tab, enrichedMembers, byFlight, newPlayers])

  const filtered = useMemo(
    () => query
      ? baseList.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
      : baseList,
    [baseList, query]
  )

  return (
    <PageWrapper>
      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">Member Directory</h1>
        <div className="gold-divider" />
      </div>

      <div className="max-w-sm mb-6">
        <SearchBar value={query} onChange={setQuery} placeholder="Search members…" />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((label) => (
          <button
            key={label}
            onClick={() => switchTab(label)}
            className={`px-4 py-2 text-sm font-sans font-medium rounded-lg transition-colors ${
              tab === label
                ? 'bg-gold text-forest'
                : 'bg-white text-gray-500 border border-gray-200 hover:text-forest hover:border-gold'
            }`}
          >
            {label}
            {label !== 'All' && (
              <span className="ml-1.5 text-xs opacity-70">
                ({label === 'New Players' ? newPlayers.length : (byFlight[label] ?? []).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <p className="text-gray-500 font-sans text-sm mb-4">
        {filtered.length} {filtered.length === 1 ? 'member' : 'members'}{tab !== 'All' ? ` · sorted by PTM` : ''}
      </p>

      {tab === 'All' && !query ? (
        <div key="all" className="animate-tab-in space-y-8">
          {FLIGHTS.map((flight) => {
            const players = byFlight[flight] ?? []
            if (players.length === 0) return null
            return (
              <div key={flight}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="font-sans font-semibold text-forest text-sm uppercase tracking-widest">
                    {flight}
                  </h2>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 font-sans">{players.length} members</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {players.map((m) => (
                    <MemberCard key={m.name} member={m} />
                  ))}
                </div>
              </div>
            )
          })}
          {newPlayers.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="font-sans font-semibold text-gold text-sm uppercase tracking-widest">
                  New Players
                </h2>
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-sans">{newPlayers.length} members</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {newPlayers.map((m) => (
                  <MemberCard key={m.name} member={m} />
                ))}
              </div>
            </div>
          )}
          {unassigned.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="font-sans font-semibold text-gray-400 text-sm uppercase tracking-widest">
                  Unassigned
                </h2>
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-sans">{unassigned.length} members</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {unassigned.map((m) => (
                  <MemberCard key={m.name} member={m} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div key={tab + query} className="animate-tab-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((m) => (
              <MemberCard key={m.name} member={m} />
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-500 font-sans text-sm">No members match "{query}".</p>
              <p className="text-gray-400 font-sans text-xs mt-1">
                Try a different name or{tab !== 'All' ? ' switch to the All tab to search across all flights.' : ' check your spelling.'}
              </p>
            </div>
          )}
        </div>
      )}
    </PageWrapper>
  )
}
