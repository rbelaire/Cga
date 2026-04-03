import test from 'node:test'
import assert from 'node:assert/strict'
import { computeTournamentWorkflowState } from '../src/utils/tournamentWorkflow.js'

const scoreFlights = ['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight', 'New Players']

test('reports partial states when payments, entries, pairings, and scores are mismatched', () => {
  const state = computeTournamentWorkflowState({
    tournamentId: 't1',
    scoreFlights,
    scoresByTournament: {
      t1: {
        Championship: [
          { name: 'Alice A', score: 72 },
          { name: 'Bob B', score: '' },
          { name: 'Cara C', score: '' },
        ],
      },
    },
    paymentsByTournament: {
      t1: {
        'Alice A': true,
        'Bob B': true,
        'Cara C': true,
        'Drew D': true,
      },
    },
    pairingsByTournament: {
      t1: [
        { pairing: 'Pairing 1', players: [{ name: 'Alice A' }, { name: 'Bob B' }] },
      ],
    },
    resultsByTournament: {},
  })

  assert.equal(state.counts.paidCount, 4)
  assert.equal(state.counts.enteredCount, 3)
  assert.equal(state.counts.pairedCount, 2)
  assert.equal(state.counts.scoredCount, 1)
  assert.deepEqual(
    state.steps.map(s => [s.key, s.status]),
    [
      ['payments', 'complete'],
      ['entries', 'partial'],
      ['pairings', 'partial'],
      ['scores', 'partial'],
      ['results', 'not_started'],
    ],
  )
})

test('marks all steps complete when full workflow is finished', () => {
  const state = computeTournamentWorkflowState({
    tournamentId: 't2',
    scoreFlights,
    scoresByTournament: {
      t2: {
        Championship: [
          { name: 'Alice A', score: 70 },
          { name: 'Bob B', score: 71 },
        ],
      },
    },
    paymentsByTournament: {
      t2: {
        'Alice A': true,
        'Bob B': true,
      },
    },
    pairingsByTournament: {
      t2: [
        { pairing: 'Pairing 1', players: [{ name: 'Alice A' }, { name: 'Bob B' }] },
      ],
    },
    resultsByTournament: {
      t2: { id: 't2', status: 'completed' },
    },
  })

  assert.deepEqual(
    state.steps.map(s => s.status),
    ['complete', 'complete', 'complete', 'complete', 'complete'],
  )
})

test('keeps results step partial when published before all scores are entered', () => {
  const state = computeTournamentWorkflowState({
    tournamentId: 't3',
    scoreFlights,
    scoresByTournament: {
      t3: {
        Championship: [
          { name: 'Alice A', score: 71 },
          { name: 'Bob B', score: '' },
        ],
      },
    },
    paymentsByTournament: { t3: { 'Alice A': true, 'Bob B': true } },
    pairingsByTournament: {
      t3: [{ pairing: 'Pairing 1', players: [{ name: 'Alice A' }, { name: 'Bob B' }] }],
    },
    resultsByTournament: {
      t3: { id: 't3', status: 'completed' },
    },
  })

  const resultsStep = state.steps.find(step => step.key === 'results')
  assert.equal(resultsStep?.status, 'partial')
  assert.match(resultsStep?.label ?? '', /scores 1\/2/)
})

