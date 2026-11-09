import { normalizePairings } from '../domain/pairings.js'
import { adminEmailsFromUsers } from '../domain/access.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function createSeed() {
  const members = [
    { name: 'Ada Player', ptm: 36, tee: 'Back', rounds: 10, history: [34, 36, 33, 35, 32, 37, 31], email: 'ada@example.com', cell: '337-555-0101' },
    { name: 'Bea Player', ptm: 30, tee: 'Senior', rounds: 8, history: [29, 31, 28, 30, 27, 32, 26], email: 'bea@example.com', cell: '337-555-0102' },
    { name: 'Cy Player', ptm: 24, tee: 'Front', rounds: 4, history: [22, 24, 21, 25], email: 'cy@example.com' },
    { name: 'Dee Player', ptm: 18, tee: 'Back', rounds: 2, history: [18, 16], email: 'dee@example.com' },
    { name: 'Eve Player', ptm: null, tee: 'Back', rounds: 0, history: [], email: 'eve@example.com' },
  ]
  return {
    members,
    standings: { flights: { Championship: [
      { rank: 1, name: 'Ada Player', poy: 350, events: 1, ptm: 36, ptmDelta: null, latestScore: 38, latestTournament: 'Flow Control Companies Open', trend: null },
    ], '1st Flight': [
      { rank: 1, name: 'Bea Player', poy: 350, events: 1, ptm: 30, ptmDelta: null, latestScore: 32, latestTournament: 'Flow Control Companies Open', trend: null },
    ] } },
    poy: { flights: { Championship: [{ rank: 1, name: 'Ada Player', points: 350, events: 1 }], '1st Flight': [{ rank: 1, name: 'Bea Player', points: 350, events: 1 }] } },
    ptm: members.map((member) => ({ name: member.name, ptm: member.ptm, tee: member.tee, history: member.history, rounds: member.rounds })),
    beginning: [{ name: 'Ada Player', ptm: 34, tee: 'Back' }, { name: 'Bea Player', ptm: 28, tee: 'Senior' }],
    credits: { 'Ada Player': 25, 'Bea Player': 0 },
    users: [{ id: 'board', name: 'Board Member', email: 'board@cga.local', role: 'admin', status: 'active' }],
    changelog: [{ id: 'seed-log', ts: Date.now() - 86400000, action: 'Practice data', details: 'Sample club loaded in this browser only', user: 'Practice mode' }],
    creditTx: [],
    status: { completed: { '2026-01': true } },
    results: {
      '2026-01': {
        id: '2026-01',
        name: 'Flow Control Companies Open',
        date: '2026-03-15',
        course: 'Koasati Pines Golf Club',
        format: 'Shotgun / Stroke Play',
        status: 'completed',
        flightWinners: [{ flight: 'Championship', winner: 'Ada Player', points: 350 }],
        leaderboard: {
          Championship: [{ rank: 1, name: 'Ada Player', poy: 350, points: 38, ptm: 34, plusMinus: 4 }],
          '1st Flight': [{ rank: 1, name: 'Bea Player', poy: 350, points: 32, ptm: 28, plusMinus: 4 }],
        },
      },
    },
    scores: {},
    pairings: {},
    payments: {},
    paymentMeta: {},
    lifecycle: {},
    snapshots: [],
    pairingRules: [],
    freshLogs: [],
    freshTx: [],
  }
}

export function createEmptyClub() {
  return {
    members: [],
    standings: { flights: {} },
    poy: { flights: {} },
    ptm: [],
    beginning: [],
    credits: {},
    users: [],
    changelog: [],
    creditTx: [],
    status: { completed: {} },
    results: {},
    scores: {},
    pairings: {},
    payments: {},
    paymentMeta: {},
    lifecycle: {},
    snapshots: [],
    pairingRules: [],
    freshLogs: [],
    freshTx: [],
  }
}

