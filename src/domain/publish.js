import { FLIGHT_ORDER, NEW_PLAYERS_FLIGHT } from '../utils/flightOrder.js'
import { calcFlightPOY } from '../utils/poy.js'
import { calcPtmFromHistory } from '../utils/roundPtm.js'

const SEASON_FLIGHTS = FLIGHT_ORDER

function roundPoints(value) {
  return Math.round((Number(value) || 0) * 10) / 10
}

function scoreOf(row) {
  if (!row || row.wd) return null
  const score = Number(row.score ?? row.points)
  return Number.isFinite(score) ? score : null
}

function previousScore(previousResult, name) {
  if (!previousResult?.leaderboard) return null
  for (const rows of Object.values(previousResult.leaderboard)) {
    const match = (rows || []).find((row) => row?.name === name && !row.wd)
    if (match && typeof match.points === 'number') return match.points
  }
  return null
}

export function updateMemberForScore(member, score, previousEventScore) {
  const history = (member?.history ?? []).filter((value) => typeof value === 'number' && Number.isFinite(value))
  const lifetime = typeof member?.rounds === 'number' && member.rounds >= history.length
    ? member.rounds
    : history.length
  let nextHistory = history
  let rounds = lifetime
  if (previousEventScore == null) {
    nextHistory = [score, ...history].slice(0, 7)
    rounds = lifetime + 1
  } else if (history[0] === previousEventScore) {
    nextHistory = [score, ...history.slice(1)].slice(0, 7)
  }
  return {
    ...member,
    history: nextHistory,
    rounds,
    ptm: calcPtmFromHistory(nextHistory) ?? member?.ptm ?? null,
  }
}

export function buildEventResult({ tournament, scoreData, flights = SEASON_FLIGHTS }) {
  const leaderboard = {}
  const flightWinners = []

  for (const flight of flights) {
    const ranked = calcFlightPOY(scoreData?.[flight] ?? [])
    const rows = [...ranked].sort((a, b) => {
      if (a.wd && !b.wd) return 1
      if (!a.wd && b.wd) return -1
      return (a.rank ?? 99) - (b.rank ?? 99)
    })
    leaderboard[flight] = rows
      .filter((row) => row?.name && (row.wd || scoreOf(row) != null))
      .map((row) => ({
        rank: row.wd ? null : (row.rank ?? 0),
        name: row.name,
        poy: row.poy ?? 0,
        points: scoreOf(row) ?? 0,
        ptm: Math.round(Number(row.ptm)) || 0,
        plusMinus: row.plusMinus ?? 0,
        ...(row.wd ? { wd: true } : {}),
      }))
    if (!leaderboard[flight].length) {
      delete leaderboard[flight]
      continue
    }
    const winner = leaderboard[flight].find((row) => row.rank === 1)
    if (winner) flightWinners.push({ flight, winner: winner.name, points: winner.poy ?? 0 })
  }

  const newcomers = (scoreData?.[NEW_PLAYERS_FLIGHT] ?? []).filter((row) => row?.name && scoreOf(row) != null)
  if (newcomers.length) {
    leaderboard[NEW_PLAYERS_FLIGHT] = newcomers.map((row) => ({
      rank: 0,
      name: row.name,
      poy: 0,
      points: scoreOf(row) ?? 0,
      ptm: Math.round(Number(row.ptm)) || 0,
      plusMinus: scoreOf(row) != null && row.ptm !== '' && row.ptm != null ? scoreOf(row) - Number(row.ptm) : 0,
    }))
  }

  return {
    id: tournament.id,
    name: tournament.name,
    date: tournament.date,
    course: tournament.course,
    format: tournament.format || 'Stroke Play',
    status: 'completed',
    flightWinners,
    leaderboard,
  }
}

function blankSeasonRow(name, field) {
  return field === 'poy'
    ? { name, poy: 0, events: 0, ptm: null, ptmDelta: null, latestScore: null, latestTournament: null, trend: null }
    : { name, points: 0, events: 0 }
}

/**
 * Add this event's POY onto the season totals. Players who did not play stay.
 * A republish subtracts the previous result for this event first.
 */
