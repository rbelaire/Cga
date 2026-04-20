import { useState, useEffect, useRef } from 'react'
import { formatName } from '../../utils/formatName'
import { NEW_PLAYERS_FLIGHT } from '../../utils/flightOrder'

const BASE_FLIGHT_NAMES = ['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight']
const SCORED_FLIGHT_NAMES = BASE_FLIGHT_NAMES

function ordinalSuffix(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th'
  switch (n % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

function nextFlightName(extraFlights) {
  const n = 6 + extraFlights.length
  return `${n}${ordinalSuffix(n)} Flight`
}

function autoAssignFlights(players, extraFlights = []) {
  // Players with no PTM go directly to New Players
  const newPlayers = players.filter(p => !p.ptm)
  const scored = [...players.filter(p => p.ptm)].sort((a, b) => b.ptm - a.ptm)

  const scoredFlights = [...SCORED_FLIGHT_NAMES, ...extraFlights]
  const N = scored.length
  const numFlights = scoredFlights.length
  const perFlight = N < numFlights ? 1 : Math.min(14, Math.floor(N / numFlights))
  const allNames = [...BASE_FLIGHT_NAMES, ...extraFlights, NEW_PLAYERS_FLIGHT]
  const groups = Object.fromEntries(allNames.map(f => [f, []]))

  scored.forEach((player, i) => {
    const flightIdx = perFlight > 0 && i < perFlight * (numFlights - 1) ? Math.floor(i / perFlight) : numFlights - 1
    groups[scoredFlights[flightIdx]].push(player.name)
  })

  groups[NEW_PLAYERS_FLIGHT] = newPlayers.map(p => p.name)

  return groups
}

export function AdminFlightCalculatorPanel({
  enteredPlayers,
  flightTagStyles,
  onSaveFlights,
  saving,
  extraFlights = [],
  onAddExtraFlight,
}) {
  const [groups, setGroups] = useState(() => autoAssignFlights(enteredPlayers, extraFlights))
  const [dragSource, setDragSource] = useState(null)
  const [dragOverFlight, setDragOverFlight] = useState(null)
  const prevCountRef = useRef(enteredPlayers.length)

  // Recalculate automatically only if the entered player count changes
  useEffect(() => {
    if (enteredPlayers.length !== prevCountRef.current) {
      prevCountRef.current = enteredPlayers.length
      setGroups(autoAssignFlights(enteredPlayers, extraFlights))
    }
  }, [enteredPlayers]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleAddFlight() {
    const name = nextFlightName(extraFlights)
    onAddExtraFlight(name)
    setGroups(prev => ({ ...prev, [name]: [] }))
  }

  function handleDragStart(e, name, flight) {
    e.dataTransfer.effectAllowed = 'move'
    const payload = JSON.stringify({ name, flight })
    e.dataTransfer.setData('application/x-cga-flight-player', payload)
    e.dataTransfer.setData('text/plain', payload)
    setDragSource({ name, flight })
  }

  function handleDragEnd() {
    setDragSource(null)
    setDragOverFlight(null)
  }

  function handleDragOver(e, targetFlight) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverFlight(targetFlight)
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverFlight(null)
    }
  }

  function handleDrop(e, targetFlight) {
    e.preventDefault()
    let source
    try {
      const raw = e.dataTransfer.getData('application/x-cga-flight-player') || e.dataTransfer.getData('text/plain')
      source = JSON.parse(raw)
    } catch { return }
    if (!source?.name || source.flight === targetFlight) {
      setDragSource(null)
      setDragOverFlight(null)
      return
    }
    setGroups(prev => {
      const next = Object.fromEntries(Object.entries(prev).map(([f, ns]) => [f, [...ns]]))
      next[source.flight] = next[source.flight].filter(n => n !== source.name)
      next[targetFlight] = [...next[targetFlight], source.name]
      return next
    })
    setDragSource(null)
    setDragOverFlight(null)
  }

  const allFlightNames = [...BASE_FLIGHT_NAMES, ...extraFlights, NEW_PLAYERS_FLIGHT]
  const totalAssigned = Object.values(groups).reduce((s, arr) => s + arr.length, 0)

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold font-sans text-darktext">Flight Assignment</h3>
            <p className="text-xs font-sans text-gray-500 mt-0.5">
              {totalAssigned} entered {totalAssigned === 1 ? 'player' : 'players'} · drag between columns to adjust
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {onAddExtraFlight && (
              <button
                type="button"
                onClick={handleAddFlight}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans rounded border border-gray-200 text-gray-500 hover:text-forest hover:border-forest/40 transition-colors"
              >
                <span className="text-base leading-none">+</span> Add Flight
              </button>
            )}
            <button
              type="button"
              onClick={() => setGroups(autoAssignFlights(enteredPlayers, extraFlights))}
              className="px-3 py-1.5 text-xs font-sans rounded border border-gray-200 text-gray-500 hover:text-forest hover:border-forest/40 transition-colors"
            >
              Recalculate
            </button>
            <button
              type="button"
              onClick={() => onSaveFlights(groups)}
              disabled={saving || totalAssigned === 0}
              className="px-4 py-1.5 text-xs font-sans font-semibold rounded bg-forest text-white disabled:opacity-50 hover:bg-forest/90 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Flights & Continue to Pairings →'}
            </button>
          </div>
        </div>
      </div>

      {totalAssigned === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm font-sans text-amber-700">
          No entered players found for this tournament. Mark players as paid in <strong>Entries</strong> first.
        </div>
      )}

      {/* Flight columns */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {allFlightNames.map(flight => {
          const players = groups[flight] ?? []
          const count = players.length
          const isOver = dragOverFlight === flight
          const tagClass = flightTagStyles[flight] ?? flightTagStyles.Unassigned
          const countColor =
            count === 0 ? 'text-gray-300' :
            count < 10 ? 'text-amber-500' :
            count > 14 ? 'text-red-500' :
            'text-green-600'

          return (
            <div
              key={flight}
              onDragOver={e => handleDragOver(e, flight)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, flight)}
              className={`rounded-lg border-2 transition-colors ${
                isOver ? 'border-forest bg-forest/5' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="px-3 py-2 rounded-t-md border-b border-gray-100 flex items-center justify-between">
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full border ${tagClass}`}>
                  {flight}
                </span>
                <span className={`text-xs font-mono font-semibold ${countColor}`}>{count}</span>
              </div>
              <ul className="p-2 min-h-[140px] space-y-1">
                {players.map(name => {
                  const player = enteredPlayers.find(p => p.name === name)
                  return (
                    <li
                      key={name}
                      draggable
                      onDragStart={e => handleDragStart(e, name, flight)}
                      onDragEnd={handleDragEnd}
                      className={`px-2 py-1.5 rounded border cursor-grab active:cursor-grabbing text-xs font-sans select-none transition-colors ${
                        dragSource?.name === name
                          ? 'opacity-40 border-gray-200 bg-white'
                          : 'border-gray-200 bg-white hover:border-forest/40 hover:bg-forest/5'
                      }`}
                    >
                      <div className="font-medium text-darktext leading-tight">{formatName(name)}</div>
                      <div className="text-gray-400 font-mono text-[10px] mt-0.5">PTM {player?.ptm != null ? Math.round(player.ptm) : '—'}</div>
                    </li>
                  )
                })}
                {players.length === 0 && (
                  <li className="text-center text-xs text-gray-300 py-6 select-none pointer-events-none">
                    Drop here
                  </li>
                )}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
