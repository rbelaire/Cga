/**
 * Firestore data-access layer for CGA.
 *
 * Collection layout:
 *   cga/members          – members array
 *   cga/standings        – { flights: { ... } }
 *   cga/poy              – { flights: { ... } }
 *   cga/pairings         – { [tournamentId]: [...] }
 *   cga/credits          – { [memberName]: balance }
 *   cga/results          – { data: { [tid]: resultDoc, ... } }
 *   cga/scores           – { [tid]: { [flight]: [...players] } }  (admin work-in-progress)
 */
import { db } from './firebase'
import {
  doc, getDoc, setDoc, onSnapshot, collection, getDocs,
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
}
