// ── POY (Player of the Year) calculation ────────────────────────────────────
export const POY_BASE_POINTS     = 350  // points awarded to the flight winner
export const POY_POINTS_PER_RANK = 25   // points deducted per rank position below first

/**
 * Rank a flight's players by plus/minus and assign POY points.
 * Base: 350 pts for the flight winner, −25 pts per rank below first.
 * Ties share the average of their tied positions' points.
 * Players marked `eligible: false` receive 0 POY points.
 *
 * Display-only cap: a player on their 2nd or 3rd round (`rounds` of 1 or 2 —
 * i.e. 1–2 completed rounds before this one) shows a plus/minus of at most +2.
 * Ranking and POY are computed from the true plus/minus first, so this cap only
 * affects the plus/minus value shown on leaderboards, score entry, and exports.
 */
export const PROVISIONAL_PM_CAP = 2
const isProvisional = p => p?.rounds === 1 || p?.rounds === 2

// Provisional status for the retroactive display cap is keyed on a player's
// current lifetime completed rounds: 1 or 2 total rounds = their 2nd or 3rd event.
const isProvisionalRounds = rounds => rounds === 1 || rounds === 2

const normNameKey = name => String(name ?? '').trim().toLowerCase()

/**
 * Build a name → lifetime-rounds lookup from the members roster. Used to apply
 * the provisional +/- display cap to already-published leaderboards, whose rows
 * store a frozen plus/minus and no per-player round count.
 */
export function buildRoundsByName(members) {
  const map = {}
  if (Array.isArray(members)) {
    for (const m of members) {
      if (m?.name != null) map[normNameKey(m.name)] = Number(m.rounds) || 0
    }
  }
  return map
}

/**
 * Return a copy of a published leaderboard with each provisional player's
 * DISPLAYED plus/minus clamped to at most +2. A player is provisional when their
 * current lifetime round count (from `roundsByName`) is 1 or 2. Rank, POY, score,
 * and every other field are left untouched — only the shown plus/minus changes,
 * so already-published tournaments reflect the cap without a re-publish. Idempotent:
 * values already at or below the cap (e.g. capped at publish time) are unchanged.
 */
export function capProvisionalLeaderboard(leaderboard, roundsByName) {
  if (!leaderboard || typeof leaderboard !== 'object' || !roundsByName) return leaderboard
  const out = {}
  for (const [flight, rows] of Object.entries(leaderboard)) {
    out[flight] = Array.isArray(rows)
      ? rows.map(row => {
          const rounds = roundsByName[normNameKey(row?.name)]
          return (isProvisionalRounds(rounds) && typeof row?.plusMinus === 'number' && row.plusMinus > PROVISIONAL_PM_CAP)
            ? { ...row, plusMinus: PROVISIONAL_PM_CAP }
            : row
        })
      : rows
  }
  return out
}
export function calcFlightPOY(players) {
  if (!players.length) return players
  const n     = players.length
  const scale = Array.from({ length: n }, (_, i) => POY_BASE_POINTS - POY_POINTS_PER_RANK * i)

  const withPM = players.map((p, i) => {
    const hasData = !p.wd && p.ptm !== '' && p.score !== '' && p.ptm != null && p.score != null
    return { ...p, _i: i, _has: hasData, plusMinus: hasData ? Number(p.score) - Number(p.ptm) : null }
  })

  const complete = withPM.filter(p => p._has).sort((a, b) => b.plusMinus - a.plusMinus)
  const rankMap  = {}
  let pos = 0
  while (pos < complete.length) {
    const val   = complete[pos].plusMinus
    const group = []
    let j = pos
    while (j < complete.length && complete[j].plusMinus === val) { group.push(j); j++ }
    const avg = group.reduce((s, idx) => s + (scale[idx] ?? 0), 0) / group.length
    group.forEach(idx => {
      rankMap[complete[idx]._i] = { rank: pos + 1, poy: complete[idx].eligible !== false ? avg : 0 }
    })
    pos = j
  }
  return withPM.map((p, i) => {
    const displayPM = (isProvisional(p) && p.plusMinus != null)
      ? Math.min(p.plusMinus, PROVISIONAL_PM_CAP)
      : p.plusMinus
    return { ...p, rank: rankMap[i]?.rank ?? null, poy: rankMap[i]?.poy ?? null, plusMinus: displayPM }
  })
}
