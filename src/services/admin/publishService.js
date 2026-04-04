export function buildPublishPayload({
  targetTid,
  schedule,
  flights,
  scoreData,
  currentStandings,
  ptmLookup,
  calcFlightPOY,
}) {
  const targetTournament = schedule.find(t => t.id === targetTid)
  if (!targetTournament) return null

  const flightWinners = []
  const leaderboard = {}

  for (const fl of flights) {
    const ps = calcFlightPOY(scoreData[targetTid]?.[fl] ?? [])
    const ranked = [...ps].filter(p => p.rank != null).sort((a, b) => a.rank - b.rank || b.plusMinus - a.plusMinus)
    const allRows = [...ranked, ...ps.filter(p => p.rank == null)]

    leaderboard[fl] = allRows.map(p => ({
      rank: p.rank ?? 0,
      name: p.name,
      poy: p.poy ?? 0,
      points: Number(p.score) || 0,
      ptm: Number(p.ptm) || 0,
      plusMinus: p.plusMinus ?? 0,
    }))

    if (ranked[0]) {
      flightWinners.push({ flight: fl, winner: ranked[0].name, points: ranked[0].poy ?? 0 })
    }
  }

  const newPlayerRows = (scoreData[targetTid]?.['New Players'] ?? []).filter(p => p.name && p.score != null && p.score !== '')
  if (newPlayerRows.length) {
    leaderboard['New Players'] = newPlayerRows.map(p => ({
      rank: 0,
      name: p.name,
      poy: 0,
      points: Number(p.score) || 0,
      ptm: Number(p.ptm) || 0,
      plusMinus: (p.ptm != null && p.ptm !== '' && p.score != null && p.score !== '')
        ? Number(p.score) - Number(p.ptm)
        : 0,
    }))
  }

  const resultDoc = {
    id: targetTid,
    name: targetTournament.name,
    date: targetTournament.date,
    course: targetTournament.course,
    format: 'Individual Stroke Play',
    status: 'completed',
    flightWinners,
    leaderboard,
  }

  const prevStandingsLookup = {}
  const prevPtmLookup = {}

  for (const fl of flights) {
    for (const p of (currentStandings.flights[fl] ?? [])) {
      prevStandingsLookup[p.name] = p
      if (p.ptm != null) prevPtmLookup[p.name] = p.ptm
    }
  }

  const newPoy = { flights: {} }
  for (const fl of flights) {
    const ps = calcFlightPOY(scoreData[targetTid]?.[fl] ?? [])
    newPoy.flights[fl] = [...ps]
      .sort((a, b) => (b.poy ?? -1) - (a.poy ?? -1))
      .map((p, i) => {
        const prevEvents = prevStandingsLookup[p.name]?.events ?? 0
        return { rank: i + 1, name: p.name, points: p.poy ?? 0, events: prevEvents + 1 }
      })
  }

  const newStandings = { flights: {} }
  for (const fl of flights) {
    const ps = calcFlightPOY(scoreData[targetTid]?.[fl] ?? [])
    const sorted = [...ps].sort((a, b) => (b.poy ?? -1) - (a.poy ?? -1))

    newStandings.flights[fl] = sorted.map((p, i) => {
      const newPtm = ptmLookup[p.name] ?? (Number(p.ptm) || null)
      const oldPtm = prevPtmLookup[p.name] ?? null
      const ptmDelta = (newPtm != null && oldPtm != null) ? +(newPtm - oldPtm).toFixed(2) : 0
      const prev = prevStandingsLookup[p.name]
      const prevEvents = prev?.events ?? 0
      const prevPoy = prev?.poy ?? 0
      const newPoyVal = p.poy ?? 0
      const trend = newPoyVal > prevPoy ? 'up' : newPoyVal < prevPoy ? 'down' : 'stable'

      return {
        rank: i + 1,
        name: p.name,
        poy: newPoyVal,
        ptm: newPtm,
        ptmDelta,
        latestScore: Number(p.score) || null,
        latestTournament: targetTournament.name,
        events: prevEvents + 1,
        trend,
      }
    })
  }

  const totalPlayersAffected = flights.reduce(
    (sum, fl) => sum + (newStandings.flights[fl]?.length ?? 0),
    0,
  )

  const flightSummaries = flights.map(fl => ({
    flight: fl,
    winner: flightWinners.find(w => w.flight === fl) ?? null,
    topRows: (resultDoc.leaderboard[fl] ?? []).filter(row => row.rank > 0).slice(0, 3),
  }))

  return {
    targetTid,
    targetTournament,
    resultDoc,
    newPoy,
    newStandings,
    preview: { totalPlayersAffected, flightSummaries },
  }
}
