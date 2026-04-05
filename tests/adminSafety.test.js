import test from 'node:test'
import assert from 'node:assert/strict'
import schedule from '../src/data/schedule.json' with { type: 'json' }
import { buildPublishPayload } from '../src/services/admin/publishService.js'
import {
  formatValidationErrors,
  validateMembers,
  validatePairingsForTournament,
  validatePayments,
  validatePublishPayload,
  validateScoresForTournament,
  validateTournamentId,
  validateUsers,
} from '../src/services/admin/validation/index.js'

const FLIGHTS = ['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight']

function calcFlightPOY(players) {
  return players
    .filter(p => p.score !== '' && p.score != null && p.ptm !== '' && p.ptm != null)
    .map(p => ({ ...p, plusMinus: Number(p.score) - Number(p.ptm), poy: 100, rank: 1 }))
}

test('validation catches invalid tournament IDs, duplicates, and malformed users', () => {
  assert.equal(validateTournamentId('', schedule).length > 0, true)
  assert.equal(validateTournamentId('unknown-tournament', schedule).length > 0, true)

  const memberErrors = validateMembers([
    { name: 'Alice A', ptm: 12 },
    { name: 'Alice A', ptm: -1 },
  ])
  assert.equal(memberErrors.length >= 2, true)

  const userErrors = validateUsers([
    { name: 'Admin', email: 'admin@cga.com' },
    { name: 'Duplicate', email: 'admin@cga.com' },
    { name: '', email: 'bad-email' },
  ])
  assert.equal(userErrors.length >= 3, true)
  assert.match(formatValidationErrors(userErrors), /\+\d+ more/)
})

test('validation catches score, pairing, and payment mismatches', () => {
  const scoresByTournament = {
    spring: {
      Championship: [{ name: 'Alice A', score: 'x', ptm: 70 }],
      '1st Flight': [{ name: 'Alice A', score: 71, ptm: 70 }],
    },
  }

  const scoreErrors = validateScoresForTournament({ tournamentId: 'spring', scoresByTournament, scoreFlights: [...FLIGHTS, 'New Players'] })
  assert.equal(scoreErrors.length >= 2, true)

  const pairingErrors = validatePairingsForTournament({
    tournamentId: 'spring',
    pairingsByTournament: { spring: [{ pairing: 'Pairing 1', players: [{ name: 'Missing Name' }] }] },
    scoresByTournament,
  })
  assert.equal(pairingErrors.length > 0, true)

  const paymentErrors = validatePayments(
    { spring: { 'Unknown Player': true }, bad: { 'Alice A': false } },
    [{ id: 'spring' }],
    ['Alice A'],
  )
  assert.equal(paymentErrors.length >= 3, true)
})

test('publish payload validation blocks unknown members and incomplete rows', () => {
  const payload = {
    targetTid: 'spring',
    resultDoc: {
      leaderboard: {
        Championship: [
          { name: 'Alice A', points: 72, ptm: 70 },
          { name: 'Missing', points: 'NaN', ptm: '' },
        ],
      },
    },
    newStandings: { flights: {} },
    newPoy: { flights: {} },
  }

  const errors = validatePublishPayload(payload, { members: [{ name: 'Alice A' }], scoreFlights: ['Championship'] })
  assert.equal(errors.length >= 3, true)
})

test('integration: publish payload computes standings and result docs from score data', () => {
  const targetTid = schedule[0].id
  const payload = buildPublishPayload({
    targetTid,
    schedule,
    flights: FLIGHTS,
    scoreData: {
      [targetTid]: {
        Championship: [
          { name: 'Alice A', score: 70, ptm: 72, eligible: true },
          { name: 'Bob B', score: 72, ptm: 72, eligible: true },
        ],
      },
    },
    currentStandings: {
      flights: {
        Championship: [
          { name: 'Alice A', ptm: 73, events: 3, poy: 250 },
          { name: 'Bob B', ptm: 72, events: 3, poy: 200 },
        ],
      },
    },
    ptmLookup: { 'Alice A': 72, 'Bob B': 72 },
    calcFlightPOY,
  })

  assert.equal(payload.targetTid, targetTid)
  assert.equal(payload.resultDoc.id, targetTid)
  assert.equal(Array.isArray(payload.resultDoc.leaderboard.Championship), true)
  assert.equal(payload.newStandings.flights.Championship.length, 2)
  assert.equal(payload.newStandings.flights.Championship[0].ptmDelta, -1)
  assert.equal(payload.newStandings.flights.Championship[0].trend, 'down')
  assert.equal(payload.newStandings.flights.Championship[1].ptmDelta, 0)
  assert.equal(payload.newStandings.flights.Championship[1].trend, null)
})
