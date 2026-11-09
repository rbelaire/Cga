import { useEffect, useMemo, useState } from 'react'
import { DB } from '../db'
import { useAuth } from '../context/AuthContext'
import { ClubContext } from './useClub'

function useCloud(listen) {
  const [state, setState] = useState({ data: undefined, ready: false })
  useEffect(() => {
    let alive = true
    const unsubscribe = listen((data) => {
      queueMicrotask(() => {
        if (alive) setState({ data: data ?? null, ready: true })
      })
    })
    return () => {
      alive = false
      unsubscribe?.()
    }
  }, [listen])
  return state
}

export default function ClubProvider({ children }) {
  const { user } = useAuth()
  const members = useCloud(DB.listenMembers)
  const standings = useCloud(DB.listenStandings)
  const poy = useCloud(DB.listenPoy)
  const ptm = useCloud(DB.listenPtm)
  const beginning = useCloud(DB.listenBeginningPtm)
  const credits = useCloud(DB.listenCredits)
  const users = useCloud(DB.listenUsers)
  const scores = useCloud(DB.listenScores)
  const pairings = useCloud(DB.listenPairings)
  const payments = useCloud(DB.listenPayments)
  const paymentMeta = useCloud(DB.listenPaymentMeta)
  const lifecycle = useCloud(DB.listenLifecycle)
  const results = useCloud(DB.listenResults)
  const rules = useCloud(DB.listenPairingRules)
  const changelog = useCloud(DB.listenChangelog)
  const snapshots = useCloud(DB.listenSnapshots)
  const status = useCloud(DB.listenTournamentStatus)
  const ready = [members, scores, payments, standings, poy, ptm, results, status].every((item) => item.ready)

  const value = useMemo(() => ({
    ready,
    actor: user?.displayName || user?.email || 'Board member',
    members: members.data || [],
    standings: standings.data || { flights: {} },
    poy: poy.data || { flights: {} },
    ptm: ptm.data || [],
    beginning: beginning.data || [],
    credits: credits.data || {},
    users: users.data || [],
    scores: scores.data || {},
    pairings: pairings.data || {},
    payments: payments.data || {},
    paymentMeta: paymentMeta.data || {},
    lifecycle: lifecycle.data || {},
    results: results.data || {},
    rules: rules.data || [],
    changelog: changelog.data || [],
    snapshots: snapshots.data || [],
    status: status.data || { completed: {} },
  }), [ready, user, members, standings, poy, ptm, beginning, credits, users, scores, pairings, payments, paymentMeta, lifecycle, results, rules, changelog, snapshots, status])

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>
}
