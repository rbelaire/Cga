function roundsThisYear(name, results, year) {
  let count = 0
  for (const result of Object.values(results || {})) {
    if (!String(result?.date || '').startsWith(String(year)) || !result?.leaderboard) continue
    const played = Object.values(result.leaderboard).some((rows) => (
      (rows || []).some((row) => row?.name === name && !row.wd)
    ))
    if (played) count += 1
  }
  return count
}

export function buildMostImproved(ptmList = [], beginning = [], results = {}, year = new Date().getFullYear()) {
  const startByName = Object.fromEntries((beginning || []).map((row) => [row.name, Number(row.ptm)]))
  return (ptmList || []).map((row) => {
    const current = Number(row.ptm)
    const start = startByName[row.name]
    const hasBoth = Number.isFinite(current) && Number.isFinite(start)
    const totalRounds = typeof row.rounds === 'number' ? row.rounds : (row.history || []).length
    const currentYearRounds = roundsThisYear(row.name, results, year)
    return {
      name: row.name,
      current: Number.isFinite(current) ? current : null,
      start: Number.isFinite(start) ? start : null,
      delta: hasBoth ? Math.round((current - start) * 10) / 10 : null,
      totalRounds,
      currentYearRounds,
      qualified: totalRounds >= 7 && currentYearRounds >= 3 && hasBoth,
    }
  })
}
