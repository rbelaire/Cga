import { FLIGHT_ORDER, NEW_PLAYERS_FLIGHT } from '../utils/flightOrder.js'

export function autoAssignFlights(players = [], extraFlights = []) {
  const scoredFlights = [...FLIGHT_ORDER, ...extraFlights.filter(Boolean)]
  const groups = Object.fromEntries([...scoredFlights, NEW_PLAYERS_FLIGHT].map((flight) => [flight, []]))
  const newcomers = []
  const scored = []
  for (const player of players) {
    if (!player?.name) continue
    const ptm = Number(player.ptm)
    if (!Number.isFinite(ptm) || ptm <= 0) newcomers.push(player)
    else scored.push(player)
  }
  scored.sort((a, b) => Number(b.ptm) - Number(a.ptm) || a.name.localeCompare(b.name))
  const count = scored.length
  const flightCount = scoredFlights.length
  const perFlight = count < flightCount ? 1 : Math.min(14, Math.floor(count / flightCount))
  scored.forEach((player, index) => {
    const flightIndex = perFlight > 0 && index < perFlight * (flightCount - 1)
      ? Math.floor(index / perFlight)
      : flightCount - 1
    groups[scoredFlights[flightIndex]].push(player)
  })
  groups[NEW_PLAYERS_FLIGHT] = newcomers
  return groups
}
