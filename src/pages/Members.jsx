import { useState, useEffect } from 'react'
import PageWrapper from '../components/layout/PageWrapper'
import MemberCard from '../components/ui/MemberCard'
import SearchBar from '../components/ui/SearchBar'
import members from '../data/members.json'
import ptmData from '../data/ptm.json'

const FLIGHTS = ['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight']
const TABS = ['All', ...FLIGHTS]

// Build a name → rounds lookup from ptm.json (covers full history, not just current season)
const roundsFromPtm = {}
for (const player of ptmData) {
  if (player.name && typeof player.rounds === 'number') {
    roundsFromPtm[player.name] = player.rounds
  }
}

function withRounds(m) {
  const rounds = roundsFromPtm[m.name] ?? null
  return rounds !== null ? { ...m, rounds } : m
}

const enrichedMembers = members.map(withRounds)

const byFlight = Object.fromEntries(
  FLIGHTS.map((flight) => {
    const players = enrichedMembers
      .filter((m) => m.flight === flight)
      .sort((a, b) => (b.ptm ?? -1) - (a.ptm ?? -1))
    return [flight, players]
  })
)

const unassigned = enrichedMembers
  .filter((m) => !m.flight)
  .sort((a, b) => a.name.localeCompare(b.name))

export default function Members() {
  useEffect(() => { document.title = 'Members | CGA 2026' }, [])
  const [tab, setTab] = useState('All')
  const [query, setQuery] = useState('')

  function switchTab(label) {
    setTab(label)
    setQuery('')
  }

  const baseList =
    tab === 'All'
      ? [...enrichedMembers].sort((a, b) => a.name.localeCompare(b.name))
      : byFlight[tab] ?? []

  const filtered = query
    ? baseList.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
    : baseList

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
                ({(byFlight[label] ?? []).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <p className="text-gray-500 font-sans text-sm mb-4">
        {filtered.length} {filtered.length === 1 ? 'member' : 'members'}{tab !== 'All' ? ` · sorted by PTM` : ''}
      </p>

      {tab === 'All' && !query ? (
        <div className="space-y-8">
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
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((m) => (
              <MemberCard key={m.name} member={m} />
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="text-center text-gray-500 font-sans py-16">No members match your search.</p>
          )}
        </>
      )}
    </PageWrapper>
  )
}
