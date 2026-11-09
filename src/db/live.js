import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  limit,
  query,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../lib/firebase/client'
import { normalizePairings } from '../domain/pairings.js'
import { adminEmailsFromUsers } from '../domain/access.js'

const ref = (path) => doc(db, path)

function listenPath(path, present, empty, cb) {
  return onSnapshot(ref(path), (snap) => {
    cb(snap.exists() ? present(snap.data()) : empty)
  }, (error) => cb(empty, error))
}

function listenCollection(name, mapDoc, cb) {
  return onSnapshot(collection(db, name), (snap) => {
    const out = {}
    snap.docs.forEach((item) => { out[item.id] = mapDoc(item.data()) })
    cb(out)
  }, (error) => cb({}, error))
}

function listenMerged(colName, legacyPath, cb) {
  let legacy = []
  let fresh = []
  const emit = () => {
    const seen = new Set()
    const rows = []
    for (const entry of [...fresh, ...legacy]) {
      const key = entry?.id || `${entry?.ts}|${entry?.action || entry?.name}|${entry?.details || ''}`
      if (seen.has(key)) continue
      seen.add(key)
      rows.push(entry)
    }
    cb(rows.sort((a, b) => (b.ts || 0) - (a.ts || 0)))
  }
  const unsubLegacy = onSnapshot(ref(legacyPath), (snap) => {
    legacy = snap.exists() ? (snap.data().entries || []) : []
    emit()
  }, () => { legacy = []; emit() })
  const unsubFresh = onSnapshot(
    query(collection(db, colName), orderBy('ts', 'desc'), limit(200)),
    (snap) => {
      fresh = snap.docs.map((item) => ({ id: item.id, ...item.data() }))
      emit()
    },
    () => { fresh = []; emit() },
  )
  return () => { unsubLegacy(); unsubFresh() }
}

async function appendLog(colName, legacyPath, entry) {
  try {
    await addDoc(collection(db, colName), entry)
  } catch (error) {
    if (error?.code !== 'permission-denied') throw error
    const snap = await getDoc(ref(legacyPath))
    const entries = snap.exists() ? (snap.data().entries || []) : []
    await setDoc(ref(legacyPath), { entries: [entry, ...entries].slice(0, 200) })
  }
}

export function createLiveDb() {
  return {
    listenMembers: (cb) => listenPath('cga/members', (data) => data.list ?? [], [], cb),
    saveMembers: (list) => setDoc(ref('cga/members'), { list }),
    listenStandings: (cb) => listenPath('cga/standings', (data) => data, { flights: {} }, cb),
    saveStandings: (data) => setDoc(ref('cga/standings'), data),
    listenPoy: (cb) => listenPath('cga/poy', (data) => data, { flights: {} }, cb),
    savePoy: (data) => setDoc(ref('cga/poy'), data),
    listenPtm: (cb) => listenPath('cga/ptm', (data) => data.list ?? [], [], cb),
    savePtm: (list) => setDoc(ref('cga/ptm'), { list }),
    listenBeginningPtm: (cb) => listenPath('cga/beginningOfYearPtm', (data) => data.list ?? [], [], cb),
    saveBeginningPtm: (list) => setDoc(ref('cga/beginningOfYearPtm'), { list }),
    listenCredits: (cb) => listenPath('cga/credits', (data) => data.balances ?? {}, {}, cb),
    saveCredits: (balances) => setDoc(ref('cga/credits'), { balances }),
    listenUsers: (cb) => listenPath('cga/users', (data) => data.list ?? [], [], cb),
    saveUsers: (list) => setDoc(ref('cga/users'), { list, adminEmails: adminEmailsFromUsers(list) }),
    listenTournamentStatus: (cb) => listenPath('cga/tournamentStatus', (data) => data, null, cb),
    saveTournamentStatus: (data) => setDoc(ref('cga/tournamentStatus'), data),
    listenPairingRules: (cb) => listenPath('cga/pairingRules', (data) => data.rules ?? [], [], cb),
    savePairingRules: (rules) => setDoc(ref('cga/pairingRules'), { rules }),
    listenChangelog: (cb) => listenMerged('cgaChangelog', 'cga/changelog', cb),
    appendChangelog: (entry) => appendLog('cgaChangelog', 'cga/changelog', entry),
    listenCreditTransactions: (cb) => listenMerged('cgaCreditTx', 'cga/creditTransactions', cb),
    appendCreditTransaction: (entry) => appendLog('cgaCreditTx', 'cga/creditTransactions', entry),
    listenResults: (cb) => listenCollection('cgaResults', (data) => data, cb),
    listenResult: (tid, cb) => onSnapshot(doc(db, 'cgaResults', tid), (snap) => {
      cb(snap.exists() ? snap.data() : null)
    }, (error) => cb(null, error)),
    listenScores: (cb) => listenCollection('cgaScores', (data) => data, cb),
    saveScores: (tid, data) => setDoc(doc(db, 'cgaScores', tid), data),
    listenPairings: (cb) => listenCollection('cgaPairings', (data) => normalizePairings(data).pairings, cb),
    listenPairingsForTournament: (tid, cb) => onSnapshot(doc(db, 'cgaPairings', tid), (snap) => {
      cb(snap.exists() ? normalizePairings({ ...snap.data(), tournament: snap.data().tournament }) : null)
    }, (error) => cb(null, error)),
    savePairings: (tid, groups, meta = {}) => setDoc(doc(db, 'cgaPairings', tid), {
      pairings: groups,
      tournament: meta.tournament || '',
      source: meta.source || 'CGA admin',
    }),
    listenPayments: (cb) => listenCollection('cgaPayments', (data) => data, cb),
    savePayments: (tid, map) => setDoc(doc(db, 'cgaPayments', tid), map),
    listenPaymentMeta: (cb) => listenCollection('cgaPaymentMeta', (data) => data, cb),
    savePaymentMeta: (tid, map) => setDoc(doc(db, 'cgaPaymentMeta', tid), map),
    listenLifecycle: (cb) => listenCollection('cgaLifecycle', (data) => data, cb),
    listenLifecycleForTournament: (tid, cb) => onSnapshot(doc(db, 'cgaLifecycle', tid), (snap) => {
      cb(snap.exists() ? snap.data() : null)
    }, (error) => cb(null, error)),
    saveLifecycle: (tid, data) => setDoc(doc(db, 'cgaLifecycle', tid), data),
    listenSnapshots: (cb) => onSnapshot(
      query(collection(db, 'cgaSnapshots'), orderBy('ts', 'desc'), limit(50)),
      (snap) => cb(snap.docs.map((item) => ({ ...item.data(), _id: item.id }))),
      (error) => cb([], error),
    ),
    appendSnapshot: (entry) => addDoc(collection(db, 'cgaSnapshots'), entry),
    saveResult: (tid, data) => setDoc(doc(db, 'cgaResults', tid), data),
    batchPublish: async ({ tid, resultDoc, standings, poy, members, ptm, status }) => {
      const batch = writeBatch(db)
      batch.set(doc(db, 'cgaResults', tid), resultDoc)
      batch.set(ref('cga/standings'), standings)
      batch.set(ref('cga/poy'), poy)
      if (members) batch.set(ref('cga/members'), { list: members })
      if (ptm) batch.set(ref('cga/ptm'), { list: ptm })
      if (status) batch.set(ref('cga/tournamentStatus'), status)
      await batch.commit()
    },
  }
}
