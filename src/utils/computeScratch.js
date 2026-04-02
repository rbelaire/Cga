/**
 * Compute scratch (total Stableford) standings from all tournament results.
 * Returns an array of { name, scratchPts, events } sorted by points descending.
 */
export function computeScratch(allResults) {
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
