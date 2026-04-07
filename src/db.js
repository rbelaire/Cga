/**
 * Firestore data-access layer for CGA.
 *
 * Storage layout — designed to stay well under Firestore's 1 MB per-document limit
 * as tournament history grows.
 *
 *   ── Fixed-size documents (bounded, replaced on each write): ─────────────────
 *   cga/members            – { list: [...] }
 *   cga/standings          – { flights: { ... } }
 *   cga/poy                – { flights: { ... } }
 *   cga/credits            – { balances: { ... } }
 *   cga/users              – { list: [...] }
 *   cga/ptm                – { list: [...] }
 *   cga/beginningOfYearPtm – { list: [...] }
 *   cga/changelog          – { entries: [...] }  (admin audit; small per entry)
 *   cga/creditTransactions – { entries: [...] }  (small per entry)
 *
 *   ── Per-tournament collections (one document per tournament ID): ────────────
 *   cgaResults/{tid}     – result document (leaderboard, flightWinners, …)
 *   cgaScores/{tid}      – { [flight]: [...players] }  (admin work-in-progress)
 *   cgaPairings/{tid}    – { pairings: [...], tournament, source? }
 *   cgaPayments/{tid}    – { [memberName]: true }
 *   cgaLifecycle/{tid}   – { pairingsState, memo, payout, … }
 *   cgaPaymentMeta/{tid} – { [memberName]: { creditUsed, … } }
 *
 *   ── Append-only log collection (one Firestore document per entry): ──────────
 *   cgaSnapshots/{autoId} – rollback snapshot (includes full data payload)
 *
 * Rationale: the old approach stored all per-tournament data as nested maps in
 * single documents.  Each new tournament grown those documents; after ~10–20
 * seasons they would exceed Firestore's 1 MB limit and begin failing silently or
 * throwing quota errors.  Using per-tournament documents and a snapshot collection
 * removes that ceiling entirely.
 */

import { db } from './firebase'
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  writeBatch,
  collection,
  query,
  orderBy,
  limit,
  addDoc,
  getDocs,
} from 'firebase/firestore'

const REF = (path) => doc(db, path)

// ── Generic document helpers ─────────────────────────────────────────────────

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

// ── Collection helpers ───────────────────────────────────────────────────────

/**
 * Subscribe to every document in a collection and deliver an { id: data } map
 * on every change.  Returns an unsubscribe function.
 */
function colListen(colName, callback) {
  return onSnapshot(collection(db, colName), snap => {
    const map = {}
    snap.docs.forEach(d => { map[d.id] = d.data() })
    callback(map)
  })
}

/** Subscribe to one document inside a named collection. */
function colDocListen(colName, id, callback) {
  return onSnapshot(doc(db, colName, id), snap => {
    callback(snap.exists() ? snap.data() : null)
  })
}

/** Write one document inside a named collection. */
function colSet(colName, id, data) {
  return setDoc(doc(db, colName, id), data)
}

/** Read one document from a named collection. */
async function colGet(colName, id) {
  const snap = await getDoc(doc(db, colName, id))
  return snap.exists() ? snap.data() : null
}

/** Read every document in a collection into an { id: data } map. */
async function colGetAll(colName) {
  const snap = await getDocs(collection(db, colName))
  const map = {}
  snap.docs.forEach(d => { map[d.id] = d.data() })
  return map
}

/**
 * Batch-write a { [id]: data } map into a collection.
 * Chunks at 499 operations to stay within Firestore's 500-op batch limit.
 */
