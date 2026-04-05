/**
 * Firestore data-access layer for CGA.
 *
 * Collection layout:
 *   cga/members          – members array
 *   cga/standings        – { flights: { ... } }
 *   cga/poy              – { flights: { ... } }
 *   cga/pairings         – { [tournamentId]: [...] }
 *   cga/credits          – { [memberName]: balance }
 *   cga/users            – users array for admin management
 *   cga/results          – { data: { [tid]: resultDoc, ... } }
 *   cga/scores           – { [tid]: { [flight]: [...players] } }  (admin work-in-progress)
 *   cga/tournamentLifecycle – { data: { [tid]: {...} } }
 *   cga/paymentMeta      – { data: { [tid]: { [memberName]: {...} } } }
 *   cga/creditTransactions – { entries: [...] }
 */
import { db } from './firebase'
import {
  doc, getDoc, setDoc, onSnapshot, updateDoc, arrayUnion,
} from 'firebase/firestore'

const REF = (path) => doc(db, path)

// ── Generic helpers ──────────────────────────────────────────────────────────

export async function fsGet(path) {
  const snap = await getDoc(REF(path))
  return snap.exists() ? snap.data() : null
}

export async function fsSet(path, data) {
  await setDoc(REF(path), data)
}

export async function fsMerge(path, data) {
  await setDoc(REF(path), data, { merge: true })
}

export function fsListen(path, callback) {
  return onSnapshot(REF(path), snap => {
    callback(snap.exists() ? snap.data() : null)
  })
}

// ── Specific collections ─────────────────────────────────────────────────────

export const DB = {
  // Members
  getMembers:    () => fsGet('cga/members').then(d => d?.list ?? null),
  saveMembers:   (list) => fsSet('cga/members', { list }),
  listenMembers: (cb)  => fsListen('cga/members', d => cb(d?.list ?? null)),

  // Standings
  getStandings:    () => fsGet('cga/standings'),
  saveStandings:   (data) => fsSet('cga/standings', data),
  listenStandings: (cb)   => fsListen('cga/standings', cb),

  // POY
  getPoy:    () => fsGet('cga/poy'),
  savePoy:   (data) => fsSet('cga/poy', data),
  listenPoy: (cb)   => fsListen('cga/poy', cb),

  // Pairings (entire map: { tid: [...] })
  getPairings:    () => fsGet('cga/pairings').then(d => d?.map ?? {}),
  savePairings:   (map) => fsSet('cga/pairings', { map }),
  listenPairings: (cb)  => fsListen('cga/pairings', d => cb(d?.map ?? {})),

  // Credits
  getCredits:    () => fsGet('cga/credits').then(d => d?.balances ?? {}),
  saveCredits:   (balances) => fsSet('cga/credits', { balances }),
  listenCredits: (cb) => fsListen('cga/credits', d => cb(d?.balances ?? {})),

  // Users
  getUsers:    () => fsGet('cga/users').then(d => d?.list ?? []),
  saveUsers:   (list) => fsSet('cga/users', { list }),
  listenUsers: (cb) => fsListen('cga/users', d => cb(d?.list ?? [])),

  // PTM history (list of { name, ptm, ptmAtFlowControl, tee, history, rounds })
  getPtm:    () => fsGet('cga/ptm').then(d => d?.list ?? null),
  savePtm:   (list) => fsSet('cga/ptm', { list }),
  listenPtm: (cb)   => fsListen('cga/ptm', d => cb(d?.list ?? null)),

  // Payments (map of { [tid]: { [memberName]: true } })
  getPayments:    () => fsGet('cga/payments').then(d => d?.data ?? {}),
  savePayments:   (data) => fsSet('cga/payments', { data }),
  listenPayments: (cb) => fsListen('cga/payments', d => cb(d?.data ?? {})),

  // Score entry work-in-progress
  getScores:    () => fsGet('cga/scores').then(d => d?.data ?? {}),
  saveScores:   (data) => fsSet('cga/scores', { data }),
  listenScores: (cb)  => fsListen('cga/scores', d => cb(d?.data ?? {})),

  // Tournament results (map of all tournaments in one doc)
  getResult:    (tid) => fsGet('cga/results').then(d => d?.data?.[tid] ?? null),
  saveResult:   (tid, data) => fsMerge('cga/results', { data: { [tid]: data } }),
  listenResult: (tid, cb) => fsListen('cga/results', d => cb(d?.data?.[tid] ?? null)),
  listenResults: (cb) => fsListen('cga/results', d => cb(d?.data ?? {})),

  // Tournament lifecycle metadata (memo, pairings state, exports, payout markers)
  getTournamentLifecycle:    () => fsGet('cga/tournamentLifecycle').then(d => d?.data ?? {}),
  saveTournamentLifecycle:   (data) => fsSet('cga/tournamentLifecycle', { data }),
  listenTournamentLifecycle: (cb) => fsListen('cga/tournamentLifecycle', d => cb(d?.data ?? {})),

  // Payment metadata (credit usage + transaction pointer per tournament/player)
  getPaymentMeta:    () => fsGet('cga/paymentMeta').then(d => d?.data ?? {}),
  savePaymentMeta:   (data) => fsSet('cga/paymentMeta', { data }),
  listenPaymentMeta: (cb) => fsListen('cga/paymentMeta', d => cb(d?.data ?? {})),

  // Changelog / audit log  { entries: [...] }
  appendChangelog: async (entry) => {
    const ref = REF('cga/changelog')
    try {
      await updateDoc(ref, { entries: arrayUnion(entry) })
    } catch {
      // Document may not exist yet — create it
      await setDoc(ref, { entries: [entry] })
    }
  },
  listenChangelog: (cb) => fsListen('cga/changelog', d => cb(d?.entries ?? [])),

  // Admin snapshots / rollback history { entries: [...] }
  appendSnapshot: async (entry) => {
    const ref = REF('cga/snapshots')
    try {
      await updateDoc(ref, { entries: arrayUnion(entry) })
    } catch {
      await setDoc(ref, { entries: [entry] })
    }
  },
  listenSnapshots: (cb) => fsListen('cga/snapshots', d => cb(d?.entries ?? [])),

  // Lightweight credit transaction log
  appendCreditTransaction: async (entry) => {
    const ref = REF('cga/creditTransactions')
    try {
      await updateDoc(ref, { entries: arrayUnion(entry) })
    } catch {
      await setDoc(ref, { entries: [entry] })
    }
  },
  listenCreditTransactions: (cb) => fsListen('cga/creditTransactions', d => cb(d?.entries ?? [])),
}