export function createMemoryDb(initial = createSeed()) {
  const state = clone(initial)
  const topics = new Map()

  function emit(topic) {
    queueMicrotask(() => {
      for (const cb of topics.get(topic) || []) cb(clone(read(topic)))
    })
  }

  function sub(topic, cb) {
    if (!topics.has(topic)) topics.set(topic, new Set())
    topics.get(topic).add(cb)
    queueMicrotask(() => cb(clone(read(topic))))
    return () => topics.get(topic)?.delete(cb)
  }

  function read(topic) {
    if (topic === 'changelog') return [...state.freshLogs, ...state.changelog]
    if (topic === 'creditTx') return [...state.freshTx, ...state.creditTx]
    if (topic === 'pairings') {
      return Object.fromEntries(Object.entries(state.pairings).map(([id, doc]) => [id, normalizePairings(doc).pairings]))
    }
    return state[topic]
  }

  return {
    listenMembers: (cb) => sub('members', cb),
    saveMembers: async (list) => { state.members = clone(list); emit('members') },
    listenStandings: (cb) => sub('standings', cb),
    saveStandings: async (data) => { state.standings = clone(data); emit('standings') },
    listenPoy: (cb) => sub('poy', cb),
    savePoy: async (data) => { state.poy = clone(data); emit('poy') },
    listenPtm: (cb) => sub('ptm', cb),
    savePtm: async (list) => { state.ptm = clone(list); emit('ptm') },
    listenBeginningPtm: (cb) => sub('beginning', cb),
    saveBeginningPtm: async (list) => { state.beginning = clone(list); emit('beginning') },
    listenCredits: (cb) => sub('credits', cb),
    saveCredits: async (balances) => { state.credits = clone(balances); emit('credits') },
    listenUsers: (cb) => sub('users', cb),
    saveUsers: async (list) => { state.users = clone(list); state.adminEmails = adminEmailsFromUsers(list); emit('users') },
    listenTournamentStatus: (cb) => sub('status', cb),
    saveTournamentStatus: async (data) => { state.status = clone(data); emit('status') },
    listenPairingRules: (cb) => sub('pairingRules', cb),
    savePairingRules: async (rules) => { state.pairingRules = clone(rules); emit('pairingRules') },
    listenChangelog: (cb) => sub('changelog', cb),
    appendChangelog: async (entry) => { state.freshLogs.unshift(clone(entry)); emit('changelog') },
    listenCreditTransactions: (cb) => sub('creditTx', cb),
    appendCreditTransaction: async (entry) => { state.freshTx.unshift(clone(entry)); emit('creditTx') },
    listenResults: (cb) => sub('results', cb),
    listenResult: (tid, cb) => sub('results', (all) => cb(all?.[tid] ?? null)),
    listenScores: (cb) => sub('scores', cb),
    saveScores: async (tid, data) => { state.scores[tid] = clone(data); emit('scores') },
    listenPairings: (cb) => sub('pairings', cb),
    listenPairingsForTournament: (tid, cb) => sub('pairingsRaw', () => cb(state.pairings[tid] ? normalizePairings(state.pairings[tid]) : null)),
    savePairings: async (tid, groups, meta = {}) => {
      state.pairings[tid] = { pairings: clone(groups), tournament: meta.tournament || '', source: meta.source || 'Practice mode' }
      emit('pairings')
      emit('pairingsRaw')
    },
    listenPayments: (cb) => sub('payments', cb),
    savePayments: async (tid, map) => { state.payments[tid] = clone(map); emit('payments') },
    listenPaymentMeta: (cb) => sub('paymentMeta', cb),
    savePaymentMeta: async (tid, map) => { state.paymentMeta[tid] = clone(map); emit('paymentMeta') },
    listenLifecycle: (cb) => sub('lifecycle', cb),
    listenLifecycleForTournament: (tid, cb) => sub('lifecycle', (all) => cb(all?.[tid] ?? null)),
    saveLifecycle: async (tid, data) => { state.lifecycle[tid] = clone(data); emit('lifecycle') },
    listenSnapshots: (cb) => sub('snapshots', cb),
    appendSnapshot: async (entry) => { state.snapshots.unshift({ ...clone(entry), _id: entry.id }); emit('snapshots') },
    saveResult: async (tid, data) => { state.results[tid] = clone(data); emit('results') },
    batchPublish: async ({ tid, resultDoc, standings, poy, members, ptm, status }) => {
      state.results[tid] = clone(resultDoc)
      state.standings = clone(standings)
      state.poy = clone(poy)
      if (members) state.members = clone(members)
      if (ptm) state.ptm = clone(ptm)
      if (status) state.status = clone(status)
      emit('results')
      emit('standings')
      emit('poy')
      emit('members')
      emit('ptm')
      emit('status')
    },
  }
}