export function accumulateSeason(currentDoc, previousResult, nextResult, field, tournament, ptmByName = {}) {
  const flights = {}
  const names = new Set([
    ...Object.keys(currentDoc?.flights ?? {}),
    ...Object.keys(previousResult?.leaderboard ?? {}),
    ...Object.keys(nextResult?.leaderboard ?? {}),
    ...SEASON_FLIGHTS,
  ])

  for (const flight of names) {
    if (flight === NEW_PLAYERS_FLIGHT) continue
    const map = new Map()
    for (const row of currentDoc?.flights?.[flight] ?? []) {
      if (row?.name) map.set(row.name, { ...row })
    }
    for (const row of previousResult?.leaderboard?.[flight] ?? []) {
      if (!row?.name || row.wd) continue
      const current = map.get(row.name)
      if (!current) continue
      current[field] = roundPoints((current[field] ?? 0) - (row.poy ?? 0))
      current.events = Math.max(0, (current.events ?? 0) - 1)
    }
    for (const row of nextResult?.leaderboard?.[flight] ?? []) {
      if (!row?.name || row.wd) continue
      const current = map.get(row.name) ?? blankSeasonRow(row.name, field)
      current[field] = roundPoints((current[field] ?? 0) + (row.poy ?? 0))
      current.events = (current.events ?? 0) + 1
      if (field === 'poy') {
        const oldPtm = current.ptm ?? null
        const newPtm = ptmByName[row.name] ?? current.ptm ?? null
        const delta = oldPtm != null && newPtm != null ? roundPoints(newPtm - oldPtm) : null
        current.ptm = newPtm
        current.ptmDelta = delta
        current.latestScore = row.points
        current.latestTournament = tournament.name
        current.trend = delta == null || delta === 0 ? null : delta > 0 ? 'up' : 'down'
      }
      map.set(row.name, current)
    }
    flights[flight] = [...map.values()]
      .filter((row) => (row.events ?? 0) > 0 || (row[field] ?? 0) !== 0 || row.ptm != null)
      .sort((a, b) => (b[field] ?? 0) - (a[field] ?? 0) || a.name.localeCompare(b.name))
      .map((row, index) => ({ ...row, rank: index + 1 }))
  }

  return { flights }
}

export function buildPublish({ tournament, scoreData, standings, poy, members, ptmList, previousResult }) {
  const stamped = {}
  for (const [flight, rows] of Object.entries(scoreData || {})) {
    stamped[flight] = (rows || []).map((row) => {
      const member = (members || []).find((item) => item.name === row.name)
      const rounds = typeof row.rounds === 'number'
        ? row.rounds
        : (typeof member?.rounds === 'number' ? member.rounds : 0)
      return { ...row, rounds, eligible: row.eligible !== false && rounds >= 7 }
    })
  }

  const resultDoc = buildEventResult({ tournament, scoreData: stamped })
  const nextMembers = (members || []).map((member) => {
    let score = null
    for (const rows of Object.values(stamped)) {
      const row = (rows || []).find((item) => item?.name === member.name)
      if (row) score = scoreOf(row)
    }
    if (score == null) return member
    return updateMemberForScore(member, score, previousScore(previousResult, member.name))
  })
  const ptmByName = Object.fromEntries(nextMembers.map((member) => [member.name, member.ptm]))
  const nextStandings = accumulateSeason(standings, previousResult, resultDoc, 'poy', tournament, ptmByName)
  const nextPoy = accumulateSeason(poy, previousResult, resultDoc, 'points', tournament, ptmByName)
  const known = new Set((ptmList || []).map((row) => row.name))
  const nextPtm = (ptmList || []).map((row) => {
    const member = nextMembers.find((item) => item.name === row.name)
    return member ? { ...row, ptm: member.ptm, history: member.history, rounds: member.rounds, tee: member.tee ?? row.tee ?? null } : row
  })
  for (const member of nextMembers) {
    if (!known.has(member.name) || !(ptmList || []).length) {
      if (!known.has(member.name) && member.history?.length) {
        nextPtm.push({ name: member.name, ptm: member.ptm, tee: member.tee ?? null, history: member.history, rounds: member.rounds })
      }
    }
  }

  return { resultDoc, standings: nextStandings, poy: nextPoy, members: nextMembers, ptm: nextPtm }
}

/** Zero season points for players under 7 rounds. Updates the docs the site reads. */
export function zeroIneligibleSeasonPoints(standings, poyDoc, roundsByName) {
  function rewrite(doc, field) {
    const flights = {}
    for (const [flight, rows] of Object.entries(doc?.flights ?? {})) {
      flights[flight] = (rows || []).map((row) => (
        (roundsByName[row.name] ?? 0) < 7 ? { ...row, [field]: 0 } : { ...row }
      )).sort((a, b) => (b[field] ?? 0) - (a[field] ?? 0) || a.name.localeCompare(b.name))
        .map((row, index) => ({ ...row, rank: index + 1 }))
    }
    return { flights }
  }
  return {
    standings: rewrite(standings, 'poy'),
    poy: rewrite(poyDoc, 'points'),
  }
}
