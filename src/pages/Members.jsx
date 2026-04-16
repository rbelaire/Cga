import { useState, useEffect, useMemo } from 'react'
import PageWrapper from '../components/layout/PageWrapper'
import MemberCard from '../components/ui/MemberCard'
import SearchBar from '../components/ui/SearchBar'
import { compareByLastName } from '../utils/formatName'
import { useFireData } from '../hooks/useFireData'
import { DB } from '../db'
import { FLIGHT_ORDER } from '../utils/flightOrder'

const FLIGHTS = FLIGHT_ORDER

export default function Members() {
  useEffect(() => { document.title = 'Members | CGA 2026' }, [])
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

  const allSorted = useMemo(
    () => [...enrichedMembers].sort(compareByLastName),
    [enrichedMembers]
  )

  const filtered = useMemo(
    () => query
      ? allSorted.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
      : allSorted,
    [allSorted, query]
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

      <p className="text-gray-500 font-sans text-sm mb-4">
        {filtered.length} {filtered.length === 1 ? 'member' : 'members'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((m) => (
          <MemberCard key={m.name} member={m} />
        ))}
      </div>
      {filtered.length === 0 && query && (
        <div className="text-center py-16">
          <p className="text-gray-500 font-sans text-sm">No members match "{query}".</p>
          <p className="text-gray-400 font-sans text-xs mt-1">Check your spelling.</p>
        </div>
      )}
    </PageWrapper>
  )
}
