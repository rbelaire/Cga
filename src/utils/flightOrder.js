export const FLIGHT_ORDER = ['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight']
export const NEW_PLAYERS_FLIGHT = 'New Players'

const FLIGHT_ORDER_LOOKUP = new Map(FLIGHT_ORDER.map((flight, index) => [flight, index]))

const FLIGHT_SYNONYMS = {
  championship: 'Championship',
  champ: 'Championship',
  '1st': '1st Flight',
  first: '1st Flight',
  '1': '1st Flight',
  '1st flight': '1st Flight',
  '2nd': '2nd Flight',
  second: '2nd Flight',
  '2': '2nd Flight',
  '2nd flight': '2nd Flight',
  '3rd': '3rd Flight',
  third: '3rd Flight',
  '3': '3rd Flight',
  '3rd flight': '3rd Flight',
  '4th': '4th Flight',
  fourth: '4th Flight',
  '4': '4th Flight',
  '4th flight': '4th Flight',
  '5th': '5th Flight',
  fifth: '5th Flight',
  '5': '5th Flight',
  '5th flight': '5th Flight',
  'new players': NEW_PLAYERS_FLIGHT,
  newcomers: NEW_PLAYERS_FLIGHT,
}

function canonicalizeFlightToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\bflight\b/g, ' flight')
    .replace(/\s+/g, ' ')
}

export function normalizeFlight(value) {
  if (!value) return null

  const directMatch = FLIGHT_ORDER.find(
    (flight) => flight.toLowerCase() === String(value).trim().toLowerCase(),
  )
  if (directMatch) return directMatch

  if (String(value).trim().toLowerCase() === NEW_PLAYERS_FLIGHT.toLowerCase()) {
    return NEW_PLAYERS_FLIGHT
  }

  const token = canonicalizeFlightToken(value)
  return FLIGHT_SYNONYMS[token] ?? null
}

export function getFlightOrderIndex(flight, { includeNewPlayers = true } = {}) {
  const normalized = normalizeFlight(flight)

  if (normalized === NEW_PLAYERS_FLIGHT) {
    return includeNewPlayers ? FLIGHT_ORDER.length : Number.MAX_SAFE_INTEGER - 1
  }

  if (normalized && FLIGHT_ORDER_LOOKUP.has(normalized)) {
    return FLIGHT_ORDER_LOOKUP.get(normalized)
  }

  return Number.MAX_SAFE_INTEGER
}

export function compareFlights(a, b, options) {
  return getFlightOrderIndex(a, options) - getFlightOrderIndex(b, options)
}

export function sortFlights(flights = [], options) {
  return [...flights].sort((a, b) => compareFlights(a, b, options))
}

export const SCORE_FLIGHTS = [...FLIGHT_ORDER, NEW_PLAYERS_FLIGHT]
