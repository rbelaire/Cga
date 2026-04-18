import { formatText } from './formatters'

function sanitizeNumber(value, fallback = null) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function sanitizeArray(value) {
  return Array.isArray(value) ? value : []
}

function sanitizePlayer(player = {}) {
  return {
    name: formatText(player.name, 'Not available'),
    flight: formatText(player.flight, 'Unassigned'),
    tee: formatText(player.tee, '—'),
    ptm: sanitizeNumber(player.ptm, null),
    score: sanitizeNumber(player.score, null),
    plusMinus: sanitizeNumber(player.plusMinus, null),
    rank: sanitizeNumber(player.rank, null),
    eligible: player.eligible !== false,
    method: formatText(player.method, ''),
    active: player.active !== false,
    history: sanitizeArray(player.history),
    rounds: sanitizeNumber(player.rounds, null),
  }
}

export function sanitizeTournamentData(data = {}) {
  return {
    id: formatText(data.id, 'tournament'),
    name: formatText(data.name, 'Tournament'),
    date: formatText(data.date, ''),
    course: formatText(data.course, 'Not available'),
    teeTime: formatText(data.teeTime, 'Not available'),
    format: formatText(data.format, 'Not available'),
    entryFee: data.entryFee,
    dueDate: formatText(data.dueDate, ''),
    notes: formatText(data.notes, ''),
    groups: sanitizeArray(data.groups).map(group => ({
      ...group,
      players: sanitizeArray(group.players).map(sanitizePlayer),
    })),
    members: sanitizeArray(data.members).map(sanitizePlayer),
    leaderboard: Object.fromEntries(
      Object.entries(data.leaderboard ?? {}).map(([flight, rows]) => [flight, sanitizeArray(rows).map(sanitizePlayer)]),
    ),
    paymentMap: typeof data.paymentMap === 'object' && data.paymentMap ? data.paymentMap : {},
  }
}
