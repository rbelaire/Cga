import test from 'node:test'
import assert from 'node:assert/strict'
import { applyImportPlan, buildImportContext, planBulkImport } from '../src/services/admin/import/planner.js'

test('credits planner marks duplicates and prepares additive entries', () => {
  const context = buildImportContext({
    members: [{ name: 'Jane Doe', ptm: 70 }],
    credits: { 'Jane Doe': 5 },
    creditTransactions: [{ member: 'Jane Doe', amount: 10, date: '2024-01-01', note: 'Seed', reference: 'seed-1' }],
  })

  const plan = planBulkImport({
    importType: 'credits',
    rows: [
      { rowNumber: 2, row: { member: 'Jane Doe', amount: 10, date: '2024-01-01', note: 'Seed', reference: 'seed-1' } },
      { rowNumber: 3, row: { member: 'Jane Doe', amount: 15, date: '2024-01-15', note: 'Adjustment', reference: 'adj-1' } },
    ],
    context,
  })

  assert.equal(plan.summary.duplicates, 1)
  assert.equal(plan.summary.toAdd, 1)

  const applied = applyImportPlan({
    plan,
    state: { credits: { 'Jane Doe': 5 }, resultsByTournament: {} },
  })

  assert.equal(applied.credits['Jane Doe'], 20)
  assert.equal(applied.creditTransactions.length, 1)
})

test('results planner blocks unknown tournament and member', () => {
  const context = buildImportContext({
    members: [{ name: 'Jane Doe', ptm: 70 }],
    resultsByTournament: {},
  })

  const plan = planBulkImport({
    importType: 'results',
    rows: [{ rowNumber: 2, row: { tournamentId: 'spring', flight: 'Championship', member: 'Unknown', score: 35 } }],
    context,
  })

  assert.equal(plan.summary.blockingErrors > 0, true)
  assert.equal(plan.summary.toAdd, 0)
})

test('tournament planner prepares new result stub docs', () => {
  const context = buildImportContext({
    members: [],
    resultsByTournament: { existing: { id: 'existing', leaderboard: {} } },
  })

  const plan = planBulkImport({
    importType: 'tournaments',
    rows: [
      { rowNumber: 2, row: { tournamentId: 'existing', title: 'Existing', date: '2024-04-01' } },
      { rowNumber: 3, row: { tournamentId: 'new-event', title: 'New Event', date: '2024-04-08', entryFee: 95 } },
    ],
    context,
  })

  assert.equal(plan.summary.duplicates, 1)
  assert.equal(plan.summary.toAdd, 1)

  const applied = applyImportPlan({
    plan,
    state: { credits: {}, resultsByTournament: {} },
  })

  assert.equal(applied.resultDocs['new-event'].name, 'New Event')
  assert.equal(applied.resultDocs['new-event'].leaderboard != null, true)
})