async function colSetMap(colName, map) {
  const entries = Object.entries(map)
  if (!entries.length) return
  for (let i = 0; i < entries.length; i += 499) {
    const chunk = entries.slice(i, i + 499)
    const batch = writeBatch(db)
    chunk.forEach(([id, data]) => batch.set(doc(db, colName, id), data))
    await batch.commit()
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export const DB = {

  // ── Fixed-size documents ───────────────────────────────────────────────────

  // Members
  getMembers:    () => fsGet('cga/members').then(d => d?.list ?? null),
  saveMembers:   (list) => fsSet('cga/members', { list }),
  listenMembers: (cb)   => fsListen('cga/members', d => cb(d?.list ?? null)),

  // Standings
  getStandings:    () => fsGet('cga/standings'),
  saveStandings:   (data) => fsSet('cga/standings', data),
  listenStandings: (cb)   => fsListen('cga/standings', cb),

  // POY
  getPoy:    () => fsGet('cga/poy'),
  savePoy:   (data) => fsSet('cga/poy', data),
  listenPoy: (cb)   => fsListen('cga/poy', cb),

  // Credits
  getCredits:    () => fsGet('cga/credits').then(d => d?.balances ?? {}),
  saveCredits:   (balances) => fsSet('cga/credits', { balances }),
  listenCredits: (cb) => fsListen('cga/credits', d => cb(d?.balances ?? {})),

  // Users (admin role list)
  getUsers:    () => fsGet('cga/users').then(d => d?.list ?? []),
  saveUsers:   (list) => fsSet('cga/users', { list }),
  listenUsers: (cb) => fsListen('cga/users', d => cb(d?.list ?? [])),

  // PTM history
  getPtm:    () => fsGet('cga/ptm').then(d => d?.list ?? null),
  savePtm:   (list) => fsSet('cga/ptm', { list }),
  listenPtm: (cb)   => fsListen('cga/ptm', d => cb(d?.list ?? null)),

  // Beginning-of-year PTM snapshot (Most/Least Improved)
  getBeginningPtm:    () => fsGet('cga/beginningOfYearPtm').then(d => d?.list ?? null),
  saveBeginningPtm:   (list) => fsSet('cga/beginningOfYearPtm', { list }),
  listenBeginningPtm: (cb) => fsListen('cga/beginningOfYearPtm', d => cb(d?.list ?? null)),

  // Changelog / audit log — small entries, safe as an array
  appendChangelog: async (entry) => {
    const ref = REF('cga/changelog')
    try {
      await updateDoc(ref, { entries: arrayUnion(entry) })
    } catch {
      await setDoc(ref, { entries: [entry] })
    }
  },
  listenChangelog: (cb) => fsListen('cga/changelog', d => cb(d?.entries ?? [])),

  // Credit transaction log — small entries, safe as an array
  appendCreditTransaction: async (entry) => {
    const ref = REF('cga/creditTransactions')
    try {
      await updateDoc(ref, { entries: arrayUnion(entry) })
    } catch {
      await setDoc(ref, { entries: [entry] })
    }
  },
  appendCreditTransactions: async (entries = []) => {
    if (!entries.length) return
    const ref = REF('cga/creditTransactions')
    try {
      await updateDoc(ref, { entries: arrayUnion(...entries) })
    } catch {
      await setDoc(ref, { entries })
    }
  },
  saveCreditTransactions: (entries = []) => fsSet('cga/creditTransactions', { entries }),
  listenCreditTransactions: (cb) => fsListen('cga/creditTransactions', d => cb(d?.entries ?? [])),

  // ── Per-tournament collections ─────────────────────────────────────────────
  // Each tournament's data lives in its own document, so the collection grows
  // safely without any single document approaching the 1 MB Firestore limit.

  // Pairings — cgaPairings/{tid}
  getPairings:    () => colGetAll('cgaPairings'),
  savePairings:   (map) => colSetMap('cgaPairings', map),
  listenPairings: (cb)  => colListen('cgaPairings', cb),
  // Targeted listener for public pages — avoids loading every tournament's data
  listenPairingsForTournament: (tid, cb) => colDocListen('cgaPairings', tid, cb),

  // Score entry work-in-progress — cgaScores/{tid}
  getScores:    () => colGetAll('cgaScores'),
  saveScores:   (map) => colSetMap('cgaScores', map),
  listenScores: (cb)  => colListen('cgaScores', cb),

  // Tournament results — cgaResults/{tid}
  getResult:      (tid) => colGet('cgaResults', tid),
  saveResult:     (tid, data) => colSet('cgaResults', tid, data),
  saveResultsMap: (map) => colSetMap('cgaResults', map),
  listenResult:   (tid, cb) => colDocListen('cgaResults', tid, cb),
  listenResults:  (cb)  => colListen('cgaResults', cb),

  // Payments — cgaPayments/{tid}
  getPayments:    () => colGetAll('cgaPayments'),
  savePayments:   (map) => colSetMap('cgaPayments', map),
  listenPayments: (cb)  => colListen('cgaPayments', cb),

  // Tournament lifecycle metadata — cgaLifecycle/{tid}
  getTournamentLifecycle:    () => colGetAll('cgaLifecycle'),
  saveTournamentLifecycle:   (map) => colSetMap('cgaLifecycle', map),
  listenTournamentLifecycle: (cb)  => colListen('cgaLifecycle', cb),
  // Targeted listener for public pages
  listenLifecycleForTournament: (tid, cb) => colDocListen('cgaLifecycle', tid, cb),

  // Payment metadata — cgaPaymentMeta/{tid}
  getPaymentMeta:    () => colGetAll('cgaPaymentMeta'),
  savePaymentMeta:   (map) => colSetMap('cgaPaymentMeta', map),
  listenPaymentMeta: (cb)  => colListen('cgaPaymentMeta', cb),

  // ── Append-only snapshot collection ───────────────────────────────────────
  // Snapshots contain full copies of standings/POY/members and can be 50–100 KB
  // each.  Storing them as individual Firestore documents instead of an array
  // prevents the old cga/snapshots document from hitting the 1 MB limit.

  appendSnapshot: (entry) => addDoc(collection(db, 'cgaSnapshots'), entry),
  listenSnapshots: (cb) => {
    const q = query(
      collection(db, 'cgaSnapshots'),
      orderBy('ts', 'desc'),
      limit(50),
    )
    return onSnapshot(q, snap => cb(snap.docs.map(d => ({ ...d.data(), _id: d.id }))))
  },

  // ── Atomic publish ─────────────────────────────────────────────────────────
  // Writes the result document, updated POY standings, and updated PTM standings
  // in a single Firestore batch so partial writes are impossible.

  batchPublish: async (tid, { resultDoc, newPoy, newStandings }) => {
    const batch = writeBatch(db)
    batch.set(doc(db, 'cgaResults', tid), resultDoc)
    batch.set(REF('cga/poy'), newPoy)
    batch.set(REF('cga/standings'), newStandings)
    await batch.commit()
  },
}
