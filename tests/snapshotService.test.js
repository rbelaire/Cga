import test from 'node:test'
import assert from 'node:assert/strict'
import { createSnapshotEntry, getSnapshotLabel } from '../src/services/admin/snapshotService.js'

test('createSnapshotEntry returns structured snapshot metadata', () => {
  const entry = createSnapshotEntry({
    type: 'scores',
    data: { spring: { Championship: [] } },
    user: 'Admin',
    tournamentId: 'spring',
    details: 'Before save',
  })

  assert.equal(entry.type, 'scores')
  assert.equal(entry.user, 'Admin')
  assert.equal(entry.tid, 'spring')
  assert.equal(entry.details, 'Before save')
  assert.equal(typeof entry.ts, 'number')
  assert.equal(entry.id.startsWith('scores-'), true)
})

test('getSnapshotLabel renders a readable fallback label', () => {
  const label = getSnapshotLabel({ type: 'credits', ts: Date.now() })
  assert.match(label, /credits @/)
})
