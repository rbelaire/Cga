import { SCORE_FLIGHTS } from './flightOrder.js'

const DEFAULT_SCORE_FLIGHTS = SCORE_FLIGHTS
const FIELD_CAP = 120  // maximum number of paid-and-entered players per tournament

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
  tournament = null,
  scoresByTournament = {},
  pairingsByTournament = {},
  paymentsByTournament = {},
  resultsByTournament = {},
  lifecycleByTournament = {},
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
  const lifecycle = asObject(lifecycleByTournament[tournamentId])
  const pairedNames = new Set()
  for (const card of pairings) {
    const cardPlayers = Array.isArray(card?.players) ? card.players : []
    for (const p of cardPlayers) {
      if (p?.name) pairedNames.add(p.name)
    }
  }
  const pairedCount = pairedNames.size
  const pairingsState = lifecycle.pairingsState === 'published' || lifecycle.pairingsState === 'draft' || lifecycle.pairingsState === 'none'
    ? lifecycle.pairingsState
    : pairings.length > 0 ? 'published' : 'none'
  const pairingsPosted = pairingsState === 'published'

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

  const pairingsStatus = pairingsState === 'none'
    ? 'not_started'
    : pairingsState === 'draft'
      ? 'partial'
      : (enteredCount > 0 && pairedCount >= enteredCount) ? 'complete' : 'partial'
  const pairingsLabel = pairingsState === 'none'
    ? 'Pairings not generated'
    : pairingsState === 'draft'
      ? enteredCount > 0
        ? `Draft ready (${pairedCount}/${enteredCount} grouped)`
        : 'Draft pairings generated'
      : (enteredCount > 0 && pairedCount >= enteredCount)
        ? `Pairings published (${pairings.length} groups)`
        : enteredCount > 0
          ? `Published (${pairedCount}/${enteredCount} grouped)`
          : `Pairings published (${pairings.length} groups)`

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

  const memoSent = Boolean(lifecycle.memoSentAt)
  const memoStatus = memoSent ? 'complete' : 'not_started'
  const memoLabel = memoSent ? 'Tournament memo sent' : 'Tournament memo not sent'

  const fieldStatus = paidCount >= FIELD_CAP ? 'complete' : paidCount > 0 ? 'partial' : 'not_started'
  const fieldLabel = `${paidCount} / ${FIELD_CAP} paid and entered`

  const birdiePoolExported = Boolean(lifecycle.birdiePoolExportedAt)
  const birdieStatus = !pairingsPosted
    ? 'not_started'
    : birdiePoolExported ? 'complete' : 'not_started'
  const birdieLabel = birdiePoolExported ? 'Birdie pool exported' : 'Birdie pool not exported'

  const scoresPublished = Boolean(resultsByTournament[tournamentId])
  const scoresLifecycleStatus = scoredCount === 0
    ? 'not_started'
    : scoresPublished
      ? (enteredCount > 0 && scoredCount >= enteredCount ? 'complete' : 'partial')
      : 'partial'
  const scoresLifecycleLabel = scoresPublished
    ? `Published (${scoredCount}/${enteredCount || scoredCount} scored)`
    : scoredCount > 0
      ? `Entered (${scoredCount}/${enteredCount || scoredCount} scored)`
      : 'No scores entered'

  const payoutCreated = Boolean(lifecycle.payoutGeneratedAt)
  const payoutStatus = !scoresPublished
    ? 'not_started'
    : payoutCreated ? 'complete' : 'not_started'
  const payoutLabel = payoutCreated ? 'Payout document created' : 'Payout document not created'

  return {
    counts: {
      paidCount,
      enteredCount,
      pairedCount,
      pairingsCount: pairings.length,
      pairingsState,
      scoredCount,
      resultsPublished,
      fieldCap: FIELD_CAP,
      tournamentName: tournament?.name ?? null,
      tournamentDate: tournament?.date ?? null,
    },
    steps: [
      { key: 'payments', title: 'Payments received', status: paymentStatus, label: paymentLabel },
      { key: 'entries', title: 'Players entered into flights', status: entryStatus, label: entryLabel },
      { key: 'pairings', title: 'Pairings generated/posted', status: pairingsStatus, label: pairingsLabel },
      { key: 'scores', title: 'Scores entered', status: scoresStatus, label: scoresLabel },
      { key: 'results', title: 'Results published', status: resultsStatus, label: resultsLabel },
    ],
    lifecycleSteps: [
      { key: 'memo', title: 'Tournament Memo Sent', status: memoStatus, label: memoLabel },
      { key: 'field', title: 'Field', status: fieldStatus, label: fieldLabel },
      { key: 'pairingsLifecycle', title: 'Pairings Ready', status: pairingsStatus, label: pairingsLabel },
      { key: 'birdie', title: 'Birdie Pool Created', status: birdieStatus, label: birdieLabel },
      { key: 'scoresLifecycle', title: 'Scores Entered / Published', status: scoresLifecycleStatus, label: scoresLifecycleLabel },
      { key: 'payout', title: 'Payout Document Created', status: payoutStatus, label: payoutLabel },
    ],
  }
}
