const DEFAULT_SCORE_FLIGHTS = ['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight', 'New Players']

function asObject(value) {
  return value && typeof value === 'object' ? value : {}
}

function countUniqueByName(players) {
  const names = new Set()
  for (const p of players) {
    if (p?.name) names.add(p.name)
  }
  return names.size
}

function hasScore(value) {
  return value !== '' && value != null
}

export function computeTournamentWorkflowState({
  tournamentId,
  scoresByTournament = {},
  pairingsByTournament = {},
  paymentsByTournament = {},
  resultsByTournament = {},
  scoreFlights = DEFAULT_SCORE_FLIGHTS,
}) {
  const scoreTid = asObject(scoresByTournament[tournamentId])
  const players = scoreFlights.flatMap(flight => {
    const rows = scoreTid[flight]
    return Array.isArray(rows) ? rows : []
  })

  const enteredCount = countUniqueByName(players)
  const scoredCount = countUniqueByName(players.filter(p => hasScore(p?.score)))

  const paymentMap = asObject(paymentsByTournament[tournamentId])
  const paidCount = Object.keys(paymentMap).length

  const pairings = Array.isArray(pairingsByTournament[tournamentId]) ? pairingsByTournament[tournamentId] : []
  const pairedNames = new Set()
  for (const card of pairings) {
    const cardPlayers = Array.isArray(card?.players) ? card.players : []
    for (const p of cardPlayers) {
      if (p?.name) pairedNames.add(p.name)
    }
  }
  const pairedCount = pairedNames.size
  const pairingsPosted = pairings.length > 0

  const resultsPublished = Boolean(resultsByTournament[tournamentId])

  const paymentStatus = paidCount === 0
    ? 'not_started'
    : (enteredCount > 0 && paidCount >= enteredCount) ? 'complete' : 'partial'
  const paymentLabel = paidCount === 0
    ? 'No payments recorded'
    : (enteredCount > 0 && paidCount >= enteredCount)
      ? `${paidCount} paid (all entered players)`
      : enteredCount > 0
        ? `${paidCount} paid / ${enteredCount} entered`
        : `${paidCount} paid`

  const entryStatus = enteredCount === 0
    ? 'not_started'
    : (paidCount > 0 && enteredCount >= paidCount) ? 'complete' : 'partial'
  const entryLabel = enteredCount === 0
    ? 'No players entered'
    : paidCount > 0
      ? `${enteredCount} entered / ${paidCount} paid`
      : `${enteredCount} entered`

  const pairingsStatus = !pairingsPosted
    ? 'not_started'
    : (enteredCount > 0 && pairedCount >= enteredCount) ? 'complete' : 'partial'
  const pairingsLabel = !pairingsPosted
    ? 'Pairings not posted'
    : (enteredCount > 0 && pairedCount >= enteredCount)
      ? `Pairings posted (${pairings.length} groups)`
      : enteredCount > 0
        ? `Pairings draft: ${pairedCount}/${enteredCount} grouped`
        : `Pairings posted (${pairings.length} groups)`

  const scoresStatus = scoredCount === 0
    ? 'not_started'
    : (enteredCount > 0 && scoredCount >= enteredCount) ? 'complete' : 'partial'
  const scoresLabel = scoredCount === 0
    ? 'Scores not entered'
    : (enteredCount > 0 && scoredCount >= enteredCount)
      ? `Scores complete (${scoredCount}/${enteredCount})`
      : `Scores incomplete (${scoredCount}/${enteredCount || scoredCount})`

  const resultsStatus = !resultsPublished
    ? 'not_started'
    : (enteredCount > 0 && scoredCount >= enteredCount) ? 'complete' : 'partial'
  const resultsLabel = !resultsPublished
    ? 'Results not published'
    : (enteredCount > 0 && scoredCount >= enteredCount)
      ? 'Results published'
      : `Results published (scores ${scoredCount}/${enteredCount || scoredCount})`

  return {
    counts: {
      paidCount,
      enteredCount,
      pairedCount,
      pairingsCount: pairings.length,
      scoredCount,
      resultsPublished,
    },
    steps: [
      { key: 'payments', title: 'Payments received', status: paymentStatus, label: paymentLabel },
      { key: 'entries', title: 'Players entered into flights', status: entryStatus, label: entryLabel },
      { key: 'pairings', title: 'Pairings generated/posted', status: pairingsStatus, label: pairingsLabel },
      { key: 'scores', title: 'Scores entered', status: scoresStatus, label: scoresLabel },
      { key: 'results', title: 'Results published', status: resultsStatus, label: resultsLabel },
    ],
  }
}

