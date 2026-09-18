import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calcFlightPOY,
  buildRoundsByName,
  capProvisionalLeaderboard,
  PROVISIONAL_PM_CAP,
} from '../src/utils/poy.js'

test('calcFlightPOY caps a 2nd/3rd-round player\'s displayed +/- without changing rank or POY', () => {
  // rounds: prior completed rounds. 1 = their 2nd event, 2 = their 3rd event.
  const rows = calcFlightPOY([
    { name: 'Provisional Pat', ptm: 70, score: 90, rounds: 1 }, // true +20 -> shown +2
    { name: 'Veteran Vic', ptm: 70, score: 80, rounds: 7 },     // true +10, uncapped
  ])
  const pat = rows.find(r => r.name === 'Provisional Pat')
  const vic = rows.find(r => r.name === 'Veteran Vic')

  // Ranking uses the TRUE plus/minus: Pat's +20 beats Vic's +10.
  assert.equal(pat.rank, 1)
  assert.equal(vic.rank, 2)
  // POY still reflects the true finishing order (winner gets the base points).
  assert.equal(pat.poy, 350)
  // Only the DISPLAYED plus/minus is clamped for the provisional player.
  assert.equal(pat.plusMinus, PROVISIONAL_PM_CAP)
  assert.equal(vic.plusMinus, 10)
})

test('buildRoundsByName maps names (case/space-insensitively) to lifetime rounds', () => {
  const map = buildRoundsByName([
    { name: 'Alice A', rounds: 2 },
    { name: 'Bob B', rounds: 9 },
    { name: 'No Rounds' },
  ])
  assert.equal(map['alice a'], 2)
  assert.equal(map['bob b'], 9)
  assert.equal(map['no rounds'], 0)
})

test('capProvisionalLeaderboard clamps displayed +/- only for 1-2 lifetime-round players', () => {
  const roundsByName = buildRoundsByName([
    { name: 'Rookie R', rounds: 1 },   // provisional
    { name: 'Sophomore S', rounds: 2 },// provisional
    { name: 'Vet V', rounds: 3 },      // not provisional
    { name: 'First F', rounds: 0 },    // brand new — not provisional
  ])
  const leaderboard = {
    'Championship': [
      { name: 'Rookie R', rank: 1, poy: 350, points: 40, plusMinus: 18 },
      { name: 'Vet V', rank: 2, poy: 325, points: 30, plusMinus: 12 },
    ],
    '1st Flight': [
      { name: 'Sophomore S', rank: 1, poy: 350, points: 35, plusMinus: 9 },
      { name: 'First F', rank: 2, poy: 325, points: 20, plusMinus: 8 },
      { name: 'Rookie R', rank: 3, poy: 300, points: 15, plusMinus: 1 }, // already below cap
    ],
  }
  const capped = capProvisionalLeaderboard(leaderboard, roundsByName)

  // Provisional players clamped to +2 in the displayed value only.
  assert.equal(capped['Championship'][0].plusMinus, PROVISIONAL_PM_CAP)
  assert.equal(capped['1st Flight'][0].plusMinus, PROVISIONAL_PM_CAP)
  // Non-provisional players untouched.
  assert.equal(capped['Championship'][1].plusMinus, 12)
  assert.equal(capped['1st Flight'][1].plusMinus, 8)
  // Already-below-cap provisional value is left as-is (idempotent).
  assert.equal(capped['1st Flight'][2].plusMinus, 1)
  // Rank/POY/score are never altered by the display cap.
  assert.equal(capped['Championship'][0].rank, 1)
  assert.equal(capped['Championship'][0].poy, 350)
  assert.equal(capped['Championship'][0].points, 40)
})

test('capProvisionalLeaderboard tolerates missing/blank input', () => {
  assert.equal(capProvisionalLeaderboard(null, {}), null)
  assert.deepEqual(capProvisionalLeaderboard({ A: [] }, null), { A: [] })
})
