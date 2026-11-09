import test from 'node:test'
import assert from 'node:assert/strict'
import { calcPtmFromHistory } from '../src/utils/roundPtm.js'
import { timeUntil, parseLocalDate } from '../src/utils/formatDate.js'
import { mergeSchedule, nextTournament, latestResultTournament } from '../src/domain/schedule.js'
import { generatePairings, normalizePairings } from '../src/domain/pairings.js'
import { buildPublish } from '../src/domain/publish.js'

test('PTM follows the league formula and the 6-point floor', () => {
  assert.equal(calcPtmFromHistory([18]), 18)
  assert.equal(calcPtmFromHistory([10, 30]), 30)
  assert.equal(calcPtmFromHistory([10, 20, 30]), 25)
  assert.equal(calcPtmFromHistory([4]), 6)
  const seven = calcPtmFromHistory([10, 20, 30, 40, 50, 60, 70])
  assert.equal(seven, Math.round((280 - 10 - 20) / 5))
  assert.equal(calcPtmFromHistory([]), null)
})

test('countdown uses the local calendar date, not UTC midnight', () => {
  const target = parseLocalDate('2026-11-10')
  assert.equal(target.getFullYear(), 2026)
  assert.equal(target.getMonth(), 10)
  assert.equal(target.getDate(), 10)
  const eveningBefore = new Date(2026, 10, 9, 19, 0, 0)
  const parts = timeUntil('2026-11-10', eveningBefore)
  assert.ok(parts.days >= 0)
  assert.ok(parts.hours >= 1)
  assert.equal(timeUntil('2026-11-09', eveningBefore), null)
})

test('past tournaments are no longer treated as next', () => {
  const schedule = [
    { id: 'a', date: '2026-03-15', status: 'completed', name: 'March' },
    { id: 'b', date: '2026-08-16', status: 'upcoming', name: 'August' },
    { id: 'c', date: '2026-12-01', status: 'upcoming', name: 'December' },
  ]
  const merged = mergeSchedule(schedule, { completed: { c: true } }, new Date(2026, 10, 9))
  assert.equal(merged.find((item) => item.id === 'b').status, 'completed')
  assert.equal(merged.find((item) => item.id === 'c').status, 'completed')
  assert.equal(nextTournament(merged), null)
  const open = mergeSchedule(schedule, null, new Date(2026, 7, 1))
  assert.equal(nextTournament(open).id, 'b')
  const results = { a: { leaderboard: { Championship: [] } }, b: { leaderboard: { Championship: [] } } }
  assert.equal(latestResultTournament(mergeSchedule(schedule, null, new Date(2026, 10, 9)), results).id, 'b')
})

test('pairings documents and generated groups share one shape', () => {
  const wrapped = normalizePairings({
    tournament: 'Open',
    source: 'admin',
    pairings: [{ pairing: 'Pairing 1', players: [{ name: 'Ada', flight: 'Championship' }] }],
  })
  assert.equal(wrapped.tournament, 'Open')
  assert.equal(wrapped.pairings[0].players[0].name, 'Ada')

  const legacy = normalizePairings([{ pairing: 'Pairing 1', players: [{ name: 'Bea', flight: '1st Flight' }] }])
  assert.equal(legacy.pairings.length, 1)
  assert.deepEqual(normalizePairings(null).pairings, [])

  const groups = generatePairings([
    { name: 'Ada', flight: 'Championship' },
    { name: 'Bea', flight: '1st Flight' },
    { name: 'Cy', flight: 'Championship' },
    { name: 'Dee', flight: '2nd Flight' },
    { name: 'Eve', flight: '1st Flight' },
  ], [{ type: 'always', players: ['Ada', 'Bea'] }])
  assert.ok(groups.length >= 2)
  assert.ok(groups.every((group) => group.pairing && group.players.length <= 4))
  const together = groups.find((group) => group.players.some((player) => player.name === 'Ada'))
  assert.ok(together.players.some((player) => player.name === 'Bea'))
  assert.equal(normalizePairings({ pairings: groups }).pairings.length, groups.length)
})

test('publishing adds event POY to the season and keeps players who did not play', () => {
  const members = [
    { name: 'Ada', ptm: 30, rounds: 8, history: [30, 31, 29, 32, 28, 33, 27] },
    { name: 'Bea', ptm: 20, rounds: 2, history: [20, 18] },
    { name: 'Cy', ptm: 25, rounds: 9, history: [25, 24, 26, 23, 22, 21, 20] },
  ]
  const standings = {
    flights: {
      Championship: [
        { name: 'Ada', poy: 100, events: 2, ptm: 30, rank: 1 },
        { name: 'Cy', poy: 80, events: 2, ptm: 25, rank: 2 },
      ],
    },
  }
  const poy = {
    flights: {
      Championship: [
        { name: 'Ada', points: 100, events: 2, rank: 1 },
        { name: 'Cy', points: 80, events: 2, rank: 2 },
      ],
    },
  }
  const scoreData = {
    Championship: [
      { name: 'Ada', score: 40, ptm: 30 },
      { name: 'Bea', score: 50, ptm: 20 },
    ],
  }
  const tournament = { id: '2026-02', name: 'April Open', date: '2026-04-19', course: 'Bayou', format: 'Shotgun / Stroke Play' }
  const first = buildPublish({ tournament, scoreData, standings, poy, members, ptmList: members.map((member) => ({ ...member })), previousResult: null })

  const ada = first.standings.flights.Championship.find((row) => row.name === 'Ada')
  const cy = first.standings.flights.Championship.find((row) => row.name === 'Cy')
  const bea = first.standings.flights.Championship.find((row) => row.name === 'Bea')
  assert.equal(ada.poy, 425)
  assert.equal(ada.events, 3)
  assert.equal(cy.poy, 80)
  assert.equal(cy.events, 2)
  assert.equal(bea.poy, 0)
  assert.equal(bea.events, 1)
  assert.equal(first.poy.flights.Championship.find((row) => row.name === 'Ada').points, 425)
  assert.equal(first.resultDoc.format, 'Shotgun / Stroke Play')
  assert.equal(first.members.find((member) => member.name === 'Ada').rounds, 9)
  assert.equal(first.members.find((member) => member.name === 'Cy').rounds, 9)
  assert.equal(first.ptm.find((row) => row.name === 'Ada').rounds, 9)

  const again = buildPublish({
    tournament,
    scoreData,
    standings: first.standings,
    poy: first.poy,
    members: first.members,
    ptmList: first.ptm,
    previousResult: first.resultDoc,
  })
  assert.equal(again.standings.flights.Championship.find((row) => row.name === 'Ada').poy, 425)
  assert.equal(again.standings.flights.Championship.find((row) => row.name === 'Ada').events, 3)
  assert.equal(again.members.find((member) => member.name === 'Ada').rounds, 9)
})
