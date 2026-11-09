import { parseLocalDate, startOfToday } from '../utils/formatDate.js'

/**
 * A tournament is completed when the static schedule says so, an admin marked
 * it complete, or its calendar date is before today. Past events stop showing
 * as "next" without a code change.
 */
export function mergeSchedule(schedule = [], statusDoc = null, today = startOfToday()) {
  const overrides = statusDoc?.completed ?? {}
  return schedule.map((tournament) => {
    const day = parseLocalDate(tournament.date)
    const past = day ? day < today : false
    const completed = tournament.status === 'completed' || Boolean(overrides[tournament.id]) || past
    return { ...tournament, status: completed ? 'completed' : 'upcoming' }
  })
}

export function nextTournament(schedule = []) {
  return schedule.find((tournament) => tournament.status === 'upcoming') ?? null
}

export function latestResultTournament(schedule = [], results = {}) {
  return [...schedule]
    .filter((tournament) => tournament.status === 'completed' && results?.[tournament.id]?.leaderboard)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] ?? null
}

export function feeLabel(entryFee) {
  if (entryFee == null || entryFee === '') return ''
  return Number.isNaN(Number(entryFee)) ? String(entryFee) : `$${entryFee}`
}
