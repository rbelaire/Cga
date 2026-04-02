import { useState, useEffect, useMemo } from 'react'
import PageWrapper from '../components/layout/PageWrapper'
import StandingsTable from '../components/ui/StandingsTable'
import { useFireData } from '../hooks/useFireData'
import { DB } from '../db'

const FLIGHTS = ['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight']

const hdcpColumns = [
  { key: 'rank',        label: 'Rank',         sortable: false },
  { key: 'name',        label: 'Player',        sortable: true  },
  { key: 'poy',         label: 'HDCP',          sortable: true,  tooltip: 'Handicap Player of the Year points. Top finishers per flight earn points each tournament (base 350, −25 per position).' },
  { key: 'ptm',         label: 'PTM',           sortable: true,  tooltip: 'Points to Make — your handicap target score calculated from your last 7 rounds.' },
  { key: 'ptmDelta',    label: 'PTM Δ',         sortable: true,  tooltip: 'Change in PTM from the Koasati tournament to current PTM. ▼ green = improved (lower target). ▲ red = higher target.' },
  { key: 'latestScore', label: 'Latest Score',  sortable: true,  tooltip: 'Your Stableford score at the most recent tournament.' },
  { key: 'events',      label: 'Events',        sortable: true,  tooltip: 'Number of tournaments played this season.' },
  { key: 'trend',       label: '',              sortable: false  },
]

const scratchColumns = [
  { key: 'rank',       label: 'Rank',        sortable: false },
  { key: 'name',       label: 'Player',       sortable: true  },
  { key: 'scratchPts', label: 'Scratch Pts', sortable: true,  tooltip: 'Total Stableford points scored across all completed tournaments.' },
  { key: 'events',     label: 'Events',       sortable: true,  tooltip: 'Number of tournaments played this season.' },
]

function computeScratch(allResults) {
  const totals = {}
  for (const tid of Object.keys(allResults)) {
    const result = allResults[tid]
    if (!result?.leaderboard) continue
    for (const flight of Object.keys(result.leaderboard)) {
      for (const player of result.leaderboard[flight]) {
        if (!player.name || typeof player.points !== 'number') continue
        if (!totals[player.name]) totals[player.name] = { name: player.name, scratchPts: 0, events: 0 }
        totals[player.name].scratchPts += player.points
        totals[player.name].events += 1
      }
    }
  }
  return Object.values(totals)
    .sort((a, b) => b.scratchPts - a.scratchPts)
    .map((p, i) => ({ ...p, rank: i + 1 }))
}

export default function Standings() {
  useEffect(() => { document.title = 'Standings | CGA 2026' }, [])
  const [mode, setMode] = useState('hdcp')
  const [tab, setTab] = useState(0)

  const { data: standings } = useFireData(DB.listenStandings, { flights: {} })
  const { data: ptmList } = useFireData(DB.listenPtm, [])
  const { data: allResults } = useFireData(DB.listenResults, {})

  const roundsFromPtm = useMemo(() => {
    const lookup = {}
    for (const player of ptmList || []) {
      if (player.name && typeof player.rounds === 'number') {
        lookup[player.name] = player.rounds
      }
    }
    return lookup
  }, [ptmList])

  const koasatiPtmLookup = useMemo(() => {
    const lookup = {}
    for (const player of ptmList || []) {
      if (player.name && typeof player.ptmAtFlowControl === 'number') {
        lookup[player.name] = player.ptmAtFlowControl
      }
    }
    return lookup
  }, [ptmList])

  const currentFlight = FLIGHTS[tab]
  const flightData = useMemo(
    () => (standings?.flights?.[currentFlight] || []).map(row => {
      const rounds = roundsFromPtm[row.name]
      const baselinePtm = koasatiPtmLookup[row.name]
      const ptmDelta =
        typeof row.ptm === 'number' && typeof baselinePtm === 'number'
          ? +(row.ptm - baselinePtm).toFixed(2)
          : null

      const nextRow = ptmDelta == null ? row : { ...row, ptmDelta }
      return rounds != null ? { ...nextRow, rounds } : nextRow
    }),
    [standings, currentFlight, roundsFromPtm, koasatiPtmLookup]
  )

  const scratchData = useMemo(() => computeScratch(allResults ?? {}), [allResults])

  const latestTournament = flightData.find(p => p.latestTournament)?.latestTournament ?? null

  return (
    <PageWrapper>
      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">2026 Season Standings</h1>
        <div className="gold-divider" />
        <p className="text-gray-600 font-sans text-sm">
          {mode === 'hdcp' ? (
            <>
              Ranked by Handicap POY points. Click column headers to sort.
              {latestTournament && (
                <span className="ml-1">Latest score from <span className="font-medium text-forest">{latestTournament}</span>.</span>
              )}
            </>
          ) : (
            'Ranked by total Stableford points across all completed tournaments.'
          )}
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('hdcp')}
          className={`px-5 py-2 text-sm font-sans font-semibold rounded-lg transition-colors ${
            mode === 'hdcp' ? 'bg-forest text-white' : 'bg-white text-gray-500 border border-gray-200 hover:text-forest hover:border-forest'
          }`}
        >
          HDCP Rankings
        </button>
        <button
          onClick={() => setMode('scratch')}
          className={`px-5 py-2 text-sm font-sans font-semibold rounded-lg transition-colors ${
            mode === 'scratch' ? 'bg-forest text-white' : 'bg-white text-gray-500 border border-gray-200 hover:text-forest hover:border-forest'
          }`}
        >
          Scratch Rankings
        </button>
      </div>

      {mode === 'hdcp' ? (
        <>
          <div className="flex flex-wrap gap-2 mb-6">
            {FLIGHTS.map((label, i) => {
              const count = (standings?.flights?.[label] || []).length
              return (
                <button
                  key={label}
                  onClick={() => setTab(i)}
                  className={`px-4 py-2 text-sm font-sans font-medium rounded-lg transition-colors ${
                    tab === i
                      ? 'bg-gold text-forest'
                      : 'bg-white text-gray-500 border border-gray-200 hover:text-forest hover:border-gold'
                  }`}
                >
                  {label}
                  <span className="ml-1.5 text-xs opacity-70">({count})</span>
                </button>
              )
            })}
          </div>
          <div key={tab} className="animate-tab-in">
            <StandingsTable data={flightData} columns={hdcpColumns} highlightTop={3} />
          </div>
        </>
      ) : (
        <div className="animate-tab-in">
          <StandingsTable data={scratchData} columns={scratchColumns} highlightTop={3} showBubble={false} />
        </div>
      )}
    </PageWrapper>
  )
}
