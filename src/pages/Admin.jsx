import { useState, useMemo, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx-js-style'
import { Link } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import schedule from '../data/schedule.json'
import { formatName, compareByLastName } from '../utils/formatName'
import { formatDateFull } from '../utils/formatDate'
import { DB } from '../db'
import { useFireData } from '../hooks/useFireData'
import { useAuth } from '../context/AuthContext'
import { computeTournamentWorkflowState } from '../utils/tournamentWorkflow'
import TeeTag from '../components/ui/TeeTag'
import CountdownTimer from '../components/ui/CountdownTimer'
import { getCurrentTournaments, getPastTournaments } from '../utils/tournamentFilters'
import cgaPayVenmo from '../../cga-pay-venmo.jpg'
import { createAdminAuditEntry } from '../services/admin/auditService'
import { buildPublishPayload } from '../services/admin/publishService'
import { createSnapshotEntry, getSnapshotLabel } from '../services/admin/snapshotService'
import {
  formatValidationErrors,
  validateCredits,
  validateMembers,
  validatePairingsForTournament,
  validatePayments,
  validatePublishPayload,
  validateScoresForTournament,
  validateTournamentId,
  validateUsers,
} from '../services/admin/validation'
import {
  exportPairingsPDF as exportPairingsPdfV2,
  exportFieldRosterPDF as exportFieldRosterPdfV2,
  exportPtmPDF as exportPtmPdfV2,
  exportResultsPDF as exportResultsPdfV2,
  exportTournamentInfoPDF as exportTournamentInfoPdfV2,
} from '../exports/pdfExports'
import { FLIGHT_ORDER, NEW_PLAYERS_FLIGHT } from '../utils/flightOrder'
import { calcPtmFromHistory } from '../utils/roundPtm'
import { calcFlightPOY } from '../utils/poy'
import { fmtPM, fmtPOY, fmtPtmValue } from '../utils/adminFormat'
import {
  DashboardIcon, ReceiptIcon, UsersIcon, GolfFlagIcon, ExportIcon,
  FolderIcon, ArchiveIcon, ClockListIcon, LayersIcon, LockIcon,
} from './admin/icons'
import { flightTagStyles, XlsxBtn, PdfBtn, ConfirmModal, SaveBtn } from './admin/ui'
import { exportCreditsPDF } from '../exports/creditsPdf'
import {
  parseRosterXlsx,
  exportCreditsXLSX,
  exportResultsXLSX,
  exportBirdiePoolXLSX,
  exportPayoutDocXLSX,
  exportPaymentsXLSX,
  exportPtmXLSX,
} from '../exports/xlsxExports'
import { AdminPaymentsPanel } from './admin/AdminPaymentsPanel'
import { AdminFlightCalculatorPanel } from './admin/AdminFlightCalculatorPanel'
import { FlightManagementPanel } from './admin/FlightManagementPanel'
import { PairingsPanel } from './admin/PairingsPanel'
import { ScoreEntryPanel } from './admin/ScoreEntryPanel'
import { UsersPanel } from './admin/UsersPanel'
import { ExportPanel } from './admin/ExportPanel'
import { DashboardPanel } from './admin/DashboardPanel'
import { ChangelogPanel } from './admin/ChangelogPanel'
import { SnapshotsPanel } from './admin/SnapshotsPanel'
import { RetroEligibilityPanel } from './admin/RetroEligibilityPanel'
import { BeginningPtmPanel } from './admin/BeginningPtmPanel'
import { PublishConfirmModal } from './admin/PublishConfirmModal'

const FLIGHTS              = FLIGHT_ORDER
const DEFAULT_PAIRING_ROWS = 15
const STORAGE_KEY  = 'cga_admin_v1'
const PAIRINGS_KEY = 'cga_pairings_v1'
const MEMBERS_KEY  = 'cga_members_v1'
const CREDITS_KEY  = 'cga_credits_v1'
const PAYMENTS_KEY = 'cga_payments_v1'
const USERS_KEY = 'cga_users_v1'
const TOURNAMENT_INFO_KEY = 'cga_tournament_info_v1'
const TOURNAMENT_LIFECYCLE_KEY = 'cga_tournament_lifecycle_v1'
const PAYMENT_META_KEY = 'cga_payment_meta_v1'
const PAIRING_RULES_KEY = 'cga_pairing_rules_v1'
const EXTRA_FLIGHTS_KEY = 'cga_extra_flights_v1'
const MAX_RECENT_ACTIONS = 5





async function withSaveState(setSaving, setSaveStatus, fn, setErrMsg = null) {
  setSaving(true)
  setSaveStatus(null)
  try {
    await fn()
    setSaveStatus('ok')
    return true
  } catch (e) {
    console.error('Firestore save error:', e)
    setSaveStatus('err')
    setErrMsg?.(e?.message || String(e) || 'Unknown error')
    return false
  } finally {
    setSaving(false)
    setTimeout(() => setSaveStatus(null), 3000)
  }
}

function toMoney(value) {
  // Round via integer arithmetic to avoid floating-point accumulation
  return Math.round((Number(value) || 0) * 100) / 100
}

function createCreditTxn({ name, tournamentId, creditUsed, user }) {
  return {
    id: `credit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    ts: Date.now(),
    name,
    tournamentId,
    type: 'entry_credit_applied',
    amount: toMoney(creditUsed),
    user: user || 'Admin',
  }
}


function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableSerialize(value[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function cloneForUndo(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function sanitizePairingsForCompare(pairingsByTournament = {}) {
  const next = {}
  Object.entries(pairingsByTournament || {}).forEach(([tournamentId, cards]) => {
    if (!Array.isArray(cards)) return
    const normalizedCards = cards
      .map((card, idx) => ({
        pairing: card?.pairing ?? `Pairing ${idx + 1}`,
        players: Array.isArray(card?.players)
          ? card.players
            .filter(player => player?.name)
            .map(player => ({ name: player.name, flight: player.flight ?? null }))
          : [],
      }))
      .filter(card => card.players.length > 0)
    if (normalizedCards.length > 0) next[tournamentId] = normalizedCards
  })
  return next
}

function sanitizeLifecycleForPairings(lifecycleByTournament = {}) {
  const next = {}
  Object.entries(lifecycleByTournament || {}).forEach(([tournamentId, state]) => {
    if (!state || typeof state !== 'object') return
    const pairingsState = state.pairingsState ?? null
    const pairingsPublishedAt = state.pairingsPublishedAt ?? null
    if (!pairingsState && !pairingsPublishedAt) return
    if (pairingsState === 'none' && !pairingsPublishedAt) return
    next[tournamentId] = { pairingsState, pairingsPublishedAt }
  })
  return next
}

function sanitizeMembersForCompare(members = [], overrides = {}) {
  const next = {}
  members.forEach(member => {
    const local = overrides?.[member.name] ?? {}
    next[member.name] = {
      flight: local.flight ?? member.flight ?? null,
      ptm: local.ptm ?? member.ptm ?? null,
      tee: local.tee ?? member.tee ?? null,
      cell: local.cell ?? member.cell ?? null,
    }
  })
  return next
}

function hasMeaningfulChanges(saved, working) {
  return stableSerialize(saved) !== stableSerialize(working)
}

// ── PDF: Tournament Info ───────────────────────────────────────────────────────
async function exportTournamentInfoPDF(tournament, { onAssetWarning } = {}) {
  if (!tournament) return
  await exportTournamentInfoPdfV2({
    tournament,
    logoUrl: `${import.meta.env.BASE_URL}cga-logo.png`,
    venmoImageUrl: cgaPayVenmo,
    onAssetWarning,
  })
}

// ── PDF: Pairings ──────────────────────────────────────────────────────────────
async function exportPairingsPDF(tournament, pairings) {
  if (!tournament || !pairings.length) return
  await exportPairingsPdfV2({
    tournament,
    pairings,
    logoUrl: `${import.meta.env.BASE_URL}cga-logo.png`,
  })
}

// ── PDF: Points to Make ────────────────────────────────────────────────────────
async function exportPtmPDF(membersList, ptmList = [], preTournamentByName = {}) {
  const ptmByName = Object.fromEntries((ptmList || []).map(p => [p.name, p]))
  const enriched = membersList.map(m => {
    const p = ptmByName[m.name]
    const base = p ? { ...m, history: p.history ?? m.history } : m
    const pre = preTournamentByName[m.name]
    return pre?.ptm != null ? { ...base, ptm: pre.ptm } : base
  })
  await exportPtmPdfV2({
    members: enriched,
    logoUrl: `${import.meta.env.BASE_URL}cga-logo.png`,
  })
}

// ── PDF: Tournament Results ────────────────────────────────────────────────────
async function exportResultsPDF(tournament, flightData) {
  if (!tournament) return
  await exportResultsPdfV2({
    tournament,
    flightData,
    flights: FLIGHTS,
    calcFlightPOY,
    logoUrl: `${import.meta.env.BASE_URL}cga-logo.png`,
  })
}

// ── Excel button component ────────────────────────────────────────────────────
// ── PDF: Field Roster ────────────────────────────────────────────────────────
async function exportPaymentsPDF(tournament, paymentMap, membersList, preTournamentByName = {}) {
  if (!tournament) return
  const members = membersList.map(m => {
    const pre = preTournamentByName[m.name]
    if (!pre) return m
    return { ...m, flight: pre.flight ?? m.flight, ...(pre.ptm != null ? { ptm: pre.ptm } : {}) }
  })
  await exportFieldRosterPdfV2({
    tournament,
    paymentMap,
    members,
    flights: [...FLIGHTS, NEW_PLAYERS_FLIGHT],
    logoUrl: `${import.meta.env.BASE_URL}cga-logo.png`,
  })
}

// ── Auth gate ──────────────────────────────────────────────────────────────────
export default function Admin() {
  const { user, profile, isAdmin, loading } = useAuth()
  const currentUser = profile?.displayName || user?.displayName || user?.email || 'Admin'

  if (loading) {
    return <div className="flex-1 flex items-center justify-center py-24 text-sm text-gray-500">Loading…</div>
  }

  if (!isAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24">
        <LockIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h1 className="font-heading text-xl font-bold text-darktext mb-2">Admin Access Required</h1>
        <p className="text-sm text-gray-500 mb-1">Your account (<span className="font-mono">{user?.email}</span>) does not have admin privileges.</p>
        <p className="text-xs text-gray-400">Contact the site administrator to request access.</p>
      </div>
    )
  }

  return <AdminPanel currentUser={currentUser} />
}

// ── Admin panel ────────────────────────────────────────────────────────────────
function AdminPanel({ currentUser }) {
  // Live data from Firebase
  const { data: membersData = [] } = useFireData(DB.listenMembers, [])
  const { data: currentStandings } = useFireData(DB.listenStandings, { flights: {} })
  const { data: currentPoy } = useFireData(DB.listenPoy, { flights: {} })
  const { data: livePtmData } = useFireData(DB.listenPtm, [])
  const { data: cloudScores = {} } = useFireData(DB.listenScores, {})
  const { data: cloudPairings = {} } = useFireData(DB.listenPairings, {})
  const { data: cloudPayments = {} } = useFireData(DB.listenPayments, {})
  const { data: cloudCredits = {} } = useFireData(DB.listenCredits, {})
  const { data: cloudUsers = [] } = useFireData(DB.listenUsers, [])
  const { data: allResults = {} } = useFireData(DB.listenResults, {})
  const { data: cloudTournamentLifecycle = {} } = useFireData(DB.listenTournamentLifecycle, {})
  const { data: cloudPaymentMeta = {} } = useFireData(DB.listenPaymentMeta, {})
  const { data: cloudCreditTransactions = [] } = useFireData(DB.listenCreditTransactions, [])
  const { data: changelog = [] } = useFireData(DB.listenChangelog, [])
  const { data: snapshots = [] } = useFireData(DB.listenSnapshots, [])
  const { data: liveTournamentStatus } = useFireData(DB.listenTournamentStatus, null)

  // Tournament score entry data
  const [data, setData] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
  })
  // Pairings data
  const [pairingsData, setPairingsData] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PAIRINGS_KEY)) || {} } catch { return {} }
  })
  // Flight/PTM overrides (flight management tab)
  const [membersOverride, setMembersOverride] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(MEMBERS_KEY))
      if (saved) return saved
    } catch { /* ignore */ }
    // Default: build from membersData
    return Object.fromEntries((membersData || []).map(m => [m.name, { flight: m.flight, ptm: m.ptm }]))
  })

  const [credits, setCredits] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CREDITS_KEY)) || {} } catch { return {} }
  })

  // Payments: { [tid]: { [memberName]: true } }
  const [payments, setPayments] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PAYMENTS_KEY)) || {} } catch { return {} }
  })
  const [usersDraft, setUsersDraft] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || [] } catch { return [] }
  })
  const [tournamentInfoDrafts, setTournamentInfoDrafts] = useState(() => {
    try { return JSON.parse(localStorage.getItem(TOURNAMENT_INFO_KEY)) || {} } catch { return {} }
  })
  const [tournamentLifecycle, setTournamentLifecycle] = useState(() => {
    try { return JSON.parse(localStorage.getItem(TOURNAMENT_LIFECYCLE_KEY)) || {} } catch { return {} }
  })
  const [paymentMeta, setPaymentMeta] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PAYMENT_META_KEY)) || {} } catch { return {} }
  })
  const [pairingsDirtyTouched, setPairingsDirtyTouched] = useState(false)
  const [membersDirtyTouched, setMembersDirtyTouched] = useState(false)
  // Pairing rules: [{ id, type: 'always'|'never', players: string[] }]
  const [pairingRules, setPairingRules] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PAIRING_RULES_KEY)) || [] } catch { return [] }
  })

  // Extra custom flights (beyond FLIGHT_ORDER), always rendered before New Players
  const [extraFlights, setExtraFlights] = useState(() => {
    try { return JSON.parse(localStorage.getItem(EXTRA_FLIGHTS_KEY)) || [] } catch { return [] }
  })

  const ALL_SCORE_TABS = useMemo(
    () => [...FLIGHTS, ...extraFlights.filter(f => f && f !== NEW_PLAYERS_FLIGHT && !FLIGHTS.includes(f)), NEW_PLAYERS_FLIGHT],
    [extraFlights]
  )

  const currentTournaments = useMemo(() => getCurrentTournaments(schedule), [])
  const pastTournaments = useMemo(() => getPastTournaments(schedule), [])
  const defaultTournamentId = currentTournaments[0]?.id ?? pastTournaments[0]?.id ?? schedule[0]?.id ?? ''

  // Tournaments that exist in Firestore results but are not in the current schedule.json
  // (e.g. previous seasons). Build a minimal tournament object from the stored result doc.
  const archivedTournaments = useMemo(() => {
    const scheduleIds = new Set(schedule.map(t => t.id))
    return Object.entries(allResults)
      .filter(([id]) => !scheduleIds.has(id))
      .map(([id, r]) => ({ id, name: r.name ?? id, date: r.date ?? '', course: r.course ?? '', archived: true }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [allResults])

  const [tid,          setTid]          = useState(defaultTournamentId)
  const [poolSearch,   setPoolSearch]   = useState('')
  const [selectedPool, setSelectedPool] = useState(new Set())
  const [adminMode,    setAdminMode]    = useState('dashboard')
  const [paymentSearch, setPaymentSearch] = useState('')
  const [paymentCreditInputs, setPaymentCreditInputs] = useState({})
  const [userSearch, setUserSearch] = useState('')
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'member' })
  const [showTournamentInfoEditor, setShowTournamentInfoEditor] = useState(false)
  const [showPastTournaments, setShowPastTournaments] = useState(false)
  // Global save error banner
  const [adminError, setAdminError] = useState(null)  // string | null

  // Save states: null | 'ok' | 'err'
  const [scoresSaving,   setScoresSaving]   = useState(false)
  const [scoresSaveStatus, setScoresSaveStatus] = useState(null)
  const [pairingsSaving, setPairingsSaving] = useState(false)
  const [pairingsSaveStatus, setPairingsSaveStatus] = useState(null)
  const [membersSaving,  setMembersSaving]  = useState(false)
  const [membersSaveStatus, setMembersSaveStatus] = useState(null)
  const [flightsSaving,  setFlightsSaving]  = useState(false)
  const [flightsSaveStatus, setFlightsSaveStatus] = useState(null)
  const [creditsSaving,  setCreditsSaving]  = useState(false)
  const [creditsSaveStatus, setCreditsSaveStatus] = useState(null)
  const [paymentsSaving,  setPaymentsSaving]  = useState(false)
  const [paymentsSaveStatus, setPaymentsSaveStatus] = useState(null)
  const [usersSaving,  setUsersSaving]  = useState(false)
  const [usersSaveStatus, setUsersSaveStatus] = useState(null)
  const [publishSaving,  setPublishSaving]  = useState(false)
  const [publishSaveStatus, setPublishSaveStatus] = useState(null)
  const [publishPreview, setPublishPreview] = useState(null)
  const [saveAllSaving, setSaveAllSaving] = useState(false)
  const [saveAllStatus, setSaveAllStatus] = useState(null)

  // pairings manual mode
  const [manualPairings,   setManualPairings]   = useState(false)
  const [selectedUnpaired, setSelectedUnpaired] = useState(null)

  // flight management edit state
  const [flightSearch,  setFlightSearch]  = useState('')
  // Excel import state
  const [importPreview,  setImportPreview]  = useState(null)   // { matched, unmatched } | null
  const [importSaving,   setImportSaving]   = useState(false)
  const [importStatus,   setImportStatus]   = useState(null)   // null | 'ok' | 'err'
  const [importError,    setImportError]    = useState(null)   // error message | null
  const fileInputRef = useRef(null)
  const [recentActions, setRecentActions] = useState([])
  const actionIdCounterRef = useRef(0)
  const lifecycleStampRef = useRef(0)
  const [actionFeedback, setActionFeedback] = useState(null)
  const [pendingConfirm, setPendingConfirm] = useState(null) // { message, resolve }

  // In-app replacement for window.confirm — returns a Promise<boolean>
  function openConfirm(message) {
    return new Promise(resolve => setPendingConfirm({ message, resolve }))
  }
  function resolveConfirm(result) {
    pendingConfirm?.resolve(result)
    setPendingConfirm(null)
  }

  function logChange(action, details = '') {
    const entry = createAdminAuditEntry({
      action,
      details,
      tournamentId: tid || null,
      user: currentUser || 'Admin',
    })
    DB.appendChangelog(entry).catch(err => console.warn('[CGA] Failed to write changelog entry:', err))
  }

  function blockOnValidation(errors) {
    const message = formatValidationErrors(errors)
    if (!message) return false
    setAdminError(message)
    return true
  }

  async function saveSnapshot(type, previousData, details = '', tournamentId = tid || null) {
    if (previousData == null) return
    const entry = createSnapshotEntry({
      type,
      data: cloneForUndo(previousData),
      user: currentUser || 'Admin',
      tournamentId,
      details,
    })
    await DB.appendSnapshot(entry)
  }

  async function restoreSnapshot(entry) {
    if (!entry?.type) return
    const label = getSnapshotLabel(entry)
    if (!await openConfirm(`Restore ${label}? Current live data for ${entry.type} will be overwritten.`)) return

    // Validate snapshot data before writing to prevent propagating corrupted snapshots
    const memberNames = (membersData ?? []).map(m => m.name)
    const preRestoreValidators = {
      members:  (data) => validateMembers(Array.isArray(data) ? data : []),
      users:    (data) => validateUsers(Array.isArray(data) ? data : []),
      credits:  (data) => validateCredits(data && typeof data === 'object' ? data : {}, memberNames),
      payments: (data) => validatePayments(data && typeof data === 'object' ? data : {}, schedule, memberNames),
    }
    const preValidator = preRestoreValidators[entry.type]
    if (preValidator) {
      const validationErrors = preValidator(entry.data)
      if (validationErrors.length) {
        setAdminError(`Snapshot validation failed — ${formatValidationErrors(validationErrors)}`)
        return
      }
    }

    const restoreMap = {
      scores: () => DB.saveScores(entry.data),
      pairings: () => DB.savePairings(entry.data),
      members: () => DB.saveMembers(entry.data),
      credits: () => DB.saveCredits(entry.data),
      payments: () => DB.savePayments(entry.data),
      users: () => DB.saveUsers(entry.data),
      'credit-transactions': () => DB.saveCreditTransactions(entry.data),
      standings: () => DB.saveStandings(entry.data),
      poy: () => DB.savePoy(entry.data),
      results: () => {
        if (!entry.tid) throw new Error('Result snapshot is missing tournament reference.')
        return DB.saveResult(entry.tid, entry.data)
      },
    }

    const restore = restoreMap[entry.type]
    if (!restore) {
      setAdminError(`Restore is not supported for snapshot type: ${entry.type}`)
      return
    }

    const ok = await withSaveState(setSaveAllSaving, setSaveAllStatus, async () => {
      await restore()
    }, setAdminError)

    if (ok) {
      logChange('Snapshot restored', `${entry.type}${entry.tid ? ` (${entry.tid})` : ''}`)
      setActionFeedback(`Restored snapshot: ${label}`)
    }
  }

  function registerUndoAction({ label, undo }) {
    actionIdCounterRef.current += 1
    const action = {
      id: `action-${actionIdCounterRef.current}`,
      label,
      undo,
      createdAt: new Date().toISOString(),
    }
    setRecentActions(prev => [action, ...prev].slice(0, MAX_RECENT_ACTIONS))
    setActionFeedback(`Action saved: ${label}`)
  }

  function nextLifecycleStamp() {
    lifecycleStampRef.current += 1
    return new Date(Date.UTC(new Date().getFullYear(), 0, 1, 0, 0, lifecycleStampRef.current)).toISOString()
  }

  function undoRecentAction(actionId) {
    setRecentActions(prev => {
      const action = prev.find(item => item.id === actionId)
      if (!action) return prev
      action.undo?.()
      setActionFeedback(`Undid: ${action.label}`)
      return prev.filter(item => item.id !== actionId)
    })
  }

  // Draft-cache to localStorage (unchanged — keeps data across page refreshes)
  useEffect(() => { localStorage.setItem(STORAGE_KEY,  JSON.stringify(data))            }, [data])
  useEffect(() => { localStorage.setItem(PAIRINGS_KEY, JSON.stringify(pairingsData))    }, [pairingsData])
  useEffect(() => { localStorage.setItem(MEMBERS_KEY,  JSON.stringify(membersOverride)) }, [membersOverride])
  useEffect(() => { localStorage.setItem(CREDITS_KEY,  JSON.stringify(credits))         }, [credits])
  useEffect(() => { localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments))       }, [payments])
  useEffect(() => { localStorage.setItem(USERS_KEY, JSON.stringify(usersDraft))       }, [usersDraft])
  useEffect(() => { localStorage.setItem(TOURNAMENT_INFO_KEY, JSON.stringify(tournamentInfoDrafts)) }, [tournamentInfoDrafts])
  useEffect(() => { localStorage.setItem(TOURNAMENT_LIFECYCLE_KEY, JSON.stringify(tournamentLifecycle)) }, [tournamentLifecycle])
  useEffect(() => { localStorage.setItem(PAYMENT_META_KEY, JSON.stringify(paymentMeta)) }, [paymentMeta])
  useEffect(() => { localStorage.setItem(PAIRING_RULES_KEY, JSON.stringify(pairingRules)) }, [pairingRules])
  useEffect(() => { localStorage.setItem(EXTRA_FLIGHTS_KEY, JSON.stringify(extraFlights)) }, [extraFlights])
  useEffect(() => {
    if (!actionFeedback) return
    const timer = setTimeout(() => setActionFeedback(null), 3500)
    return () => clearTimeout(timer)
  }, [actionFeedback])

  const tournament     = schedule.find(t => t.id === tid) ?? archivedTournaments.find(t => t.id === tid)
  const nextTournament = currentTournaments[0] ?? pastTournaments[0] ?? null
  // For archived tournaments, live scores may be absent; fall back to the published leaderboard.
  const effectiveFlightData = useMemo(() => {
    const live = data[tid] ?? {}
    const hasLive = Object.values(live).some(fl => Array.isArray(fl) && fl.length > 0)
    return hasLive ? live : (allResults[tid]?.leaderboard ?? {})
  }, [data, tid, allResults])

  // Per-player pre-tournament data (flight + PTM from score rows or published leaderboard)
  const preTournamentPlayerData = useMemo(() => {
    const lookup = {}
    for (const [flight, rows] of Object.entries(effectiveFlightData)) {
      if (!Array.isArray(rows)) continue
      for (const p of rows) {
        if (p.name) lookup[p.name] = { flight, ptm: p.ptm ?? null }
      }
    }
    return lookup
  }, [effectiveFlightData])

  const tournamentInfo = tournament ? { ...tournament, ...(tournamentInfoDrafts[tournament.id] ?? {}) } : null
  const nextTournamentInfo = nextTournament ? { ...nextTournament, ...(tournamentInfoDrafts[nextTournament.id] ?? {}) } : null
  const totalPlayers = ALL_SCORE_TABS.reduce((sum, f) => sum + (data[tid]?.[f]?.length ?? 0), 0)

  // All names entered for this tournament across all flights
  const allAddedNames = useMemo(() => {
    const names = new Set()
    for (const fl of ALL_SCORE_TABS) {
      for (const p of (data[tid]?.[fl] ?? [])) names.add(p.name)
    }
    return names
  }, [data, tid])

  // Effective members list (uses overrides for flight/ptm/tee/name/active)
  const effectiveMembers = useMemo(() => {
    return membersData.map(m => ({
      ...m,
      originalName: m.name,
      name:   membersOverride[m.name]?.name   ?? m.name,
      flight: membersOverride[m.name]?.flight ?? m.flight,
      ptm:    membersOverride[m.name]?.ptm    ?? m.ptm,
      tee:    membersOverride[m.name]?.tee    ?? m.tee,
      active: membersOverride[m.name]?.active ?? m.active,
      cell:   membersOverride[m.name]?.cell   ?? m.cell,
    }))
  }, [membersData, membersOverride])

  const ptmLookup = useMemo(
    () => Object.fromEntries(effectiveMembers.map(m => [m.name, m.ptm])),
    [effectiveMembers]
  )

  // Players entered (paid) in the current tournament — used by the flight calculator
  const enteredPlayers = useMemo(() =>
    effectiveMembers
      .filter(m => m.active !== false && (payments[tid] ?? {})[m.name])
      .slice()
      .sort((a, b) => (b.ptm ?? 0) - (a.ptm ?? 0)),
    [effectiveMembers, payments, tid]
  )

  const memberFlightLookup = useMemo(
    () => Object.fromEntries(effectiveMembers.map(m => [m.name, m.flight])),
    [effectiveMembers]
  )

  const roundsLookup = useMemo(
    () => Object.fromEntries(effectiveMembers.map(m => [m.name, m.rounds ?? 0])),
    [effectiveMembers]
  )

  // Payments for selected tournament

  useEffect(() => {
    if (!tid) {
      setTid(defaultTournamentId)
      return
    }
    const exists = schedule.some(t => t.id === tid) || archivedTournaments.some(t => t.id === tid)
    if (!exists) setTid(defaultTournamentId)
  }, [tid, defaultTournamentId, archivedTournaments])

  // Track last Firestore snapshots so we only overwrite local state when the user
  // hasn't made edits on top of the previous cloud value.
  const prevCloudUsersRef = useRef(undefined)
  const prevCloudLifecycleRef = useRef(undefined)
  const prevCloudPaymentMetaRef = useRef(undefined)
  const prevCloudScoresRef = useRef(undefined)

  useEffect(() => {
    setUsersDraft(prev => {
      const prevCloud = prevCloudUsersRef.current
      prevCloudUsersRef.current = cloudUsers
      // First snapshot or local still matches previous cloud → safe to update
      if (prevCloud === undefined || stableSerialize(prev) === stableSerialize(prevCloud)) return cloudUsers
      return prev // local edits exist; preserve them
    })
  }, [cloudUsers])
  useEffect(() => {
    setTournamentLifecycle(prev => {
      const prevCloud = prevCloudLifecycleRef.current
      prevCloudLifecycleRef.current = cloudTournamentLifecycle
      if (prevCloud === undefined || stableSerialize(prev) === stableSerialize(prevCloud)) return cloudTournamentLifecycle
      return prev
    })
  }, [cloudTournamentLifecycle])
  useEffect(() => {
    setPaymentMeta(prev => {
      const prevCloud = prevCloudPaymentMetaRef.current
      prevCloudPaymentMetaRef.current = cloudPaymentMeta
      if (prevCloud === undefined || stableSerialize(prev) === stableSerialize(prevCloud)) return cloudPaymentMeta
      return prev
    })
  }, [cloudPaymentMeta])
  useEffect(() => {
    setData(prev => {
      const prevCloud = prevCloudScoresRef.current
      prevCloudScoresRef.current = cloudScores
      // First snapshot: preserve any local data; only adopt cloud when local is empty
      if (prevCloud === undefined) {
        const hasLocal = Object.values(prev).some(t =>
          Object.values(t || {}).some(f => Array.isArray(f) && f.length > 0)
        )
        return hasLocal ? prev : cloudScores
      }
      if (stableSerialize(prev) === stableSerialize(prevCloud)) return cloudScores
      return prev
    })
  }, [cloudScores])

  // Keep score-entry PTMs fresh: when member PTMs change (Player Management save,
  // publish of another tournament, etc.), update any rows that haven't been scored yet.
  useEffect(() => {
    if (!tid || Object.keys(ptmLookup).length === 0) return
    setData(prev => {
      const td = prev[tid]
      if (!td) return prev
      let anyChanged = false
      const newTd = { ...td }
      for (const fl of Object.keys(newTd)) {
        const players = newTd[fl]
        if (!Array.isArray(players)) continue
        const updated = players.map(p => {
          const latestPtm = ptmLookup[p.name]
          if (latestPtm == null) return p
          if (p.score !== '' && p.score != null) return p  // score entered — leave PTM alone
          if (p.ptm === latestPtm) return p
          anyChanged = true
          return { ...p, ptm: latestPtm }
        })
        newTd[fl] = updated
      }
      return anyChanged ? { ...prev, [tid]: newTd } : prev
    })
  }, [ptmLookup, tid]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-set eligible based on rounds: players with fewer than 7 rounds are
  // ineligible for POY. Runs whenever member data or tournament changes.
  useEffect(() => {
    if (!tid || Object.keys(roundsLookup).length === 0) return
    setData(prev => {
      const td = prev[tid]
      if (!td) return prev
      let anyChanged = false
      const newTd = { ...td }
      for (const fl of Object.keys(newTd)) {
        const players = newTd[fl]
        if (!Array.isArray(players)) continue
        const updated = players.map(p => {
          const rounds = roundsLookup[p.name] ?? 0
          const shouldBeEligible = rounds >= 7
          if ((p.eligible !== false) === shouldBeEligible) return p
          anyChanged = true
          return { ...p, eligible: shouldBeEligible }
        })
        newTd[fl] = updated
      }
      return anyChanged ? { ...prev, [tid]: newTd } : prev
    })
  }, [roundsLookup, tid]) // eslint-disable-line react-hooks/exhaustive-deps

  const paymentMap = payments[tid] ?? {}

  // Pool members (not yet in this tournament), grouped by season flight
  const poolMembersGrouped = useMemo(() => {
    const search   = poolSearch.trim().toLowerCase()
    const filtered = effectiveMembers.filter(m =>
      !allAddedNames.has(m.name) &&
      (search === '' || m.name.toLowerCase().includes(search) || formatName(m.name).toLowerCase().includes(search))
    )
    const knownFlights = [...FLIGHTS, NEW_PLAYERS_FLIGHT, ...extraFlights]
    const groups = {}
    for (const f of [...knownFlights, null]) {
      const key = f ?? '__unassigned__'
      groups[key] = filtered
        .filter(m => f === null ? !knownFlights.includes(m.flight) : m.flight === f)
        .map(m => ({ ...m, isPaid: !!payments[tid]?.[m.name] }))
        .sort(compareByLastName)
    }
    return groups
  }, [allAddedNames, poolSearch, effectiveMembers, extraFlights, payments, tid])

  const poolTotalCount = useMemo(
    () => Object.values(poolMembersGrouped).reduce((s, g) => s + g.length, 0),
    [poolMembersGrouped]
  )

  // Pairings derived state
  const currentPairings = useMemo(
    () => pairingsData[tid] ?? [],
    [pairingsData, tid]
  )
  const pairedNames     = useMemo(
    () => new Set(currentPairings.flatMap(c => c.players.map(p => p.name))),
    [currentPairings]
  )
  const unpairedPlayers = useMemo(
    () => ALL_SCORE_TABS.flatMap(fl =>
      (data[tid]?.[fl] ?? [])
        .filter(p => !pairedNames.has(p.name))
        .map(p => ({ name: p.name, flight: fl }))
    ).sort((a, b) => compareByLastName(a, b)),
    [data, tid, pairedNames]
  )
  const allEnteredPlayers = useMemo(
    () => ALL_SCORE_TABS.flatMap(fl =>
      (data[tid]?.[fl] ?? []).map(p => ({ name: p.name, flight: fl }))
    ).sort((a, b) => compareByLastName(a, b)),
    [data, tid]
  )
  // ── Score data mutations ──────────────────────────────────────────────────────
  function togglePoolSelect(name) {
    setSelectedPool(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function toggleGroupSelect(groupKey) {
    const group = poolMembersGrouped[groupKey] ?? []
    if (!group.length) return
    setSelectedPool(prev => {
      const next = new Set(prev)
      const allSelected = group.every(m => next.has(m.name))
      if (allSelected) group.forEach(m => next.delete(m.name))
      else group.forEach(m => next.add(m.name))
      return next
    })
  }

  function addSelectedPlayers() {
    const names = [...selectedPool].filter(name => !allAddedNames.has(name))
    if (!names.length) return
    setData(prev => {
      const td = { ...(prev[tid] ?? {}) }
      names.forEach(name => {
        const memberFlight = memberFlightLookup[name]
        const memberPtm = ptmLookup[name]
        const isNewPlayer = memberPtm == null || memberPtm === '' || Number(memberPtm) === 0
        const targetFlight = (!isNewPlayer && ALL_SCORE_TABS.includes(memberFlight)) ? memberFlight : 'New Players'
        const entry = {
          name,
          ptm: memberPtm ?? '',
          score: '',
          eligible: (roundsLookup[name] ?? 0) >= 7,
        }
        td[targetFlight] = [...(td[targetFlight] ?? []), entry]
      })
      return { ...prev, [tid]: td }
    })
    setSelectedPool(new Set())
  }

  function applyScoreImport(parsedRows) {
    const normKey = s => String(s ?? '').trim().toLowerCase()
    // Build member lookup: normalized name → canonical name (also tries Last, First)
    const memberLookup = new Map()
    for (const m of effectiveMembers) {
      memberLookup.set(normKey(m.name), m.name)
      const parts = m.name.trim().split(/\s+/)
      if (parts.length >= 2) {
        const lf = `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}`
        if (!memberLookup.has(normKey(lf))) memberLookup.set(normKey(lf), m.name)
      }
    }
    setData(prev => {
      const td = { ...(prev[tid] ?? {}) }
      // Build a lookup of who is already in score entry: normKey → {flight, idx}
      const entryLookup = new Map()
      for (const fl of ALL_SCORE_TABS) {
        for (let i = 0; i < (td[fl] ?? []).length; i++) {
          entryLookup.set(normKey(td[fl][i].name), { flight: fl, idx: i })
        }
      }
      for (const { name, score, wd } of parsedRows) {
        const canonical = memberLookup.get(normKey(name))
        if (!canonical) continue
        const existing = entryLookup.get(normKey(canonical))
        if (existing) {
          const { flight, idx } = existing
          const fl = [...(td[flight] ?? [])]
          fl[idx] = { ...fl[idx], score: wd ? '' : score, ...(wd ? { wd: true } : { wd: false }) }
          td[flight] = fl
        } else {
          const memberFlight = memberFlightLookup[canonical]
          const memberPtm = ptmLookup[canonical]
          const isNewPlayer = memberPtm == null || memberPtm === '' || Number(memberPtm) === 0
          const targetFlight = (!isNewPlayer && ALL_SCORE_TABS.includes(memberFlight)) ? memberFlight : 'New Players'
          const entry = { name: canonical, ptm: memberPtm ?? '', score: wd ? '' : score, eligible: (roundsLookup[canonical] ?? 0) >= 7, ...(wd ? { wd: true } : {}) }
          td[targetFlight] = [...(td[targetFlight] ?? []), entry]
        }
      }
      return { ...prev, [tid]: td }
    })
  }

  function removePlayerFromFlight(flightName, idx) {
    const flightPlayers = data[tid]?.[flightName] ?? []
    const removedPlayer = flightPlayers[idx]
    if (!removedPlayer) return
    const next = [...flightPlayers]
    next.splice(idx, 1)
    setData(prev => ({ ...prev, [tid]: { ...(prev[tid] ?? {}), [flightName]: next } }))
    registerUndoAction({
      label: `Removed ${removedPlayer.name} from ${flightName}`,
      undo: () => {
        setData(prev => {
          const td = { ...(prev[tid] ?? {}) }
          const fl = [...(td[flightName] ?? [])]
          fl.splice(idx, 0, removedPlayer)
          td[flightName] = fl
          return { ...prev, [tid]: td }
        })
      },
    })
  }

  function updatePlayerInFlight(flightName, idx, field, val) {
    setData(prev => {
      const td = { ...(prev[tid] ?? {}) }
      const fl = [...(td[flightName] ?? [])]
      fl[idx] = { ...fl[idx], [field]: val }
      td[flightName] = fl
      return { ...prev, [tid]: td }
    })
  }

  async function clearFlightByName(flightName) {
    const flightPlayers = data[tid]?.[flightName] ?? []
    if (!await openConfirm(`Clear all players from ${flightName}?`)) return
    const snapshot = cloneForUndo(flightPlayers)
    setData(prev => ({ ...prev, [tid]: { ...(prev[tid] ?? {}), [flightName]: [] } }))
    if (!snapshot?.length) return
    registerUndoAction({
      label: `Cleared ${flightName}`,
      undo: () => {
        setData(prev => ({
          ...prev,
          [tid]: { ...(prev[tid] ?? {}), [flightName]: snapshot },
        }))
      },
    })
  }

  // ── Pairings functions ────────────────────────────────────────────────────────
  function generatePairings() {
    const allPlayers = ALL_SCORE_TABS.flatMap(fl =>
      (data[tid]?.[fl] ?? []).map(p => ({ name: p.name, flight: fl }))
    )
    if (!allPlayers.length) return

    const playerMap = Object.fromEntries(allPlayers.map(p => [p.name, p]))
    const numGroups = Math.ceil(allPlayers.length / 4)
    const groups    = Array.from({ length: numGroups }, () => [])
    const assignedNames = new Set()

    // ── Step 1: Seed "always together" groups ─────────────────────────────────
    const alwaysRules = pairingRules.filter(r => r.type === 'always')
    const neverRules  = pairingRules.filter(r => r.type === 'never')
    let seedGroupIdx = 0
    for (const rule of alwaysRules) {
      const validPlayers = rule.players.filter(name => playerMap[name] && !assignedNames.has(name))
      if (validPlayers.length < 2) continue
      // Cap at 4; any extras fall into normal distribution
      const toPlace = validPlayers.slice(0, 4)
      // Advance past any already-full seed slots
      while (seedGroupIdx < numGroups && groups[seedGroupIdx].length >= 4) seedGroupIdx++
      if (seedGroupIdx >= numGroups) break
      for (const name of toPlace) {
        groups[seedGroupIdx].push(playerMap[name])
        assignedNames.add(name)
      }
      seedGroupIdx++
    }

    // ── Step 2: Distribute remaining players with flight-diversity ────────────
    const byFlight = {}
    for (const fl of ALL_SCORE_TABS) {
      const ps = allPlayers.filter(p => p.flight === fl && !assignedNames.has(p.name))
      if (ps.length) byFlight[fl] = [...ps]
    }
    const flightQueues = Object.values(byFlight)

    // Start from first non-full group
    let groupIdx = 0
    while (groupIdx < numGroups && groups[groupIdx].length >= 4) groupIdx++

    let safetyCounter = 0
    const maxIterations = allPlayers.length * 2 + 10
    while (flightQueues.some(q => q.length > 0) && safetyCounter < maxIterations) {
      safetyCounter++
      const currentGroup = groups[groupIdx]
      const representedFlights = new Set(currentGroup.map(p => p.flight))
      const candidates = flightQueues.filter(q => q.length > 0 && !representedFlights.has(q[0].flight))
      const pick = candidates.length > 0 ? candidates[0] : flightQueues.find(q => q.length > 0)
      if (!pick) break
      currentGroup.push(pick.shift())
      if (currentGroup.length >= 4) {
        groupIdx = (groupIdx + 1) % numGroups
        let checked = 0
        while (groups[groupIdx].length >= 4 && checked < numGroups) {
          groupIdx = (groupIdx + 1) % numGroups
          checked++
        }
      }
    }

    // ── Step 3: Best-effort "never together" resolution ───────────────────────
    for (const rule of neverRules) {
      const ruleSet = new Set(rule.players)
      for (let gi = 0; gi < groups.length; gi++) {
        const inGroup = groups[gi].filter(p => ruleSet.has(p.name))
        if (inGroup.length <= 1) continue
        // Try to relocate violators [1..] to any group without a rule member
        for (let vi = 1; vi < inGroup.length; vi++) {
          const movingPlayer = inGroup[vi]
          for (let ti = 0; ti < groups.length; ti++) {
            if (ti === gi) continue
            if (groups[ti].length >= 4) continue
            if (groups[ti].some(p => ruleSet.has(p.name))) continue
            groups[gi] = groups[gi].filter(p => p !== movingPlayer)
            groups[ti] = [...groups[ti], movingPlayer]
            break
          }
        }
      }
    }

    const newPairings = groups
      .filter(g => g.length > 0)
      .map((ps, i) => ({ pairing: `Pairing ${i + 1}`, players: ps }))
    setPairingsDirtyTouched(true)
    setPairingsData(prev => ({ ...prev, [tid]: newPairings }))
    patchTournamentLifecycle(tid, { pairingsState: 'draft' })
    setManualPairings(false)
    setSelectedUnpaired(null)
  }

  function importPairingsFromGroups(groups) {
    if (!groups?.length) return
    const flightByName = {}
    for (const fl of ALL_SCORE_TABS) {
      for (const p of (data[tid]?.[fl] ?? [])) flightByName[p.name] = fl
    }
    const newPairings = groups.map((g, i) => ({
      pairing: g.label ?? `Pairing ${i + 1}`,
      players: (g.players ?? []).map(name => ({ name, flight: flightByName[name] ?? NEW_PLAYERS_FLIGHT })),
    }))
    setPairingsDirtyTouched(true)
    setPairingsData(prev => ({ ...prev, [tid]: newPairings }))
    patchTournamentLifecycle(tid, { pairingsState: 'draft' })
    setManualPairings(false)
    setSelectedUnpaired(null)
  }

  function startManualPairings() {
    // Initialize with empty groups if none exist
    if (!currentPairings.length) {
      const numGroups = Math.max(DEFAULT_PAIRING_ROWS, Math.ceil(totalPlayers / 4) || 1)
      const empty = Array.from({ length: numGroups }, (_, i) => ({ pairing: `Pairing ${i + 1}`, players: [] }))
      setPairingsDirtyTouched(true)
      setPairingsData(prev => ({ ...prev, [tid]: empty }))
      patchTournamentLifecycle(tid, { pairingsState: 'draft' })
    }
    setManualPairings(true)
    setSelectedUnpaired(null)
  }

  function addGroupManual() {
    const idx = currentPairings.length + 1
    setPairingsDirtyTouched(true)
    setPairingsData(prev => ({
      ...prev,
      [tid]: [...(prev[tid] ?? []), { pairing: `Pairing ${idx}`, players: [] }]
    }))
    patchTournamentLifecycle(tid, { pairingsState: 'draft' })
  }

  async function removeGroupManual(cardIdx) {
    if (!await openConfirm('Remove this pairing group? Players will become unpaired.')) return
    const updated = currentPairings.map(c => ({ ...c, players: [...c.players] }))
    const removedGroup = updated[cardIdx]
    if (!removedGroup) return
    // Move players back to unpaired (just remove the group)
    updated.splice(cardIdx, 1)
    // Re-label
    updated.forEach((c, i) => { c.pairing = `Pairing ${i + 1}` })
    setPairingsDirtyTouched(true)
    setPairingsData(prev => ({ ...prev, [tid]: updated }))
    patchTournamentLifecycle(tid, { pairingsState: 'draft' })
    registerUndoAction({
      label: `Removed ${removedGroup.pairing}`,
      undo: () => {
        setPairingsData(prev => {
          const existing = (prev[tid] ?? []).map(c => ({ ...c, players: [...c.players] }))
          const restoreIdx = Math.min(cardIdx, existing.length)
          existing.splice(restoreIdx, 0, removedGroup)
          existing.forEach((c, i) => { c.pairing = `Pairing ${i + 1}` })
          return { ...prev, [tid]: existing }
        })
      },
    })
  }

  function assignUnpairedToGroup(cardIdx) {
    if (!selectedUnpaired) return
    movePlayerManual(
      { type: 'unassigned', name: selectedUnpaired },
      { cardIdx }
    )
    setSelectedUnpaired(null)
  }

  function movePlayerManual(source, destination) {
    if (!source || !destination) return
    const targetCard = Number(destination.cardIdx)
    if (!Number.isInteger(targetCard) || targetCard < 0 || targetCard >= currentPairings.length) return

    const updated = currentPairings.map(card => ({ ...card, players: [...card.players] }))
    let movingPlayer = null
    let sourceCardIdx = null
    let sourcePlayerIdx = null

    if (source.type === 'unassigned') {
      const player = unpairedPlayers.find(p => p.name === source.name)
      if (!player) return
      movingPlayer = { name: player.name, flight: player.flight }
    } else if (source.type === 'group') {
      sourceCardIdx = Number(source.cardIdx)
      sourcePlayerIdx = Number(source.playerIdx)
      if (!Number.isInteger(sourceCardIdx) || !Number.isInteger(sourcePlayerIdx)) return
      movingPlayer = updated[sourceCardIdx]?.players?.[sourcePlayerIdx]
      if (!movingPlayer) return
      updated[sourceCardIdx].players.splice(sourcePlayerIdx, 1)
    } else {
      return
    }

    if (!updated[targetCard]) return
    const destinationContainsPlayer = updated[targetCard].players.some(p => p.name === movingPlayer.name)
    if (destinationContainsPlayer) return

    const targetPlayers = updated[targetCard].players
    let insertAt = Number.isInteger(destination.playerIdx) ? Number(destination.playerIdx) : targetPlayers.length

    if (source.type === 'group' && sourceCardIdx === targetCard && sourcePlayerIdx < insertAt) {
      insertAt -= 1
    }
    insertAt = Math.max(0, Math.min(insertAt, targetPlayers.length))

    if (targetPlayers.length >= 4) return
    targetPlayers.splice(insertAt, 0, movingPlayer)
    setPairingsDirtyTouched(true)
    setPairingsData(prev => ({ ...prev, [tid]: updated }))
    patchTournamentLifecycle(tid, { pairingsState: 'draft' })
  }

  async function clearPairings() {
    if (!await openConfirm('Clear all pairings for this tournament?')) return
    const snapshot = cloneForUndo(currentPairings)
    setPairingsDirtyTouched(true)
    setPairingsData(prev => ({ ...prev, [tid]: [] }))
    patchTournamentLifecycle(tid, { pairingsState: 'none' })
    setManualPairings(false)
    setSelectedUnpaired(null)
    if (!snapshot?.length) return
    registerUndoAction({
      label: 'Cleared pairings',
      undo: () => {
        setPairingsData(prev => ({ ...prev, [tid]: snapshot }))
      },
    })
  }

  async function removePairedPlayer(cardIdx, playerIdx) {
    if (!await openConfirm('Remove this player from the pairing?')) return
    const removedPlayer = currentPairings[cardIdx]?.players?.[playerIdx]
    if (!removedPlayer) return
    const updated = currentPairings.map((c, ci) =>
      ci === cardIdx
        ? { ...c, players: c.players.filter((_, pi) => pi !== playerIdx) }
        : c
    )
    setPairingsDirtyTouched(true)
    setPairingsData(prev => ({ ...prev, [tid]: updated }))
    patchTournamentLifecycle(tid, { pairingsState: 'draft' })
    registerUndoAction({
      label: `Removed ${removedPlayer.name} from ${currentPairings[cardIdx]?.pairing ?? 'pairing'}`,
      undo: () => {
        setPairingsData(prev => {
          const existing = (prev[tid] ?? []).map(c => ({ ...c, players: [...c.players] }))
          if (!existing[cardIdx]) return prev
          const nextPlayers = [...existing[cardIdx].players]
          const restoreIdx = Math.min(playerIdx, nextPlayers.length)
          nextPlayers.splice(restoreIdx, 0, removedPlayer)
          existing[cardIdx] = { ...existing[cardIdx], players: nextPlayers }
          return { ...prev, [tid]: existing }
        })
      },
    })
  }

  async function savePairings() {
    if (!tournament) return false
    const errors = [
      ...validateTournamentId(tid, schedule),
      ...validatePairingsForTournament({ tournamentId: tid, pairingsByTournament: pairingsData, scoresByTournament: data }),
    ]
    if (blockOnValidation(errors)) return false

    const ok = await withSaveState(setPairingsSaving, setPairingsSaveStatus, async () => {
      await saveSnapshot('pairings', cloudPairings, `Before pairings save for ${tid}`, tid)
      const nextLifecycle = {
        ...tournamentLifecycle,
        [tid]: {
          ...(tournamentLifecycle[tid] ?? {}),
          pairingsState: 'published',
          pairingsPublishedAt: Date.now(),
        },
      }
      await Promise.all([
        DB.savePairings({ ...pairingsData }),
        DB.saveTournamentLifecycle(nextLifecycle),
      ])
      setTournamentLifecycle(nextLifecycle)
    }, setAdminError)
    if (ok) setPairingsDirtyTouched(false)
    if (ok) logChange('Pairings saved', tournament?.name ?? tid)
    return ok
  }

  // ── Flight management mutations ───────────────────────────────────────────────
  function updateMemberFlight(name, newFlight) {
    setMembersDirtyTouched(true)
    setMembersOverride(prev => ({
      ...prev,
      [name]: { ...(prev[name] ?? {}), flight: newFlight || null }
    }))
  }

  function updateMemberPtm(name, newPtm) {
    setMembersDirtyTouched(true)
    setMembersOverride(prev => ({
      ...prev,
      [name]: { ...(prev[name] ?? {}), ptm: newPtm === '' ? null : fmtPtmValue(newPtm) }
    }))
  }

  function updateMemberTee(name, newTee) {
    setMembersDirtyTouched(true)
    setMembersOverride(prev => ({
      ...prev,
      [name]: { ...(prev[name] ?? {}), tee: newTee || null }
    }))
  }

  function updateMemberCell(name, newCell) {
    setMembersDirtyTouched(true)
    setMembersOverride(prev => ({
      ...prev,
      [name]: { ...(prev[name] ?? {}), cell: newCell || null }
    }))
  }

  function updateMemberName(originalName, newName) {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === originalName) return
    setMembersDirtyTouched(true)
    setMembersOverride(prev => ({
      ...prev,
      [originalName]: { ...(prev[originalName] ?? {}), name: trimmed }
    }))
    // Rekey credits
    setCredits(prev => {
      if (!(originalName in prev)) return prev
      const next = { ...prev }
      next[trimmed] = next[originalName]
      delete next[originalName]
      return next
    })
    // Rekey payments across all tournaments
    setPayments(prev => {
      let changed = false
      const next = {}
      for (const [tid, map] of Object.entries(prev)) {
        if (originalName in map) {
          changed = true
          const m = { ...map }
          m[trimmed] = m[originalName]
          delete m[originalName]
          next[tid] = m
        } else {
          next[tid] = map
        }
      }
      return changed ? next : prev
    })
    // Rename inside score entry rows across all tournaments and flights
    setData(prev => {
      let changed = false
      const next = {}
      for (const [tid, flights] of Object.entries(prev)) {
        const nextFlights = {}
        for (const [flight, rows] of Object.entries(flights)) {
          const hasMatch = rows.some(r => r.name === originalName)
          if (hasMatch) {
            changed = true
            nextFlights[flight] = rows.map(r => r.name === originalName ? { ...r, name: trimmed } : r)
          } else {
            nextFlights[flight] = rows
          }
        }
        next[tid] = nextFlights
      }
      return changed ? next : prev
    })
    // Rename inside pairing groups across all tournaments
    setPairingsData(prev => {
      let changed = false
      const next = {}
      for (const [tid, cards] of Object.entries(prev)) {
        const hasMatch = cards.some(card => card.players?.some(p => p.name === originalName))
        if (hasMatch) {
          changed = true
          next[tid] = cards.map(card => ({
            ...card,
            players: card.players?.map(p => p.name === originalName ? { ...p, name: trimmed } : p) ?? [],
          }))
        } else {
          next[tid] = cards
        }
      }
      return changed ? next : prev
    })
  }

  function removeMember(originalName) {
    setMembersDirtyTouched(true)
    setMembersOverride(prev => ({
      ...prev,
      [originalName]: { ...(prev[originalName] ?? {}), active: false }
    }))
  }

  async function saveMembers() {
    const updated = membersData.map(m => {
      const raw = {
        ...m,
        name:   membersOverride[m.name]?.name   ?? m.name,
        flight: membersOverride[m.name]?.flight ?? m.flight,
        ptm:    membersOverride[m.name]?.ptm    ?? m.ptm,
        tee:    membersOverride[m.name]?.tee    ?? m.tee,
        active: membersOverride[m.name]?.active ?? m.active,
        cell:   membersOverride[m.name]?.cell   ?? m.cell,
      }
      // Firestore rejects undefined field values; strip them before writing
      return Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined))
    })
    if (blockOnValidation(validateMembers(updated))) return false

    const ok = await withSaveState(setMembersSaving, setMembersSaveStatus, async () => {
      await saveSnapshot('members', membersData, 'Before members save')
      await DB.saveMembers(updated)
    }, setAdminError)
    if (ok) setMembersDirtyTouched(false)
    if (ok) logChange('Members saved', `${updated.length} members`)
    return ok
  }

  // ── Flight assignment (calculator → save → navigate to pairings) ──────────────
  async function saveFlights(assignments) {
    // Build a flat { [name]: flightName } lookup from the assignments
    const flightMap = {}
    Object.entries(assignments).forEach(([flight, names]) => {
      names.forEach(name => { flightMap[name] = flight })
    })

    // Batch-update the override so the rest of the UI stays consistent
    setMembersOverride(prev => {
      const next = { ...prev }
      Object.entries(flightMap).forEach(([name, flight]) => {
        next[name] = { ...(next[name] ?? {}), flight }
      })
      return next
    })

    // Move already-entered players into their newly assigned flight tabs so
    // pairings generation sees the correct flight for each player.
    setData(prev => {
      const current = { ...(prev[tid] ?? {}) }
      // Snapshot existing entries for players being reassigned
      const playerEntries = {}
      for (const fl of ALL_SCORE_TABS) {
        for (const p of current[fl] ?? []) {
          if (p.name in flightMap) playerEntries[p.name] = { ...p }
        }
      }
      // Remove them from their current tabs
      for (const fl of ALL_SCORE_TABS) {
        current[fl] = (current[fl] ?? []).filter(p => !(p.name in flightMap))
      }
      // Place them in their new tabs (preserving score/ptm/eligible)
      for (const [name, newFlight] of Object.entries(flightMap)) {
        const entry = playerEntries[name]
        if (!entry) continue
        const target = ALL_SCORE_TABS.includes(newFlight) ? newFlight : NEW_PLAYERS_FLIGHT
        current[target] = [...(current[target] ?? []), entry]
      }
      return { ...prev, [tid]: current }
    })

    // Build the persisted member list — use flightMap for any assigned player,
    // fall through to existing override/base data for everyone else
    const updated = membersData.map(m => {
      const raw = {
        ...m,
        name:   membersOverride[m.name]?.name   ?? m.name,
        flight: flightMap[m.name] ?? membersOverride[m.name]?.flight ?? m.flight,
        ptm:    membersOverride[m.name]?.ptm    ?? m.ptm,
        tee:    membersOverride[m.name]?.tee    ?? m.tee,
        active: membersOverride[m.name]?.active ?? m.active,
      }
      return Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined))
    })

    const totalAssigned = Object.values(assignments).flat().length
    const ok = await withSaveState(setFlightsSaving, setFlightsSaveStatus, async () => {
      await saveSnapshot('members', membersData, `Before flight assignment (${tournament?.name ?? tid})`)
      await DB.saveMembers(updated)
    }, setAdminError)

    if (ok) {
      setMembersDirtyTouched(false)
      logChange('Flights assigned', `${totalAssigned} players for ${tournament?.name ?? tid}`)
      setAdminMode('pairings')
    }
    return ok
  }

  // ── Credit mutations ──────────────────────────────────────────────────────────
  function applyCredit(name, amount) {
    const n = parseFloat(amount)
    if (isNaN(n) || n === 0) return
    setCredits(prev => {
      const current = Number.isFinite(Number(prev[name])) ? Number(prev[name]) : 0
      const nextValue = Math.max(0, +(current + n).toFixed(2))
      return { ...prev, [name]: nextValue }
    })
  }

  async function saveCredits() {
    const errors = validateCredits(credits, effectiveMembers.map(m => m.name))
    if (blockOnValidation(errors)) return false

    const ok = await withSaveState(setCreditsSaving, setCreditsSaveStatus, async () => {
      await saveSnapshot('credits', cloudCredits, 'Before credits save')
      await DB.saveCredits(credits)
    }, setAdminError)
    if (ok) logChange('Credits saved', `${Object.keys(credits).length} member(s) with balances`)
    return ok
  }

  async function savePlayerManagement() {
    const membersOk = await saveMembers()
    if (!membersOk) return false
    const creditsOk = await saveCredits()
    return creditsOk
  }

  function patchTournamentLifecycle(tournamentId, patch) {
    if (!tournamentId) return
    setTournamentLifecycle(prev => ({
      ...prev,
      [tournamentId]: {
        ...(prev[tournamentId] ?? {}),
        ...patch,
      },
    }))
  }

  // ── Payment mutations ─────────────────────────────────────────────────────────
  function ensurePlayerIsEntered(tournamentId, name) {
    const alreadyAdded = ALL_SCORE_TABS.some(fl =>
      (data[tournamentId]?.[fl] ?? []).some(p => p.name === name)
    )
    if (alreadyAdded) return
    const memberFlight = memberFlightLookup[name]
    const memberPtm = ptmLookup[name]
    const isNewPlayer = memberPtm == null || memberPtm === '' || Number(memberPtm) === 0
    const targetFlight = (!isNewPlayer && FLIGHTS.includes(memberFlight)) ? memberFlight : 'New Players'
    const entry = { name, ptm: memberPtm ?? '', score: '', eligible: true }
    setData(prev => {
      const td = { ...(prev[tournamentId] ?? {}) }
      td[targetFlight] = [...(td[targetFlight] ?? []), entry]
      return { ...prev, [tournamentId]: td }
    })
  }

  function playerHasScoreInTournament(tournamentId, name) {
    return ALL_SCORE_TABS.some(flight =>
      (data[tournamentId]?.[flight] ?? []).some(player => {
        if (player?.name !== name) return false
        const rawScore = player?.score
        if (rawScore == null || rawScore === '') return false
        const parsed = Number(rawScore)
        return Number.isFinite(parsed)
      })
    )
  }

  function removePlayerFromTournamentEntry(tournamentId, name) {
    setData(prev => {
      const td = { ...(prev[tournamentId] ?? {}) }
      ALL_SCORE_TABS.forEach(flight => {
        td[flight] = (td[flight] ?? []).filter(player => player?.name !== name)
      })
      return { ...prev, [tournamentId]: td }
    })
  }

  function removePlayerFromTournamentPairings(tournamentId, name) {
    setPairingsDirtyTouched(true)
    setPairingsData(prev => {
      const current = prev[tournamentId] ?? []
      if (!current.length) return prev
      const nextTournamentPairings = current.map(card => ({
        ...card,
        players: (card.players ?? []).filter(player => player?.name !== name),
      }))
      return { ...prev, [tournamentId]: nextTournamentPairings }
    })
  }

  async function setTournamentPaidStatus(tournamentId, name, isPaid, options = {}) {
    const { creditUsed = 0 } = options
    const currentMap = payments[tournamentId] ?? {}
    const currentlyPaid = !!currentMap[name]
    if (currentlyPaid === isPaid) return true

    if (isPaid) {
      ensurePlayerIsEntered(tournamentId, name)
      setPayments(prev => {
        const tidMap = { ...(prev[tournamentId] ?? {}) }
        tidMap[name] = true
        return { ...prev, [tournamentId]: tidMap }
      })
      setPaymentMeta(prev => {
        const currentTidMeta = { ...(prev[tournamentId] ?? {}) }
        currentTidMeta[name] = {
          ...(currentTidMeta[name] ?? {}),
          creditUsed: toMoney(creditUsed),
          paidAt: currentTidMeta[name]?.paidAt ?? Date.now(),
        }
        return { ...prev, [tournamentId]: currentTidMeta }
      })
      return true
    }

    if (playerHasScoreInTournament(tournamentId, name)) {
      setAdminError(`Cannot remove ${formatName(name)} from this tournament because scores already exist. Remove scores first, then unmark Paid.`)
      return false
    }

    const isPaired = (pairingsData[tournamentId] ?? []).some(card =>
      (card.players ?? []).some(player => player?.name === name)
    )
    const pairingsState = tournamentLifecycle[tournamentId]?.pairingsState
    if (isPaired && pairingsState === 'published') {
      const continueRemoval = await openConfirm(
        `${formatName(name)} is in published pairings. Removing Paid will also remove them from pairings and set pairings back to draft. Continue?`
      )
      if (!continueRemoval) return false
      patchTournamentLifecycle(tournamentId, { pairingsState: 'draft' })
    } else if (isPaired) {
      patchTournamentLifecycle(tournamentId, { pairingsState: 'draft' })
    }

    removePlayerFromTournamentPairings(tournamentId, name)
    removePlayerFromTournamentEntry(tournamentId, name)

    setPayments(prev => {
      const tidMap = { ...(prev[tournamentId] ?? {}) }
      delete tidMap[name]
      return { ...prev, [tournamentId]: tidMap }
    })
    setPaymentMeta(prev => {
      const currentTidMeta = { ...(prev[tournamentId] ?? {}) }
      delete currentTidMeta[name]
      return { ...prev, [tournamentId]: currentTidMeta }
    })
    return true
  }

  async function togglePayment(tournamentId, name, options = {}) {
    const currentMap = payments[tournamentId] ?? {}
    const isNowPaid = !currentMap[name]
    await setTournamentPaidStatus(tournamentId, name, isNowPaid, options)
  }

  function markPaidWithCredit(tournamentId, name, creditAmountInput) {
    const available = toMoney(credits[name] ?? 0)
    const requested = toMoney(creditAmountInput)
    const creditUsed = Math.max(0, Math.min(requested, available))
    if (creditUsed > 0) {
      const nextBalance = toMoney(available - creditUsed)
      setCredits(prev => ({ ...prev, [name]: nextBalance }))
      const transaction = createCreditTxn({ name, tournamentId, creditUsed, user: currentUser })
      DB.appendCreditTransaction(transaction).catch(err => console.warn('[CGA] Failed to log credit transaction:', err))
    }
    setTournamentPaidStatus(tournamentId, name, true, { creditUsed })
  }

  function markAllPaid(tournamentId, names) {
    names.forEach(name => {
      setTournamentPaidStatus(tournamentId, name, true, {
        creditUsed: toMoney(paymentMeta?.[tournamentId]?.[name]?.creditUsed ?? 0),
      })
    })
  }

  async function clearAllPayments(tournamentId) {
    if (!await openConfirm('Clear all payment records for this tournament?')) return
    const previous = cloneForUndo(payments[tournamentId] ?? {})
    const paidNames = Object.keys(previous)
    if (!paidNames.length) return
    const blocked = []
    for (const name of paidNames) {
      const removed = await setTournamentPaidStatus(tournamentId, name, false)
      if (!removed) blocked.push(name)
    }
    if (blocked.length) {
      setAdminError(`Could not clear ${blocked.length} payment(s) because those players have scores or removal was canceled.`)
    }
    registerUndoAction({
      label: `Cleared payments for ${tournamentId}`,
      undo: () => {
        setPayments(prev => ({
          ...prev,
          [tournamentId]: previous,
        }))
      },
    })
  }

  async function savePayments() {
    const errors = [
      ...validateTournamentId(tid, schedule),
      ...validatePayments(payments, schedule, membersData.map(m => m.name)),
    ]
    if (blockOnValidation(errors)) return false

    const ok = await withSaveState(setPaymentsSaving, setPaymentsSaveStatus, async () => {
      await saveSnapshot('payments', cloudPayments, `Before payments save for ${tid}`, tid)
      await Promise.all([
        DB.savePayments(payments),
        DB.savePaymentMeta(paymentMeta),
      ])
    }, setAdminError)
    if (ok) logChange('Payments saved', `${Object.keys(paymentMap).length} paid for ${tournament?.name ?? tid}`)
    return ok
  }

  function addUser() {
    if (!newUser.name.trim() || !newUser.email.trim()) return
    const email = newUser.email.trim().toLowerCase()
    if (usersDraft.some(u => (u.email ?? '').toLowerCase() === email)) return
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name: newUser.name.trim(),
      email,
      role: newUser.role || 'member',
      status: 'active',
      createdAt: new Date().toISOString(),
    }
    setUsersDraft(prev => [...prev, entry].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')))
    setNewUser({ name: '', email: '', role: 'member' })
  }

  function updateUser(userId, field, value) {
    setUsersDraft(prev => prev.map(u => (u.id === userId ? { ...u, [field]: value } : u)))
  }

  function toggleUserStatus(userId) {
    setUsersDraft(prev => prev.map(u => (
      u.id === userId
        ? { ...u, status: u.status === 'disabled' ? 'active' : 'disabled' }
        : u
    )))
  }

  async function saveUsers() {
    if (blockOnValidation(validateUsers(usersDraft))) return false

    const ok = await withSaveState(setUsersSaving, setUsersSaveStatus, async () => {
      await saveSnapshot('users', cloudUsers, 'Before users save')
      await DB.saveUsers(usersDraft)
    }, setAdminError)
    if (ok) logChange('Users saved', `${usersDraft.length} user account(s)`)
    return ok
  }

  function updateTournamentInfoDraft(tournamentId, field, value) {
    if (!tournamentId) return
    setTournamentInfoDrafts(prev => ({
      ...prev,
      [tournamentId]: {
        ...(prev[tournamentId] ?? {}),
        [field]: value,
      },
    }))
  }

  async function resetTournamentInfoDraft(tournamentId) {
    if (!tournamentId) return
    if (!await openConfirm('Discard unsaved tournament info changes?')) return
    setTournamentInfoDrafts(prev => {
      const next = { ...prev }
      delete next[tournamentId]
      return next
    })
  }

  // Payments derived state
  const paymentPaidCount = Object.keys(paymentMap).length
  const filteredUsers = useMemo(() => {
    const search = userSearch.trim().toLowerCase()
    return usersDraft
      .filter(u => !search || `${u.name ?? ''} ${u.email ?? ''} ${u.role ?? ''}`.toLowerCase().includes(search))
      .slice()
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  }, [usersDraft, userSearch])

  const dashboardTid = tid || nextTournament?.id || ''
  const dashboardTournament = schedule.find(t => t.id === dashboardTid) ?? nextTournament ?? null
  const dashboardWorkflow = useMemo(() => computeTournamentWorkflowState({
    tournamentId: dashboardTid,
    tournament: dashboardTournament,
    scoresByTournament: data,
    pairingsByTournament: pairingsData,
    paymentsByTournament: payments,
    resultsByTournament: allResults,
    lifecycleByTournament: tournamentLifecycle,
    scoreFlights: ALL_SCORE_TABS,
  }), [dashboardTid, dashboardTournament, data, pairingsData, payments, allResults, tournamentLifecycle])
  const workflowActions = useMemo(() => ({
    memo: { label: 'Send Tournament Memo', mode: null },
    field: { label: 'Review Entries', mode: 'payments' },
    pairingsLifecycle: { label: 'Generate / Edit Pairings', mode: 'pairings' },
    birdie: { label: 'Export Birdie Pool', mode: null },
    scoresLifecycle: { label: 'Open Scores / Results', mode: 'scores' },
    payout: { label: 'Generate Payout', mode: null },
    export: { label: 'Export Reports', mode: null },
  }), [])
  const nextWorkflowStep = useMemo(() => {
    const firstIncomplete = dashboardWorkflow.lifecycleSteps.find(step => step.status !== 'complete')
    if (firstIncomplete) return firstIncomplete
    return { key: 'export', title: 'Export Reports', label: 'Workflow complete. Export packets and records.' }
  }, [dashboardWorkflow])
  const lastPublishedTournament = useMemo(() => (
    [...schedule]
      .filter(t => allResults?.[t.id])
      .sort((a, b) => (new Date(b.date)) - (new Date(a.date)))[0] ?? null
  ), [allResults])

  const pairingsPosted = useMemo(() => {
    const state = tournamentLifecycle[tid]?.pairingsState
    if (state === 'published') return true
    if (state === 'draft' || state === 'none') return false
    const p = cloudPairings[tid]
    return Array.isArray(p) && p.length > 0
  }, [cloudPairings, tid, tournamentLifecycle])

  const pairingsDirty = useMemo(() => {
    if (!pairingsDirtyTouched) return false
    return hasMeaningfulChanges(
      {
        pairings: sanitizePairingsForCompare(cloudPairings),
        lifecycle: sanitizeLifecycleForPairings(cloudTournamentLifecycle),
      },
      {
        pairings: sanitizePairingsForCompare(pairingsData),
        lifecycle: sanitizeLifecycleForPairings(tournamentLifecycle),
      }
    )
  }, [pairingsDirtyTouched, cloudPairings, cloudTournamentLifecycle, pairingsData, tournamentLifecycle])

  const membersDirty = useMemo(() => {
    if (!membersDirtyTouched) return false
    return hasMeaningfulChanges(
      sanitizeMembersForCompare(membersData),
      sanitizeMembersForCompare(membersData, membersOverride)
    )
  }, [membersDirtyTouched, membersData, membersOverride])

  const dirtyRegistry = useMemo(() => ([
    {
      key: 'scores',
      label: 'Score Entry',
      dirty: stableSerialize(data) !== stableSerialize(cloudScores),
      saveAction: 'scores',
      saving: scoresSaving,
    },
    {
      key: 'pairings',
      label: 'Pairings Builder',
      dirty: pairingsDirty,
      saveAction: 'pairings',
      saving: pairingsSaving,
    },
    {
      key: 'members',
      label: 'Member Management',
      dirty: membersDirty,
      saveAction: 'members',
      saving: membersSaving,
    },
    {
      key: 'credits',
      label: 'Credit on Books',
      dirty: stableSerialize(credits) !== stableSerialize(cloudCredits),
      saveAction: 'credits',
      saving: creditsSaving,
    },
    {
      key: 'payments',
      label: 'Payments',
      dirty: stableSerialize(payments) !== stableSerialize(cloudPayments) || stableSerialize(paymentMeta) !== stableSerialize(cloudPaymentMeta),
      saveAction: 'payments',
      saving: paymentsSaving,
    },
    {
      key: 'users',
      label: 'Users',
      dirty: stableSerialize(usersDraft) !== stableSerialize(cloudUsers),
      saveAction: 'users',
      saving: usersSaving,
    },
  ]), [
    data, cloudScores, scoresSaving,
    pairingsDirty, pairingsSaving,
    membersDirty, membersSaving,
    credits, cloudCredits, creditsSaving,
    payments, cloudPayments, paymentsSaving, paymentMeta, cloudPaymentMeta,
    usersDraft, cloudUsers, usersSaving,
    tournamentInfoDrafts,
  ])

  const unsavedDrafts = useMemo(
    () => dirtyRegistry.filter(section => section.dirty),
    [dirtyRegistry]
  )
  const savableUnsavedDrafts = useMemo(
    () => unsavedDrafts.filter(section => section.saveAction),
    [unsavedDrafts]
  )
  const hasUnsavedDrafts = unsavedDrafts.length > 0
  const anySectionSaving = useMemo(
    () => dirtyRegistry.some(section => section.saving),
    [dirtyRegistry]
  )
  const keyWorkflowStats = `${paymentPaidCount} Paid / ${totalPlayers} Entered`
  const primaryActions = [
    { key: 'overview',           label: 'Dashboard',           Icon: DashboardIcon, onClick: () => setAdminMode('dashboard'),  active: adminMode === 'dashboard' },
    { key: 'entries',            label: 'Payments',            Icon: ReceiptIcon,   onClick: () => setAdminMode('payments'),   active: adminMode === 'payments' },
    { key: 'flights',            label: 'Flights',            Icon: LayersIcon,    onClick: () => setAdminMode('flights'),    active: adminMode === 'flights' },
    { key: 'pairings',           label: 'Pairings',           Icon: UsersIcon,     onClick: () => setAdminMode('pairings'),   active: adminMode === 'pairings' },
    { key: 'scores',             label: 'Scores',             Icon: GolfFlagIcon,  onClick: () => setAdminMode('scores'),     active: adminMode === 'scores' },
    { key: 'exports',            label: 'Exports',            Icon: ExportIcon,    onClick: () => setAdminMode('exports'),    active: adminMode === 'exports' },
    { key: 'player-management',  label: 'Field',  Icon: FolderIcon,    onClick: () => setAdminMode('operations'), active: adminMode === 'operations' },
    { key: 'member-management',  label: 'Member Management',  Icon: UsersIcon,     onClick: () => setAdminMode('users'),      active: adminMode === 'users' },
    { key: 'snapshots',          label: 'Publish',          Icon: ArchiveIcon,   onClick: () => setAdminMode('snapshots'),  active: adminMode === 'snapshots' },
    { key: 'changelog',          label: 'Audit Log',          Icon: ClockListIcon, onClick: () => setAdminMode('changelog'),  active: adminMode === 'changelog' },
  ]

  async function saveAllDirtyDrafts() {
    if (saveAllSaving || anySectionSaving || savableUnsavedDrafts.length === 0) return
    setAdminError(null)
    setSaveAllSaving(true)
    setSaveAllStatus(null)
    const failed = []
    for (const section of savableUnsavedDrafts) {
      let ok = false
      if (section.saveAction === 'scores') ok = await saveScores()
      if (section.saveAction === 'pairings') ok = await savePairings()
      if (section.saveAction === 'members') ok = await saveMembers()
      if (section.saveAction === 'credits') ok = await saveCredits()
      if (section.saveAction === 'payments') ok = await savePayments()
      if (section.saveAction === 'users') ok = await saveUsers()
      if (!ok) failed.push(section.label)
    }
    if (failed.length > 0) {
      setSaveAllStatus('err')
      setAdminError(`Save All could not sync: ${failed.join(', ')}`)
    } else {
      setSaveAllStatus('ok')
    }
    setSaveAllSaving(false)
    setTimeout(() => setSaveAllStatus(null), 3000)
  }

  async function discardAllDirtyDrafts() {
    if (!hasUnsavedDrafts || saveAllSaving || anySectionSaving) return
    if (!await openConfirm('Discard ALL local changes and revert everything to the last saved cloud version?')) return
    const dirtyKeys = new Set(unsavedDrafts.map(section => section.key))
    if (dirtyKeys.has('scores')) setData(cloudScores)
    if (dirtyKeys.has('pairings')) {
      setPairingsData(cloudPairings)
      setTournamentLifecycle(cloudTournamentLifecycle)
      setPairingsDirtyTouched(false)
    }
    if (dirtyKeys.has('payments')) {
      setPayments(cloudPayments)
      setPaymentMeta(cloudPaymentMeta)
    }
    if (dirtyKeys.has('credits')) setCredits(cloudCredits)
    if (dirtyKeys.has('users')) setUsersDraft(cloudUsers)
    setTournamentInfoDrafts({})
    if (dirtyKeys.has('members')) {
      const base = Object.fromEntries((membersData || []).map(m => [m.name, { flight: m.flight, ptm: m.ptm, tee: m.tee ?? null }]))
      setMembersOverride(base)
      setMembersDirtyTouched(false)
    }
  }

  const paymentRoster = useMemo(() => {
    const search = paymentSearch.trim().toLowerCase()
    return membersData
      .filter(m => m.active !== false)
      .filter(m => !search || m.name.toLowerCase().includes(search))
      .slice()
      .sort(compareByLastName)
  }, [membersData, paymentSearch])

  // ── Excel import ──────────────────────────────────────────────────────────────
  function handleXlsxFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const result = parseRosterXlsx(ev.target.result, membersData)
        setImportPreview(result)
        setImportStatus(null)
        setImportError(null)
      } catch (err) {
        console.error('Excel parse error:', err)
        setImportStatus('err')
        setImportError(err?.message || String(err) || 'Failed to parse Excel file')
      }
    }
    reader.readAsArrayBuffer(file)
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  async function confirmImport() {
    if (!importPreview) return
    setImportError(null)
    await withSaveState(setImportSaving, setImportStatus, async () => {
      // If Firebase is empty, accept all unmatched rows as new members (bootstrap mode)
      const isBootstrapping = membersData.length === 0
      const rowsToImport = isBootstrapping
        ? [...importPreview.matched, ...importPreview.unmatched.map(r => {
            // Convert "Last, First" to "First Last" for new members
            let normalizedName = r.rawName
            if (r.rawName.includes(',')) {
              const parts = r.rawName.split(',').map(s => s.trim())
              normalizedName = parts.slice(1).join(' ') + ' ' + parts[0]
            }
            return { ...r, memberName: normalizedName }
          })]
        : importPreview.matched

      // Build updated member list: apply all Excel fields to members
      const overrideMap = {}
      for (const row of rowsToImport) {
        if (row.memberName) {
          overrideMap[row.memberName] = {
            name:              row.memberName,
            ...(row.tee            !== null ? { tee:           row.tee                } : {}),
            ...(row.ptm            !== null ? { ptm:           Number(row.ptm)        } : {}),
            ...(row.creditOnBooks  !== null ? { creditOnBooks: row.creditOnBooks      } : {}),
            ...(row.email          !== null ? { email:         row.email              } : {}),
            ...(row.homePhone      !== null ? { homePhone:     row.homePhone          } : {}),
            ...(row.cellPhone      !== null ? { cell:          row.cellPhone          } : {}),
            ...(row.history                 ? { history:       row.history            } : {}),
            ...(typeof row.rounds === 'number' ? { rounds: row.rounds }  : {}),
          }
        }
      }

      let updatedMembers
      if (isBootstrapping) {
        // Create new members from Excel rows
        updatedMembers = Object.values(overrideMap)
      } else {
        // Update existing members
        updatedMembers = membersData.map(m => ({
          ...m,
          ...(overrideMap[m.name] ?? {}),
        }))
      }

      // Update local override state so the table reflects immediately
      setMembersOverride(prev => {
        const next = { ...prev }
        for (const [name, changes] of Object.entries(overrideMap)) {
          next[name] = { ...(next[name] ?? {}), ...changes }
        }
        return next
      })

      // Build updated PTM list: apply tee + ptm + history + rounds from Excel rows
      const ptmOverrideMap = {}
      for (const row of rowsToImport) {
        if (row.memberName) {
          ptmOverrideMap[row.memberName] = {
            ...(row.tee     !== null ? { tee:     row.tee                } : {}),
            ...(row.ptm     !== null ? { ptm:     Number(row.ptm)        } : {}),
            ...(row.history           ? { history: row.history           } : {}),
            ...(row.rounds  != null   ? { rounds:  row.rounds            } : {}),
          }
        }
      }
      // Merge overrides into existing PTM list (preserves ptmAtFlowControl etc.)
      const updatedPtm = (livePtmData || []).map(p => ({
        ...p,
        ...(ptmOverrideMap[p.name] ?? {}),
      }))
      // Add any new rows not already in PTM list
      const ptmNames = new Set((livePtmData || []).map(p => p.name))
      for (const row of rowsToImport) {
        if (row.memberName && !ptmNames.has(row.memberName)) {
          updatedPtm.push({
            name:             row.memberName,
            ptm:              row.ptm  !== null ? Number(row.ptm) : null,
            ptmAtFlowControl: null,
            tee:              row.tee  ?? null,
            history:          row.history,
            rounds:           row.rounds,
          })
        }
      }

      await Promise.all([
        DB.saveMembers(updatedMembers),
        DB.savePtm(updatedPtm),
      ])
      setImportPreview(null)
    }, setAdminError)
  }



  // ── Save scores draft to Firestore ───────────────────────────────────────────
  async function saveScores() {
    const errors = [
      ...validateTournamentId(tid, schedule),
      ...validateScoresForTournament({ tournamentId: tid, scoresByTournament: data, scoreFlights: ALL_SCORE_TABS }),
    ]
    if (blockOnValidation(errors)) return false

    const ok = await withSaveState(setScoresSaving, setScoresSaveStatus, async () => {
      await saveSnapshot('scores', cloudScores, `Before scores save for ${tid}`, tid)
      await DB.saveScores(data)
    }, setAdminError)
    if (ok) logChange('Scores saved', `${totalPlayers} player(s) — ${tournament?.name ?? tid}`)
    return ok
  }

  // ── Publish tournament results to Firestore ───────────────────────────────────

  // Computes updated member records after a tournament is published:
  // - prepends the new score to each player's history (capped at 7)
  // - recalculates PTM from the updated history using the league formula
  function computePublishMemberUpdates(targetTid) {
    const allFlights = [...FLIGHTS, NEW_PLAYERS_FLIGHT]
    const scoreLookup = {}
    for (const fl of allFlights) {
      for (const entry of (data[targetTid]?.[fl] ?? [])) {
        if (entry.wd) continue
        const score = Number(entry.score)
        if (entry.name && Number.isFinite(score)) {
          scoreLookup[entry.name] = score
        }
      }
    }

    return membersData.map(m => {
      const newScore = scoreLookup[m.name]
      if (newScore == null) return m

      const prevHistory = Array.isArray(m.history)
        ? m.history.filter(v => typeof v === 'number' && Number.isFinite(v))
        : []
      const newHistory = [newScore, ...prevHistory].slice(0, 7)
      const newPtm = calcPtmFromHistory(newHistory) ?? m.ptm

      return { ...m, history: newHistory, rounds: newHistory.length, ptm: newPtm }
    })
  }

  function buildPublishPayloadForTournament(targetTid = tid, updatedMembers = null) {
    const members = updatedMembers ?? computePublishMemberUpdates(targetTid)
    const computedPtmLookup = Object.fromEntries(members.map(m => [m.name, m.ptm]))
    // Include archived tournaments so publish works for prior-season entries
    const combinedSchedule = [...schedule, ...archivedTournaments]
    return buildPublishPayload({
      targetTid,
      schedule: combinedSchedule,
      flights: FLIGHTS,
      scoreData: data,
      currentStandings,
      ptmLookup: computedPtmLookup,
      calcFlightPOY,
    })
  }

  async function publishTournament(payloadOrTid = tid) {
    const targetTid = typeof payloadOrTid === 'string'
      ? payloadOrTid
      : (payloadOrTid?.targetTid ?? tid)

    // Always recompute from current scores so publish is consistent with preview
    const updatedMembers = computePublishMemberUpdates(targetTid)
    const payload = buildPublishPayloadForTournament(targetTid, updatedMembers)
    if (!payload?.resultDoc) return false

    const combinedSchedule = [...schedule, ...archivedTournaments]
    const publishErrors = [
      ...validateTournamentId(payload.targetTid, combinedSchedule),
      ...validateScoresForTournament({ tournamentId: payload.targetTid, scoresByTournament: data, scoreFlights: ALL_SCORE_TABS }),
      ...validatePublishPayload(payload, { scoreFlights: ALL_SCORE_TABS }),
    ]
    if (blockOnValidation(publishErrors)) return false

    const ok = await withSaveState(setPublishSaving, setPublishSaveStatus, async () => {
      await Promise.all([
        saveSnapshot('results', allResults?.[payload.targetTid] ?? null, `Before publish ${payload.targetTid}`, payload.targetTid),
        saveSnapshot('standings', currentStandings, `Before publish ${payload.targetTid}`, payload.targetTid),
        saveSnapshot('poy', currentPoy, `Before publish ${payload.targetTid}`, payload.targetTid),
      ])
      await Promise.all([
        DB.batchPublish(payload.targetTid, {
          resultDoc: payload.resultDoc,
          newPoy: payload.newPoy,
          newStandings: payload.newStandings,
        }),
        DB.saveMembers(updatedMembers),
      ])
      // Auto-mark tournament as completed so the public site shows results immediately
      const updatedStatus = {
        ...liveTournamentStatus,
        completed: { ...(liveTournamentStatus?.completed ?? {}), [payload.targetTid]: true },
      }
      await DB.saveTournamentStatus(updatedStatus)
    }, setAdminError)

    if (ok) {
      // Clear any stale PTM overrides so the fresh Firestore values take over
      const scoredNames = new Set(updatedMembers
        .filter(m => {
          const orig = membersData.find(o => o.name === m.name)
          return orig && m.ptm !== orig.ptm
        })
        .map(m => m.name)
      )
      if (scoredNames.size > 0) {
        setMembersOverride(prev => {
          const next = { ...prev }
          for (const name of scoredNames) {
            if (!next[name]) continue
            const { ptm: _p, history: _h, rounds: _r, ...rest } = next[name]
            if (Object.keys(rest).length === 0) delete next[name]
            else next[name] = rest
          }
          return next
        })
      }
      const t = schedule.find(s => s.id === payload.targetTid)
      logChange('Results published', t?.name ?? payload.targetTid)
    }
    return ok
  }

  function openPublishPreview(targetTid = tid) {
    try {
      const payload = buildPublishPayloadForTournament(targetTid)
      if (!payload) {
        setAdminError('Cannot publish: tournament not found. Select a valid tournament and try again.')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      // Accept archived tournaments (in Firestore but not schedule.json) as valid
      const combinedSchedule = [...schedule, ...archivedTournaments]
      const publishErrors = [
        ...validateTournamentId(targetTid, combinedSchedule),
        ...validateScoresForTournament({ tournamentId: targetTid, scoresByTournament: data, scoreFlights: FLIGHTS }),
        ...validatePublishPayload(payload, { scoreFlights: FLIGHTS }),
      ]
      if (blockOnValidation(publishErrors)) {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      setPublishPreview(payload)
    } catch (err) {
      console.error('[CGA] openPublishPreview error:', err)
      setAdminError(`Publish error: ${err?.message || String(err)}`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  async function confirmPublishPreview() {
    if (!publishPreview || publishSaving) return
    const ok = await publishTournament(publishPreview)
    if (ok) {
      setActionFeedback(`Published ${publishPreview.targetTournament.name}. Undo is not available for published results.`)
      setPublishPreview(null)
    }
  }

  async function markMemoSent(targetTid = tid) {
    if (!targetTid) return
    const next = {
      ...tournamentLifecycle,
      [targetTid]: { ...(tournamentLifecycle[targetTid] ?? {}), memoSentAt: nextLifecycleStamp() },
    }
    setTournamentLifecycle(next)
    await DB.saveTournamentLifecycle(next).catch(err => console.warn('[CGA] Failed to save lifecycle:', err))
  }

  async function unmarkMemoSent(targetTid = tid) {
    if (!targetTid) return
    const next = {
      ...tournamentLifecycle,
      [targetTid]: { ...(tournamentLifecycle[targetTid] ?? {}), memoSentAt: null },
    }
    setTournamentLifecycle(next)
    await DB.saveTournamentLifecycle(next).catch(err => console.warn('[CGA] Failed to save lifecycle:', err))
  }

  async function finalizeField(targetTid = tid) {
    if (!targetTid) return
    const next = {
      ...tournamentLifecycle,
      [targetTid]: { ...(tournamentLifecycle[targetTid] ?? {}), fieldFinalizedAt: nextLifecycleStamp() },
    }
    setTournamentLifecycle(next)
    await DB.saveTournamentLifecycle(next).catch(err => console.warn('[CGA] Failed to save lifecycle:', err))
  }

  async function unfinalizeField(targetTid = tid) {
    if (!targetTid) return
    const next = {
      ...tournamentLifecycle,
      [targetTid]: { ...(tournamentLifecycle[targetTid] ?? {}), fieldFinalizedAt: null },
    }
    setTournamentLifecycle(next)
    await DB.saveTournamentLifecycle(next).catch(err => console.warn('[CGA] Failed to save lifecycle:', err))
  }

  async function generateBirdieExport(targetTid = tid) {
    const targetTournament = schedule.find(t => t.id === targetTid) ?? archivedTournaments.find(t => t.id === targetTid)
    if (!targetTournament) return
    exportBirdiePoolXLSX(targetTournament, data[targetTid] ?? {}, ALL_SCORE_TABS)
    const nextLifecycle = {
      ...tournamentLifecycle,
      [targetTid]: {
        ...(tournamentLifecycle[targetTid] ?? {}),
        birdiePoolExportedAt: nextLifecycleStamp(),
      },
    }
    setTournamentLifecycle(nextLifecycle)
    await DB.saveTournamentLifecycle(nextLifecycle).catch(err => console.warn('[CGA] Failed to save tournament lifecycle:', err))
  }

  async function generatePayoutDocument(targetTid = tid) {
    const targetTournament = schedule.find(t => t.id === targetTid) ?? archivedTournaments.find(t => t.id === targetTid)
    const resultDoc = allResults?.[targetTid]
    if (!targetTournament || !resultDoc) return
    const exported = exportPayoutDocXLSX(targetTournament, resultDoc)
    if (!exported) return
    const nextLifecycle = {
      ...tournamentLifecycle,
      [targetTid]: {
        ...(tournamentLifecycle[targetTid] ?? {}),
        payoutGeneratedAt: nextLifecycleStamp(),
      },
    }
    setTournamentLifecycle(nextLifecycle)
    await DB.saveTournamentLifecycle(nextLifecycle).catch(err => console.warn('[CGA] Failed to save tournament lifecycle:', err))
  }

  // ── Tournament completion (site-wide status override) ─────────────────────────
  async function markTournamentComplete(targetTid) {
    const prevStatus = liveTournamentStatus
    const updated = {
      ...prevStatus,
      completed: { ...(prevStatus?.completed ?? {}), [targetTid]: true },
    }
    try {
      await DB.saveTournamentStatus(updated)
      const tName = schedule.find(t => t.id === targetTid)?.name ?? targetTid
      logChange('Tournament marked complete', tName)
      registerUndoAction({
        label: `Mark "${tName}" complete`,
        undo: () => DB.saveTournamentStatus(prevStatus ?? {})
          .then(() => logChange('Tournament completion undone', tName))
          .catch(err => setAdminError(err?.message || 'Undo failed')),
      })
    } catch (e) {
      setAdminError(e?.message || 'Failed to mark tournament complete')
    }
  }

  async function unmarkTournamentComplete(targetTid) {
    const prevStatus = liveTournamentStatus
    const currentCompleted = { ...(prevStatus?.completed ?? {}) }
    delete currentCompleted[targetTid]
    try {
      await DB.saveTournamentStatus({ ...prevStatus, completed: currentCompleted })
      const tName = schedule.find(t => t.id === targetTid)?.name ?? targetTid
      logChange('Tournament completion undone', tName)
    } catch (e) {
      setAdminError(e?.message || 'Failed to undo tournament completion')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <PageWrapper>
      {/* Error banner */}
      {adminError && (
        <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm font-sans text-red-700">
          <span className="font-semibold flex-shrink-0">Save error:</span>
          <span className="flex-1 break-all">{adminError}</span>
          <button onClick={() => setAdminError(null)} className="flex-shrink-0 text-red-400 hover:text-red-700 leading-none text-lg">×</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="section-title text-3xl">Tournament Admin</h1>
          <div className="gold-divider" />
        </div>
      </div>

      {actionFeedback && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm font-sans text-blue-800">
          {actionFeedback}
        </div>
      )}

      <div className="mb-5 bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold font-sans text-darktext">Recent Admin Actions</h2>
          <span className="text-xs font-sans text-gray-500">Last {MAX_RECENT_ACTIONS}</span>
        </div>
        {!recentActions.length ? (
          <p className="text-xs text-gray-500 font-sans">No undoable actions yet.</p>
        ) : (
          <div className="space-y-2">
            {recentActions.map(action => (
              <div key={action.id} className="flex items-center justify-between gap-2 border border-gray-100 rounded-md px-3 py-2">
                <div>
                  <p className="text-sm font-sans text-darktext">{action.label}</p>
                  <p className="text-[11px] font-sans text-gray-500">{new Date(action.createdAt).toLocaleTimeString()}</p>
                </div>
                <button
                  onClick={() => undoRecentAction(action.id)}
                  className="text-xs font-sans px-2.5 py-1 rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  Undo
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <section className="mb-6 rounded-xl border border-forest/20 bg-gradient-to-br from-forest/[0.06] via-white to-gold/[0.08] p-4 sm:p-5">
        <p className="text-[11px] font-heading font-semibold uppercase tracking-widest text-forest/80">Tournament Command Center</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl font-heading text-darktext font-semibold">{tournament?.name ?? 'Select Tournament'}</h2>
            <p className="mt-1 text-sm font-sans text-gray-600">{tournament ? formatDateFull(tournament.date) : 'Choose a tournament to begin operations.'}</p>
            {tournament && (
              <div className="mt-3 inline-flex rounded-lg border border-forest/20 bg-white px-3 py-2">
                <CountdownTimer targetDate={tournament.date} />
              </div>
            )}
          </div>
          <div className="w-full lg:w-auto space-y-2">
            <label className="block text-xs font-heading font-semibold uppercase tracking-widest text-forest">Switch Tournament</label>
            <select
              value={tid}
              onChange={e => { setTid(e.target.value); setPoolSearch(''); setSelectedPool(new Set()) }}
              className="border border-gray-300 rounded-md px-3 py-2.5 text-sm font-sans w-full lg:min-w-[320px] focus:outline-none focus:ring-2 focus:ring-forest"
            >
              {!showPastTournaments && currentTournaments.length > 0 && (
                <optgroup label="Current & Upcoming">
                  {currentTournaments.map(t => <option key={t.id} value={t.id}>{t.name} — {t.date}</option>)}
                </optgroup>
              )}
              {!showPastTournaments && pastTournaments.some(t => t.id === tid) && (
                <optgroup label="Selected Past Tournament">
                  {pastTournaments.filter(t => t.id === tid).map(t => (
                    <option key={t.id} value={t.id}>{t.name} — {t.date}</option>
                  ))}
                </optgroup>
              )}
              {showPastTournaments && pastTournaments.length > 0 && (
                <optgroup label="Past Tournaments">
                  {pastTournaments.map(t => <option key={t.id} value={t.id}>{t.name} — {t.date}</option>)}
                </optgroup>
              )}
              {archivedTournaments.length > 0 && (
                <optgroup label="Archived (Previous Seasons)">
                  {archivedTournaments.map(t => <option key={t.id} value={t.id}>{t.name} — {t.date}</option>)}
                </optgroup>
              )}
            </select>
            <button
              type="button"
              onClick={() => {
                const next = !showPastTournaments
                setShowPastTournaments(next)
                if (next) {
                  const alreadyPast = pastTournaments.some(t => t.id === tid) || archivedTournaments.some(t => t.id === tid)
                  if (!alreadyPast && pastTournaments.length > 0) {
                    setTid(pastTournaments[0].id)
                    setPoolSearch('')
                    setSelectedPool(new Set())
                  }
                }
              }}
              className="text-xs font-sans font-semibold px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:border-forest hover:text-forest"
            >
              {showPastTournaments ? 'Hide Past Tournaments' : 'Past Tournaments'}
            </button>
          </div>
        </div>
        {tournament && (
          <p className="mt-3 text-xs text-gray-500 font-sans">
            {tournament.course} · {tournament.format} · {totalPlayers} player{totalPlayers !== 1 ? 's' : ''} entered
          </p>
        )}
      </section>

      <section className="mb-6 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          {hasUnsavedDrafts ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-sans font-semibold border-amber-300 bg-amber-50 text-amber-800">
                Unsaved changes
              </span>
              <button
                onClick={saveAllDirtyDrafts}
                disabled={saveAllSaving || anySectionSaving || savableUnsavedDrafts.length === 0}
                className="px-3 py-2 text-xs font-sans font-semibold rounded-md bg-forest text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saveAllSaving ? 'Saving…' : 'Save All'}
              </button>
              <button
                onClick={discardAllDirtyDrafts}
                disabled={saveAllSaving || anySectionSaving}
                className="px-3 py-2 text-xs font-sans font-semibold rounded-md border border-amber-300 text-amber-700 hover:bg-amber-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                Discard All
              </button>
            </div>
          ) : <div />}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <button
              type="button"
              onClick={() => {
                const action = workflowActions[nextWorkflowStep.key]
                if (!action) return
                if (nextWorkflowStep.key === 'memo') markMemoSent(dashboardTid)
                if (nextWorkflowStep.key === 'birdie') generateBirdieExport(dashboardTid)
                if (nextWorkflowStep.key === 'payout') generatePayoutDocument(dashboardTid)
                if (nextWorkflowStep.key === 'export') setAdminMode('exports')
                if (action.mode) setAdminMode(action.mode)
              }}
              className="inline-flex items-center justify-center rounded-md bg-forest px-3 py-2 text-xs font-sans font-semibold text-white hover:bg-forest/90"
            >
              {workflowActions[nextWorkflowStep.key]?.label ?? 'Continue'}
            </button>
            <span className="text-xs font-sans text-gray-500">{nextWorkflowStep.title}</span>
            <span className="hidden sm:inline text-gray-300">•</span>
            <span className="text-xs font-sans text-gray-500">{keyWorkflowStats}</span>
          </div>
        </div>
        {(saveAllStatus === 'err' || hasUnsavedDrafts) && (
          <p className="mt-2 text-[11px] font-sans text-gray-500">
            {saveAllStatus === 'err' && 'Some sections failed to sync. Review the error banner and retry. '}
            {hasUnsavedDrafts ? `Pending sections: ${unsavedDrafts.map(item => item.label).join(', ')}.` : ''}
          </p>
        )}
      </section>

      <section className="mb-6">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {primaryActions.map(action => (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              title={action.label}
              className={`inline-flex flex-shrink-0 items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-sans font-semibold whitespace-nowrap transition-colors ${
                action.active
                  ? 'border-[#0B1F3A] bg-[#0B1F3A] text-white shadow-sm'
                  : 'border-[#E5E0D4] bg-white text-[#0B1F3A] hover:bg-[#F6F4EF]'
              }`}
            >
              <action.Icon className="w-4 h-4 flex-shrink-0" />
              {action.label}
            </button>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════════
          SCORING OPERATIONS MODE
      ══════════════════════════════════════════════════════════════════════════ */}
      {adminMode === 'scores' && (
        <ScoreEntryPanel
          allFlights={ALL_SCORE_TABS}
          tournamentData={data[tid] ?? {}}
          poolMembersGrouped={poolMembersGrouped}
          poolTotalCount={poolTotalCount}
          poolSearch={poolSearch}
          setPoolSearch={setPoolSearch}
          selectedPool={selectedPool}
          togglePoolSelect={togglePoolSelect}
          toggleGroupSelect={toggleGroupSelect}
          addSelectedPlayers={addSelectedPlayers}
          removePlayerFromFlight={removePlayerFromFlight}
          updatePlayerInFlight={updatePlayerInFlight}
          clearFlightByName={clearFlightByName}
          fmtPM={fmtPM}
          fmtPOY={fmtPOY}
          onOpenPublishPreview={() => openPublishPreview(tid)}
          publishSaving={publishSaving}
          publishSaveStatus={publishSaveStatus}
          saveScores={saveScores}
          scoresSaving={scoresSaving}
          scoresSaveStatus={scoresSaveStatus}
          tournament={tournament}
          totalPlayers={totalPlayers}
          onExportResultsPDF={() => exportResultsPDF(tournament, effectiveFlightData)}
          pairingsPosted={pairingsPosted}
          onGoToPairings={() => setAdminMode('pairings')}
          onRemoveExtraFlight={(name) => setExtraFlights(prev => prev.filter(f => f !== name))}
          onImportScores={applyScoreImport}
          effectiveMembers={effectiveMembers}
        />
      )}

      {adminMode === 'dashboard' && (
        <DashboardPanel
          nextTournament={nextTournamentInfo}
          selectedTournament={dashboardTournament}
          workflow={dashboardWorkflow}
          lastPublishedTournament={lastPublishedTournament}
          hasUnsavedDrafts={hasUnsavedDrafts}
          unsavedDrafts={unsavedDrafts}
          onRepublish={async () => {
            if (!lastPublishedTournament) return
            setTid(lastPublishedTournament.id)
            openPublishPreview(lastPublishedTournament.id)
          }}
          publishSaving={publishSaving}
          onGoToScores={() => setAdminMode('scores')}
          onGoToPayments={() => setAdminMode('payments')}
          onGoToPairings={() => setAdminMode('pairings')}
          onMarkMemoSent={() => markMemoSent(dashboardTid)}
          onUndoMemoSent={() => unmarkMemoSent(dashboardTid)}
          onFinalizeField={() => finalizeField(dashboardTid)}
          onUnfinalizeField={() => unfinalizeField(dashboardTid)}
          onExportBirdiePool={() => generateBirdieExport(dashboardTid)}
          onGeneratePayout={() => generatePayoutDocument(dashboardTid)}
          tournamentCompletionOverrides={liveTournamentStatus?.completed ?? {}}
          onMarkComplete={() => markTournamentComplete(dashboardTid)}
          onUnmarkComplete={() => unmarkTournamentComplete(dashboardTid)}
        />
      )}

      {publishPreview && (
        <PublishConfirmModal
          preview={publishPreview}
          publishSaving={publishSaving}
          publishSaveStatus={publishSaveStatus}
          onCancel={() => !publishSaving && setPublishPreview(null)}
          onConfirm={confirmPublishPreview}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          PAIRINGS BUILDER MODE
      ══════════════════════════════════════════════════════════════════════════ */}
      {adminMode === 'pairings' && (
        <PairingsPanel
          totalPlayers={totalPlayers}
          currentPairings={currentPairings}
          unpairedPlayers={unpairedPlayers}
          allEnteredPlayers={allEnteredPlayers}
          manualPairings={manualPairings}
          selectedUnpaired={selectedUnpaired}
          setSelectedUnpaired={setSelectedUnpaired}
          generatePairings={generatePairings}
          startManualPairings={startManualPairings}
          addGroupManual={addGroupManual}
          removeGroupManual={removeGroupManual}
          assignUnpairedToGroup={assignUnpairedToGroup}
          movePlayerManual={movePlayerManual}
          clearPairings={clearPairings}
          removePairedPlayer={removePairedPlayer}
          savePairings={savePairings}
          pairingsSaving={pairingsSaving}
          pairingsSaveStatus={pairingsSaveStatus}
          pairingsState={dashboardWorkflow.counts.pairingsState}
          onExportPairingsPDF={() => exportPairingsPDF(tournament, currentPairings)}
          tournament={tournament}
          flightTagStyles={flightTagStyles}
          pairingRules={pairingRules}
          setPairingRules={setPairingRules}
          onImportPairings={importPairingsFromGroups}
          allEnteredPlayerNames={new Set(ALL_SCORE_TABS.flatMap(fl => (data[tid]?.[fl] ?? []).map(p => p.name)))}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          FIELD SETUP & SETTINGS MODE
      ══════════════════════════════════════════════════════════════════════════ */}
      {adminMode === 'operations' && (
        <div className="space-y-5">
          <section className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-heading font-semibold uppercase tracking-widest text-forest mb-3">Player Management</p>
            <FlightManagementPanel
              effectiveMembers={effectiveMembers}
              membersData={membersData}
              credits={credits}
              flightSearch={flightSearch}
              setFlightSearch={setFlightSearch}
              updateMemberFlight={updateMemberFlight}
              updateMemberPtm={updateMemberPtm}
              updateMemberTee={updateMemberTee}
              updateMemberName={updateMemberName}
              updateMemberCell={updateMemberCell}
              removeMember={removeMember}
              openConfirm={openConfirm}
              applyCredit={applyCredit}
              savePlayerManagement={savePlayerManagement}
              playerManagementSaving={membersSaving || creditsSaving}
              playerManagementSaveStatus={membersSaveStatus === 'err' || creditsSaveStatus === 'err'
                ? 'err'
                : (membersSaveStatus === 'ok' || creditsSaveStatus === 'ok' ? 'ok' : null)}
              flightTagStyles={flightTagStyles}
              fileInputRef={fileInputRef}
              handleXlsxFile={handleXlsxFile}
              importPreview={importPreview}
              setImportPreview={setImportPreview}
              confirmImport={confirmImport}
              importSaving={importSaving}
              importStatus={importStatus}
              importError={importError}
              setImportError={setImportError}
              allFlights={ALL_SCORE_TABS}
            />
          </section>

          <BeginningPtmPanel livePtmData={livePtmData?.length ? livePtmData : membersData} logChange={logChange} openConfirm={openConfirm} />
          <RetroEligibilityPanel currentPoy={currentPoy} roundsLookup={roundsLookup} openConfirm={openConfirm} logChange={logChange} />
        </div>
      )}

      {adminMode === 'users' && (
        <UsersPanel
          users={filteredUsers}
          userSearch={userSearch}
          setUserSearch={setUserSearch}
          newUser={newUser}
          setNewUser={setNewUser}
          addUser={addUser}
          updateUser={updateUser}
          toggleUserStatus={toggleUserStatus}
          saveUsers={saveUsers}
          usersSaving={usersSaving}
          usersSaveStatus={usersSaveStatus}
        />
      )}


      {/* ════════════════════════════════════════════════════════════════════════
          CHANGELOG MODE
      ════════════════════════════════════════════════════════════════════════ */}
      {adminMode === 'changelog' && (
        <ChangelogPanel changelog={changelog} />
      )}

      {adminMode === 'snapshots' && (
        <SnapshotsPanel snapshots={snapshots} onRestore={restoreSnapshot} />
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PAYMENTS MODE
      ════════════════════════════════════════════════════════════════════════ */}
      {adminMode === 'payments' && (
        <AdminPaymentsPanel
          paymentSearch={paymentSearch}
          setPaymentSearch={setPaymentSearch}
          paymentPaidCount={paymentPaidCount}
          activeMemberCount={membersData.filter(m => m.active !== false).length}
          savePayments={savePayments}
          paymentsSaving={paymentsSaving}
          paymentsSaveStatus={paymentsSaveStatus}
          onExportPaymentsPDF={() => exportPaymentsPDF(tournament, paymentMap, membersData, preTournamentPlayerData)}
          onExportPaymentsXLSX={() => exportPaymentsXLSX(tournament, paymentMap, membersData, preTournamentPlayerData)}
          onClearAllPayments={() => clearAllPayments(tid)}
          tournament={tournament}
          paymentRoster={paymentRoster}
          paymentMap={paymentMap}
          credits={credits}
          paymentMeta={paymentMeta}
          tid={tid}
          paymentCreditInputs={paymentCreditInputs}
          setPaymentCreditInputs={setPaymentCreditInputs}
          onMarkAllPaid={(names) => markAllPaid(tid, names)}
          onTogglePayment={(name) => togglePayment(tid, name)}
          onMarkPaidWithCredit={(name, creditInput) => markPaidWithCredit(tid, name, creditInput)}
          fieldFinalized={Boolean(tournamentLifecycle[tid]?.fieldFinalizedAt)}
          onFinalizeField={() => finalizeField(tid)}
          onUnfinalizeField={() => unfinalizeField(tid)}
          SaveBtn={SaveBtn}
          PdfBtn={PdfBtn}
          XlsxBtn={XlsxBtn}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          FLIGHTS MODE
      ════════════════════════════════════════════════════════════════════════ */}
      {adminMode === 'flights' && (
        <AdminFlightCalculatorPanel
          enteredPlayers={enteredPlayers}
          flightTagStyles={flightTagStyles}
          onSaveFlights={saveFlights}
          saving={flightsSaving}
          extraFlights={extraFlights}
          onAddExtraFlight={(name) => {
            const trimmed = name.trim()
            if (!trimmed || FLIGHTS.includes(trimmed) || trimmed === NEW_PLAYERS_FLIGHT || extraFlights.includes(trimmed)) return
            setExtraFlights(prev => [...prev, trimmed])
          }}
        />
      )}

      {adminMode === 'exports' && (
        <ExportPanel
          tournament={tournament}
          tournamentInfo={tournamentInfo}
          totalPlayers={totalPlayers}
          currentPairings={currentPairings}
          paymentPaidCount={paymentPaidCount}
          credits={credits}
          onOpenTournamentInfoEditor={() => setShowTournamentInfoEditor(true)}
          onExportPtmPDF={() => exportPtmPDF(membersData, livePtmData, preTournamentPlayerData)}
          onExportPtmXLSX={() => exportPtmXLSX(membersData, livePtmData, preTournamentPlayerData)}
          onExportResultsPDF={() => exportResultsPDF(tournament, effectiveFlightData)}
          onExportResultsXLSX={() => exportResultsXLSX(tournament, effectiveFlightData)}
          onExportPairingsPDF={() => exportPairingsPDF(tournament, currentPairings)}
          onExportPaymentsPDF={() => exportPaymentsPDF(tournament, paymentMap, membersData, preTournamentPlayerData)}
          onExportPaymentsXLSX={() => exportPaymentsXLSX(tournament, paymentMap, membersData, preTournamentPlayerData)}
          onExportCreditsPDF={() => exportCreditsPDF(credits, membersData)}
          onExportCreditsXLSX={() => exportCreditsXLSX(credits, membersData)}
          onExportBirdiePoolXLSX={() => exportBirdiePoolXLSX(tournament, data[tid] ?? {}, ALL_SCORE_TABS)}
        />
      )}

      {showTournamentInfoEditor && tournamentInfo && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg border border-gold/20 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-forest font-sans">Tournament Info Editor</h3>
                <p className="text-xs text-gray-500 font-sans mt-1">
                  Edit details used for this session&apos;s Tournament Info PDF before exporting.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => resetTournamentInfoDraft(tournament.id)}
                  className="px-2.5 py-1.5 text-[11px] font-semibold font-sans rounded-md border border-gray-300 text-gray-600 hover:bg-white transition-colors"
                >
                  Reset Draft
                </button>
                <button
                  type="button"
                  onClick={() => setShowTournamentInfoEditor(false)}
                  className="px-2.5 py-1.5 text-[11px] font-semibold font-sans rounded-md border border-gray-300 text-gray-600 hover:bg-white transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 font-sans">Tournament Name</span>
                <input
                  value={tournamentInfo.name ?? ''}
                  onChange={e => updateTournamentInfoDraft(tournament.id, 'name', e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm font-sans text-darktext focus:outline-none focus:ring-2 focus:ring-forest/30"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 font-sans">Course</span>
                <input
                  value={tournamentInfo.course ?? ''}
                  onChange={e => updateTournamentInfoDraft(tournament.id, 'course', e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm font-sans text-darktext focus:outline-none focus:ring-2 focus:ring-forest/30"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 font-sans">Date (YYYY-MM-DD)</span>
                <input
                  value={tournamentInfo.date ?? ''}
                  onChange={e => updateTournamentInfoDraft(tournament.id, 'date', e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm font-sans text-darktext focus:outline-none focus:ring-2 focus:ring-forest/30"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 font-sans">Registration Deadline (YYYY-MM-DD)</span>
                <input
                  value={tournamentInfo.dueDate ?? ''}
                  onChange={e => updateTournamentInfoDraft(tournament.id, 'dueDate', e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm font-sans text-darktext focus:outline-none focus:ring-2 focus:ring-forest/30"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 font-sans">Tee Time</span>
                <input
                  value={tournamentInfo.teeTime ?? ''}
                  onChange={e => updateTournamentInfoDraft(tournament.id, 'teeTime', e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm font-sans text-darktext focus:outline-none focus:ring-2 focus:ring-forest/30"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 font-sans">Entry Fee</span>
                <input
                  value={tournamentInfo.entryFee ?? ''}
                  onChange={e => updateTournamentInfoDraft(tournament.id, 'entryFee', e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm font-sans text-darktext focus:outline-none focus:ring-2 focus:ring-forest/30"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 font-sans">Format</span>
                <input
                  value={tournamentInfo.format ?? ''}
                  onChange={e => updateTournamentInfoDraft(tournament.id, 'format', e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm font-sans text-darktext focus:outline-none focus:ring-2 focus:ring-forest/30"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 font-sans">Admin Notes</span>
                <textarea
                  value={tournamentInfo.notes ?? ''}
                  onChange={e => updateTournamentInfoDraft(tournament.id, 'notes', e.target.value)}
                  rows={3}
                  placeholder="Add optional notes to include on the Tournament Info PDF…"
                  className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm font-sans text-darktext focus:outline-none focus:ring-2 focus:ring-forest/30"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <PdfBtn onClick={() => exportTournamentInfoPDF(tournamentInfo, { onAssetWarning: setAdminError })}>
                Export Selected Tournament Info
              </PdfBtn>
              <PdfBtn onClick={() => exportTournamentInfoPDF(nextTournamentInfo, { onAssetWarning: setAdminError })} disabled={!nextTournamentInfo}>
                Export Next Tournament Info
              </PdfBtn>
            </div>
          </div>
        </div>
      )}

      {pendingConfirm && (
        <ConfirmModal
          message={pendingConfirm.message}
          onConfirm={() => resolveConfirm(true)}
          onCancel={() => resolveConfirm(false)}
        />
      )}
    </PageWrapper>
  )
}
