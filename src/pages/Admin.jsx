import { useState, useMemo, useEffect, useRef } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import * as XLSXStyle from 'xlsx-js-style'
import { Link } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import schedule from '../data/schedule.json'
import { formatName, compareByLastName } from '../utils/formatName'
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
import { compareFlights, FLIGHT_ORDER, NEW_PLAYERS_FLIGHT } from '../utils/flightOrder'
import { calcPtmFromHistory, roundPtm } from '../utils/roundPtm'
import { AdminPaymentsPanel } from './admin/AdminPaymentsPanel'
import { AdminFlightCalculatorPanel } from './admin/AdminFlightCalculatorPanel'

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

const PDF_NAVY = [27,  59,  111]
const PDF_GOLD = [201, 168, 76]

function AdminActionIcon({ children, className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  )
}

const DashboardIcon = ({ className }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13h7V3H3v10zm11 8h7V11h-7v10zM3 21h7v-4H3v4zm11-10h7V3h-7v8z" />
  </AdminActionIcon>
)

const ReceiptIcon = ({ className }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3h10l2 2v16l-3-2-3 2-3-2-3 2V5l2-2z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6M9 13h6" />
  </AdminActionIcon>
)

const UsersIcon = ({ className }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11a4 4 0 100-8 4 4 0 000 8zM8 13a4 4 0 100-8 4 4 0 000 8zM2 21a6 6 0 0112 0M14 21a6 6 0 018 0" />
  </AdminActionIcon>
)

const GolfFlagIcon = ({ className }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21V3m0 0h10l-2.5 3L18 9H8" />
  </AdminActionIcon>
)

const TrophyIcon = ({ className }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4h8v3a4 4 0 01-8 0V4zm-3 1h3v2a5 5 0 01-3-2zm14 0h-3v2a5 5 0 003-2zM10 14h4m-5 6h6" />
  </AdminActionIcon>
)

const ExportIcon = ({ className }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0l4-4m-4 4l-4-4M5 15v3h14v-3" />
  </AdminActionIcon>
)

const FolderIcon = ({ className }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h6l2 2h10v10H3V7z" />
  </AdminActionIcon>
)

const ArchiveIcon = ({ className }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4h14a1 1 0 011 1v2H4V5a1 1 0 011-1zm0 4h14v12a1 1 0 01-1 1H6a1 1 0 01-1-1V8zm5 4h4" />
  </AdminActionIcon>
)

const ClockListIcon = ({ className }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </AdminActionIcon>
)

const LayersIcon = ({ className }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </AdminActionIcon>
)

const LockIcon = ({ className = 'w-10 h-10 text-gray-300' }) => (
  <AdminActionIcon className={className}>
    <rect x="6" y="11" width="12" height="9" rx="2" strokeWidth={2} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11V8a3 3 0 116 0v3" />
  </AdminActionIcon>
)

const CheckIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </AdminActionIcon>
)

const ErrorIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <AdminActionIcon className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
  </AdminActionIcon>
)


const flightTagStyles = {
  Championship: 'bg-amber-50 text-amber-700 border-amber-200',
  '1st Flight': 'bg-blue-50 text-blue-700 border-blue-200',
  '2nd Flight': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  '3rd Flight': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '4th Flight': 'bg-purple-50 text-purple-700 border-purple-200',
  '5th Flight': 'bg-pink-50 text-pink-700 border-pink-200',
  Unassigned:    'bg-gray-100 text-gray-600 border-gray-200',
  'New Players': 'bg-teal-50 text-teal-700 border-teal-200',
}

// ── POY calculation ────────────────────────────────────────────────────────────
const POY_BASE_POINTS    = 350  // points awarded to the flight winner
const POY_POINTS_PER_RANK = 25  // points deducted per rank position below first

function calcFlightPOY(players) {
  if (!players.length) return players
  const n     = players.length
  const scale = Array.from({ length: n }, (_, i) => POY_BASE_POINTS - POY_POINTS_PER_RANK * i)

  const withPM = players.map((p, i) => {
    const hasData = !p.wd && p.ptm !== '' && p.score !== '' && p.ptm != null && p.score != null
    return { ...p, _i: i, _has: hasData, plusMinus: hasData ? Number(p.score) - Number(p.ptm) : null }
  })

  const complete = withPM.filter(p => p._has).sort((a, b) => b.plusMinus - a.plusMinus)
  const rankMap  = {}
  let pos = 0
  while (pos < complete.length) {
    const val   = complete[pos].plusMinus
    const group = []
    let j = pos
    while (j < complete.length && complete[j].plusMinus === val) { group.push(j); j++ }
    const avg = group.reduce((s, idx) => s + (scale[idx] ?? 0), 0) / group.length
    group.forEach(idx => {
      rankMap[complete[idx]._i] = { rank: pos + 1, poy: complete[idx].eligible !== false ? avg : 0 }
    })
    pos = j
  }
  return withPM.map((p, i) => ({ ...p, rank: rankMap[i]?.rank ?? null, poy: rankMap[i]?.poy ?? null }))
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtPM  = pm => pm == null ? '—' : pm > 0 ? `+${pm}` : `${pm}`
const fmtPOY = p  => p.wd ? 'WD' : p.poy == null ? '—' : p.eligible === false ? 'X' : p.poy % 1 === 0 ? String(p.poy) : p.poy.toFixed(1)
const fmtCurrency = value => {
  const amount = Number.isFinite(Number(value)) ? Number(value) : 0
  return `$${amount.toFixed(2)}`
}
const fmtPtmValue = value => {
  const ptm = Number(value)
  return Number.isFinite(ptm) ? Math.round(ptm) : null
}

function sanitizeResultsData(flightData = {}) {
  const cleanNumber = (value) => {
    if (value === '' || value == null) return null
    const num = Number(value)
    return Number.isFinite(num) ? num : null
  }
  const cleanText = (value) => {
    if (value == null) return ''
    return String(value).replace(/[^\x20-\x7E]/g, '').trim()
  }

  return Object.fromEntries(FLIGHTS.map((flight) => {
    const rows = Array.isArray(flightData?.[flight]) ? flightData[flight] : []
    const normalizedRows = rows
      .filter(Boolean)
      .map((row) => {
        const score = cleanNumber(row?.score)
        const ptm = cleanNumber(row?.ptm)
        return {
          ...row,
          name: cleanText(row?.name),
          score,
          ptm,
          preEventPtm: ptm,
          plusMinus: (score == null || ptm == null) ? null : score - ptm,
        }
      })
      .filter(row => row.name)
    return [flight, normalizedRows]
  }))
}

function _hasAnyScores(sanitizedFlightData = {}) {
  return FLIGHTS.some(flight => (sanitizedFlightData[flight] ?? []).some(player => player.score != null))
}

// ── Excel roster parsing ──────────────────────────────────────────────────────
function normalizeTee(t) {
  if (!t) return null
  const s = String(t).trim().toUpperCase()
  if (s === 'BACK')  return 'Back'
  if (s === 'SR' || s === 'SENIOR') return 'Senior'
  if (s === 'FRONT') return 'Front'
  return null
}

/**
 * Parse an ArrayBuffer of an .xlsx file and return an array of
 * { name, tee, ptm, history, rounds } objects matched against membersData.
 * Returns { matched, unmatched, raw } where:
 *   matched   = rows we found a member for
 *   unmatched = rows from Excel we couldn't link to a member
 *   raw       = all parsed rows
 */
const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v'])

function parseRosterXlsx(buffer, membersList) {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName = wb.SheetNames.find(s => s.toLowerCase().includes('roster')) ?? wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null })

  // Build a reverse lookup: "First Last" → memberName
  // lastNameIdx uses the actual surname (skipping trailing suffixes like Jr/Sr/III)
  const exactLookup  = {}   // normalized "First Last" → memberName
  const lastNameIdx  = {}   // lowercase surname → [memberName, ...]

  for (const m of membersList) {
    exactLookup[m.name.toLowerCase()] = m.name
    const words = m.name.split(' ')
    const lastWord = words[words.length - 1].toLowerCase()
    // If the last word is a suffix, use the second-to-last word as the surname
    const surname = (NAME_SUFFIXES.has(lastWord) && words.length > 2)
      ? words[words.length - 2].toLowerCase()
      : lastWord
    if (!lastNameIdx[surname]) lastNameIdx[surname] = []
    lastNameIdx[surname].push(m.name)
  }

  function findMember(rawExcelName) {
    if (!rawExcelName) return null
    const nameStr = String(rawExcelName).trim()

    // If "Last, First" format, convert to "First Last" for lookup
    let firstName, lastName
    if (nameStr.includes(',')) {
      const parts = nameStr.split(',').map(s => s.trim())
      lastName = parts[0]
      firstName = parts.slice(1).join(' ').trim()
    } else {
      // "First Last" format
      const words = nameStr.split(/\s+/)
      firstName = words.slice(0, -1).join(' ')
      lastName = words[words.length - 1]
      if (!firstName) {
        // Single word, try exact lookup
        return exactLookup[nameStr.toLowerCase()] ?? null
      }
    }

    // Try direct reassembly: "First Last"
    const fullName = (firstName + ' ' + lastName).toLowerCase()
    if (exactLookup[fullName]) return exactLookup[fullName]

    // If firstName ends with a suffix (e.g. "Alan Sr"), try "First LastName Suffix"
    const firstParts = firstName.split(' ')
    const lastFirstPart = firstParts[firstParts.length - 1].toLowerCase()
    if (NAME_SUFFIXES.has(lastFirstPart) && firstParts.length > 1) {
      const firstOnly = firstParts.slice(0, -1).join(' ')
      const altName = (firstOnly + ' ' + lastName + ' ' + firstParts[firstParts.length - 1]).toLowerCase()
      if (exactLookup[altName]) return exactLookup[altName]
    }

    // Last-name fuzzy: if only one member has this surname, use it
    const lastLower = lastName.toLowerCase()
    const candidates = lastNameIdx[lastLower]
    if (candidates?.length === 1) return candidates[0]

    return null
  }

  // Detect the name column — try common header names case-insensitively
  const firstRowKeys = Object.keys(rows[0] ?? {})
  const nameColKey = firstRowKeys.find(k => /^(name|player|member|golfer|full.?name|member.?name)$/i.test(k))

  const matched   = []
  const unmatched = []

  for (const row of rows) {
    const rawName = (nameColKey ? row[nameColKey] : null) ?? row['__EMPTY'] ?? row['Name'] ?? row['Player'] ?? null
    if (!rawName) continue

    const tee             = normalizeTee(row['Tees'] ?? row['Tee'] ?? null)
    const ptm             = row['Points to make'] ?? row['PTM'] ?? null
    const creditOnBooks   = row['Credit on Books'] !== null ? Number(row['Credit on Books']) : null
    const email           = row['Email Address'] ?? row['Email'] ?? null
    const homePhone       = row['Home Phone'] ?? null
    const cellPhone       = row['Cell/Work'] ?? row['Cell'] ?? row['Work'] ?? row['Phone'] ?? null
    const history = [
      row['NEW'] ?? row['1st'] ?? null,
      row['2nd'] ?? null,
      row['3rd'] ?? null,
      row['4th'] ?? null,
      row['5th'] ?? null,
      row['6th'] ?? null,
      row['7th'] ?? null,
    ]
    const rounds = history.filter(v => v !== null).length

    const memberName = findMember(rawName)
    const entry = {
      rawName: String(rawName),
      tee, ptm, creditOnBooks, email, homePhone, cellPhone,
      history, rounds, memberName
    }

    if (memberName) matched.push(entry)
    else unmatched.push(entry)
  }

  return { matched, unmatched }
}

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

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
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

function fmtDateShort(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
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

// ── PDF utilities ──────────────────────────────────────────────────────────────
async function loadAssetBase64(url = `${import.meta.env.BASE_URL}cga-logo.png`) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve({
        data: reader.result,
        format: blob.type === 'image/png' ? 'PNG' : 'JPEG',
      })
      reader.onerror   = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

async function loadLogoBase64() {
  return loadAssetBase64()
}

async function buildPdfHeader(doc, title, subtitle = '') {
  const pw   = doc.internal.pageSize.getWidth()
  const logo = await loadLogoBase64()

  doc.setFillColor(...PDF_NAVY)
  doc.rect(0, 0, pw, 38, 'F')

  if (logo) doc.addImage(logo.data, logo.format, 10, 4, 30, 30)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text('Carencro Golf Association', 46, 15)

  doc.setDrawColor(...PDF_GOLD)
  doc.setLineWidth(0.8)
  doc.line(46, 18, pw - 10, 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...PDF_GOLD)
  doc.text(title, 46, 26)

  if (subtitle) {
    doc.setFontSize(8)
    doc.setTextColor(180, 195, 220)
    doc.text(subtitle, 46, 33)
  }

  doc.setDrawColor(...PDF_GOLD)
  doc.setLineWidth(1)
  doc.line(0, 38, pw, 38)

  return 46
}

function addPdfFooter(doc, note = '') {
  const pw    = doc.internal.pageSize.getWidth()
  const ph    = doc.internal.pageSize.getHeight()
  const total = doc.internal.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setDrawColor(...PDF_GOLD)
    doc.setLineWidth(0.4)
    doc.line(14, ph - 15, pw - 14, ph - 15)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(140, 140, 140)
    doc.text(note || 'Carencro Golf Association · CGA 2026', 14, ph - 10)
    doc.text(`Page ${i} of ${total}`, pw - 14, ph - 10, { align: 'right' })
  }
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

// ── PDF: Credit on Books ───────────────────────────────────────────────────────
async function exportCreditsPDF(credits, membersList) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  let y = await buildPdfHeader(doc, 'Credit on Books', `CGA 2026 · As of ${new Date().toLocaleDateString()}`)
  const rows = membersList
    .filter(m => m.active !== false)
    .map(m => ({ name: m.name, flight: m.flight ?? 'Unassigned', balance: credits[m.name] ?? 0 }))
    .sort(compareByLastName)
  const nonZeroCount = rows.filter(r => r.balance !== 0).length
  // Column widths must sum exactly to pageWidth − marginLeft − marginRight = 215.9 − 14 − 14 = 187.9mm
  autoTable(doc, {
    head: [['Player', 'Flight', 'Balance']],
    body: rows.map(r => [
      r.name, r.flight,
      r.balance === 0 ? '$0.00' : `${r.balance < 0 ? '−' : ''}$${Math.abs(r.balance).toFixed(2)}`,
    ]),
    startY: y, theme: 'striped',
    headStyles:         { fillColor: PDF_NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    styles:             { fontSize: 7.5, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 120.9 },
      1: { cellWidth: 38, halign: 'left' },
      2: { cellWidth: 29, halign: 'right' },
    },
    margin: { left: 14, right: 14, bottom: 20 },
    didParseCell(data) {
      if (data.section !== 'body') return
      const r = rows[data.row.index]
      if (!r) return
      if (data.column.index === 2) {
        if (r.balance > 0)      data.cell.styles.textColor = [0, 140, 60]
        else if (r.balance < 0) data.cell.styles.textColor = [180, 30, 30]
        else                    data.cell.styles.textColor = [180, 180, 180]
      }
      if (r.balance !== 0) data.cell.styles.fontStyle = 'bold'
    },
  })
  addPdfFooter(doc, `${nonZeroCount} member${nonZeroCount !== 1 ? 's' : ''} with a balance`)
  doc.save('cga-2026-credit-on-books.pdf')
}

// ── Excel: Credit on Books ────────────────────────────────────────────────────
function exportCreditsXLSX(credits, membersList) {
  const rows = membersList
    .filter(m => m.active !== false)
    .map(m => ({ name: m.name, flight: m.flight ?? 'Unassigned', balance: credits[m.name] ?? 0 }))
    .sort(compareByLastName)
  const total = rows.reduce((s, r) => s + r.balance, 0)
  const wb = XLSX.utils.book_new()
  const wsData = [
    ['Player', 'Flight', 'Credit on Books'],
    ...rows.map(r => [formatName(r.name), r.flight, r.balance]),
    ['', 'TOTAL', total],
  ]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Credit on Books')
  XLSX.writeFile(wb, 'cga-2026-credit-on-books.xlsx')
}

// ── Excel: Tournament Results ─────────────────────────────────────────────────
function exportResultsXLSX(tournament, flightData) {
  if (!tournament) return
  const sanitizedFlightData = sanitizeResultsData(flightData)
  const wb = XLSX.utils.book_new()
  for (const fl of FLIGHTS) {
    const rawPs = sanitizedFlightData[fl] ?? []
    const ps = calcFlightPOY(rawPs)
    if (!ps.length) continue
    const ranked   = [...ps].filter(p => p.rank != null).sort((a, b) => a.rank - b.rank || b.plusMinus - a.plusMinus)
    const unranked = ps.filter(p => p.rank == null)
    const rows = [...ranked, ...unranked]
    const wsData = [
      ['Rank', 'Player', 'PTM', 'Score', 'Net', 'POY Pts', 'Eligible'],
      ...rows.map(p => [
        p.rank ?? '',
        p.name,
        p.preEventPtm ?? '',
        p.score ?? '',
        p.plusMinus == null ? '' : p.plusMinus,
        p.poy == null && p.score != null ? 'Pending' : (p.poy == null ? '' : p.poy),
        p.eligible === false ? 'No' : 'Yes',
      ]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    XLSX.utils.book_append_sheet(wb, ws, fl.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 31))
  }
  XLSX.writeFile(wb, `${tournament.id.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-results.xlsx`)
}

function exportBirdiePoolXLSX(tournament, flightData, allFlights) {
  if (!tournament) return
  const SITE_BLUE = 'FF0B2E6D'
  const HEADER_NEUTRAL = 'FFEFF3F8'
  const TEXT_DARK = 'FF1F2937'
  const WHITE = 'FFFFFFFF'
  const ROW_GOLD_TINT = 'FFFFF9EC'
  const BORDER_COLOR = 'FFD1D5DB'

  const splitBirdieName = (name = '') => {
    const cleaned = String(name).trim()
    if (!cleaned) return { last: '', first: '' }
    if (cleaned.includes(',')) {
      const [last = '', ...firstParts] = cleaned.split(',')
      return {
        last: last.trim(),
        first: firstParts.join(',').trim(),
      }
    }
    const parts = cleaned.split(/\s+/).filter(Boolean)
    if (parts.length === 1) return { last: parts[0], first: '' }
    return {
      last: parts[parts.length - 1],
      first: parts.slice(0, -1).join(' '),
    }
  }

  const uniqueNames = [...new Set(
    allFlights.flatMap(flight => (flightData?.[flight] ?? []).map(player => player?.name).filter(Boolean))
  )].sort((a, b) => compareByLastName({ name: a }, { name: b }))
  const headers = ['#', 'Last', 'First', ...Array.from({ length: 18 }, (_, idx) => String(idx + 1))]
  const wsData = [
    headers,
    ...uniqueNames.map((name, index) => {
      const normalized = formatName(name)
      const { last, first } = splitBirdieName(normalized)
      return [index + 1, last, first, ...Array.from({ length: 18 }, () => '')]
    }),
  ]
  const ws = XLSXStyle.utils.aoa_to_sheet(wsData)

  ws['!cols'] = [
    { wch: 4 },  // #
    { wch: 18 }, // Last
    { wch: 16 }, // First
    ...Array.from({ length: 18 }, () => ({ wch: 4.5 })),
  ]
  ws['!freeze'] = { xSplit: 3, ySplit: 1, topLeftCell: 'D2', state: 'frozen', activePane: 'bottomRight' }

  const range = XLSXStyle.utils.decode_range(ws['!ref'] || `A1:${XLSXStyle.utils.encode_cell({ r: wsData.length - 1, c: headers.length - 1 })}`)
  const thinBorder = {
    top: { style: 'thin', color: { rgb: BORDER_COLOR } },
    bottom: { style: 'thin', color: { rgb: BORDER_COLOR } },
    left: { style: 'thin', color: { rgb: BORDER_COLOR } },
    right: { style: 'thin', color: { rgb: BORDER_COLOR } },
  }

  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const cellAddress = XLSXStyle.utils.encode_cell({ r: row, c: col })
      if (!ws[cellAddress]) ws[cellAddress] = { t: 's', v: '' }
      const isHeader = row === 0
      const isCoreHeader = isHeader && col <= 2
      const isHoleHeader = isHeader && col >= 3
      const isNameColumn = col === 1 || col === 2
      const isHoleCell = col >= 3
      const isEvenPlayerRow = row > 0 && row % 2 === 0
      const fillColor = isHeader
        ? (isCoreHeader ? HEADER_NEUTRAL : SITE_BLUE)
        : (isEvenPlayerRow ? ROW_GOLD_TINT : WHITE)

      ws[cellAddress].s = {
        font: {
          bold: isHeader || isNameColumn,
          color: { rgb: isHoleHeader ? WHITE : TEXT_DARK },
        },
        fill: { patternType: 'solid', fgColor: { rgb: fillColor }, bgColor: { rgb: fillColor } },
        alignment: {
          vertical: 'center',
          horizontal: isHoleCell || isHeader || col === 0 ? 'center' : 'left',
        },
        border: thinBorder,
      }
    }
  }

  const wb = XLSXStyle.utils.book_new()
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Birdie Pool')
  XLSXStyle.writeFile(wb, `${tournament.id.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-birdie-pool.xlsx`)
}

function exportPayoutDocXLSX(tournament, resultDoc) {
  if (!tournament || !resultDoc?.leaderboard) return false
  const wb = XLSX.utils.book_new()
  for (const [flight, rows] of Object.entries(resultDoc.leaderboard)
    .sort(([flightA], [flightB]) => compareFlights(flightA, flightB, { includeNewPlayers: true }))) {
    const ranked = (Array.isArray(rows) ? rows : [])
      .filter(row => (row.rank ?? 0) > 0)
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    const sheetRows = ranked.map(row => ({
      Rank: row.rank ?? '',
      Player: formatName(row.name),
      '+/-': row.plusMinus ?? '',
      POY: row.poy ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(sheetRows)
    XLSX.utils.book_append_sheet(wb, ws, flight.slice(0, 31))
  }
  XLSX.writeFile(wb, `${tournament.id.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-payout.xlsx`)
  return true
}

// ── Excel: Field Roster ──────────────────────────────────────────────────────
function exportPaymentsXLSX(tournament, paymentMap, membersList, preTournamentByName = {}) {
  if (!tournament) return
  const members = membersList.map(m => {
    const pre = preTournamentByName[m.name]
    return pre ? { ...m, flight: pre.flight ?? m.flight } : m
  })
  const wsData = [
    ['Player', 'Flight'],
    ...members
      .filter(m => m.active !== false && paymentMap[m.name])
      .slice()
      .sort(compareByLastName)
      .map(m => [m.name, m.flight ?? 'Unassigned']),
  ]
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = [{ wch: 28 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Field Roster')
  XLSX.writeFile(wb, `${tournament.id.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-field-roster.xlsx`)
}

// ── Excel: Points to Make ─────────────────────────────────────────────────────
function exportPtmXLSX(membersList, ptmList = [], preTournamentByName = {}) {
  const ptmByName = Object.fromEntries((ptmList || []).map(p => [p.name, p]))
  const enriched = membersList.map(m => {
    const p = ptmByName[m.name]
    const base = p ? { ...m, history: p.history ?? m.history } : m
    const pre = preTournamentByName[m.name]
    return pre?.ptm != null ? { ...base, ptm: pre.ptm } : base
  })
  membersList = enriched
  const roundLabels = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7']
  const memberRow = m => {
    const hist = Array.isArray(m.history) ? m.history : []
    return [
      m.flight ?? 'Unassigned',
      formatName(m.name),
      typeof m.ptm === 'number' ? Math.round(m.ptm) : (m.ptm ?? ''),
      m.tee ?? '',
      ...roundLabels.map((_, i) => hist[i] ?? ''),
    ]
  }
  const wsData = [
    ['Flight', 'Player', 'PTM', 'Tee', ...roundLabels],
    ...FLIGHTS.flatMap(fl =>
      membersList
        .filter(m => m.active !== false && m.flight === fl)
        .slice()
        .sort(compareByLastName)
        .map(memberRow)
    ),
    ...membersList
      .filter(m => m.active !== false && !FLIGHTS.includes(m.flight))
      .slice()
      .sort(compareByLastName)
      .map(memberRow),
  ]
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  XLSX.utils.book_append_sheet(wb, ws, 'Points to Make')
  XLSX.writeFile(wb, 'cga-2026-points-to-make.xlsx')
}

// ── Excel button component ────────────────────────────────────────────────────
function XlsxBtn({ onClick, children, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-semibold rounded border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
      {children}
    </button>
  )
}

// ── PDF button component ───────────────────────────────────────────────────────
function PdfBtn({ onClick, children, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-semibold rounded border border-red-300 text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
      </svg>
      {children}
    </button>
  )
}

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

// ── Confirm dialog ────────────────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-sm w-full p-5">
        <p className="text-sm font-sans text-gray-800 mb-5 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-sans font-semibold rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            autoFocus
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-sans font-semibold rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
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
        <h1 className="font-serif text-xl font-bold text-darktext mb-2">Admin Access Required</h1>
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
        <p className="text-[11px] font-sans font-semibold uppercase tracking-widest text-forest/80">Tournament Command Center</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl font-serif text-darktext font-semibold">{tournament?.name ?? 'Select Tournament'}</h2>
            <p className="mt-1 text-sm font-sans text-gray-600">{tournament ? fmtDate(tournament.date) : 'Choose a tournament to begin operations.'}</p>
            {tournament && (
              <div className="mt-3 inline-flex rounded-lg border border-forest/20 bg-white px-3 py-2">
                <CountdownTimer targetDate={tournament.date} />
              </div>
            )}
          </div>
          <div className="w-full lg:w-auto space-y-2">
            <label className="block text-xs font-sans font-semibold uppercase tracking-widest text-forest">Switch Tournament</label>
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
            <p className="text-xs font-sans font-semibold uppercase tracking-widest text-forest mb-3">Player Management</p>
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

function DashboardPanel({
  nextTournament, selectedTournament, workflow,
  lastPublishedTournament, hasUnsavedDrafts, unsavedDrafts, onRepublish, publishSaving,
  onGoToScores, onGoToPayments, onGoToPairings, onMarkMemoSent, onUndoMemoSent, onFinalizeField, onUnfinalizeField, onExportBirdiePool, onGeneratePayout,
  tournamentCompletionOverrides, onMarkComplete, onUnmarkComplete,
}) {
  const fieldFinalized = workflow.counts.fieldFinalized
  const memoSent = workflow.lifecycleSteps.find(s => s.key === 'memo')?.status === 'complete'
  const lifecycleActions = {
    memo: memoSent
      ? { label: 'Mark Sent', action: onMarkMemoSent, secondary: { label: 'Undo Sent', action: onUndoMemoSent } }
      : { label: 'Mark Sent', action: onMarkMemoSent },
    field: fieldFinalized
      ? { label: 'Undo Finalize', action: onUnfinalizeField }
      : { label: 'Finalize Field', action: onFinalizeField, secondary: { label: 'Review Entries', action: onGoToPayments } },
    pairingsLifecycle: { label: workflow.counts.pairingsState === 'published' ? 'Edit Pairings' : 'Generate Pairings', action: onGoToPairings },
    birdie: { label: 'Export', action: onExportBirdiePool },
    scoresLifecycle: { label: workflow.counts.resultsPublished ? 'View Results' : 'Enter Scores', action: onGoToScores },
    payout: { label: 'Generate', action: onGeneratePayout },
  }

  const selectedId = selectedTournament?.id
  // A tournament is statically completed if schedule.json already says so
  const isStaticCompleted = selectedTournament?.status === 'completed'
  // A tournament is dynamically completed if the admin marked it at runtime
  const isDynamicCompleted = !!(tournamentCompletionOverrides ?? {})[selectedId]

  return (
    <div className="space-y-5">
      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <p className="text-xs font-sans font-semibold uppercase tracking-widest text-forest mb-2">Overview</p>
        <h2 className="text-darktext font-serif text-2xl font-semibold mb-1">{selectedTournament?.name ?? 'No tournament selected'}</h2>
        <p className="text-gray-500 font-sans text-sm mb-4">{selectedTournament?.date ? fmtDate(selectedTournament.date) : 'No date available'}</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard label="Field" value={`${workflow.counts.enteredCount} / ${workflow.counts.fieldCap}`} detail={`${Math.max(workflow.counts.fieldCap - workflow.counts.enteredCount, 0)} spots remaining`} />
          <MetricCard label="Paid" value={`${workflow.counts.paidCount}`} detail={workflow.counts.enteredCount > 0 ? `${workflow.counts.enteredCount - workflow.counts.paidCount} unpaid` : 'No entries yet'} />
          <MetricCard label="Pairings" value={workflow.counts.pairingsState === 'published' ? 'Published' : workflow.counts.pairingsState === 'draft' ? 'Draft' : 'Not Started'} detail={`${workflow.counts.pairedCount}/${workflow.counts.enteredCount || 0} grouped`} />
          <MetricCard label="Scores" value={`${workflow.counts.scoredCount}/${workflow.counts.enteredCount || 0}`} detail={workflow.counts.scoredCount === 0 ? 'Not started' : workflow.counts.scoredCount >= workflow.counts.enteredCount && workflow.counts.enteredCount > 0 ? 'Complete' : 'In progress'} />
          <MetricCard label="Results / Payout" value={workflow.counts.resultsPublished ? 'Published' : 'Pending'} detail={workflow.lifecycleSteps.find(step => step.key === 'payout')?.label ?? 'Payout status unavailable'} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={onGoToPayments} className="px-3 py-2 text-xs font-sans font-semibold rounded-md border border-forest/30 text-forest hover:bg-forest/5">Entries</button>
          <button onClick={onGoToPairings} className="px-3 py-2 text-xs font-sans font-semibold rounded-md border border-forest/30 text-forest hover:bg-forest/5">Pairings</button>
          <button onClick={onGoToScores} className="px-3 py-2 text-xs font-sans font-semibold rounded-md border border-forest/30 text-forest hover:bg-forest/5">Scores / Results</button>
        </div>

        {selectedTournament && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-[11px] font-sans font-semibold uppercase tracking-widest text-gray-500 mb-2">Site Completion Status</p>
            {isStaticCompleted ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-100 border border-gray-200">
                <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" />
                <span className="text-xs font-sans font-semibold text-gray-600">Completed (built into schedule)</span>
              </div>
            ) : isDynamicCompleted ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-green-50 border border-green-200">
                  <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  <span className="text-xs font-sans font-semibold text-green-700">Marked Complete — site updated</span>
                </div>
                <button
                  onClick={onUnmarkComplete}
                  className="px-3 py-1.5 text-xs font-sans font-semibold rounded-md border border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors"
                >
                  Undo Completion
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white border border-gray-200">
                  <span className="w-2 h-2 rounded-full bg-gold flex-shrink-0 animate-pulse" />
                  <span className="text-xs font-sans font-semibold text-gray-600">Upcoming — not yet complete</span>
                </div>
                <button
                  onClick={onMarkComplete}
                  className="px-3 py-1.5 text-xs font-sans font-semibold rounded-md bg-forest text-white hover:bg-forest/90 transition-colors"
                >
                  Mark Tournament Complete
                </button>
              </div>
            )}
            <p className="mt-2 text-[11px] font-sans text-gray-400">
              Marking complete updates the home page next-tournament banner and the full schedule instantly across the site.
            </p>
          </div>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <p className="text-xs font-sans font-semibold uppercase tracking-widest text-forest mb-2">Next Tournament</p>
        {nextTournament ? (
          <>
            <h2 className="text-darktext font-serif text-2xl font-semibold mb-1">{nextTournament.name}</h2>
            <p className="text-gray-500 font-sans text-sm mb-4">{fmtDate(nextTournament.date)}</p>
            <CountdownTimer targetDate={nextTournament.date} />
          </>
        ) : (
          <p className="text-gray-500 font-sans text-sm">No upcoming tournaments on schedule.</p>
        )}
      </section>

      {hasUnsavedDrafts && (
        <section className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="text-amber-800 font-sans font-semibold text-sm mb-1">Unsaved Drafts Detected</h3>
          <p className="text-amber-700 font-sans text-xs">
            Local-only changes exist in: {unsavedDrafts.map(item => item.label).join(', ')}.
          </p>
        </section>
      )}

      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <TournamentWorkflowTracker workflow={{ steps: workflow.lifecycleSteps }} actions={lifecycleActions} />
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <p className="text-xs font-sans font-semibold uppercase tracking-widest text-forest mb-2">Last Published Tournament</p>
        {lastPublishedTournament ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-darktext font-serif text-xl font-semibold">{lastPublishedTournament.name}</h3>
              <p className="text-gray-500 font-sans text-sm">{fmtDateShort(lastPublishedTournament.date)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/tournaments"
                state={{ expand: lastPublishedTournament.id }}
                className="px-3 py-2 text-xs font-sans font-semibold rounded-md bg-white text-gray-600 border border-gray-300 hover:text-forest hover:border-forest"
              >
                View Results
              </Link>
              <button
                onClick={onRepublish}
                disabled={publishSaving}
                className="px-3 py-2 text-xs font-sans font-semibold rounded-md bg-forest text-white disabled:opacity-60"
              >
                {publishSaving ? 'Publishing…' : 'Re-publish'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 font-sans text-sm">No published tournament results found.</p>
        )}
      </section>
    </div>
  )
}

function MetricCard({ label, value, detail }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-[11px] font-sans font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 stat-number text-2xl text-forest leading-none">{value}</p>
      <p className="mt-1 text-xs font-sans text-gray-500">{detail}</p>
    </div>
  )
}

function TournamentWorkflowTracker({ workflow, actions = {} }) {
  const statusStyles = {
    complete: {
      dot: 'bg-green-500',
      card: 'bg-green-50 border-green-200',
      title: 'text-green-800',
      text: 'text-green-700',
      badge: 'Complete',
      badgeStyle: 'bg-green-100 text-green-700',
    },
    partial: {
      dot: 'bg-amber-500',
      card: 'bg-amber-50 border-amber-200',
      title: 'text-amber-800',
      text: 'text-amber-700',
      badge: 'In progress',
      badgeStyle: 'bg-amber-100 text-amber-700',
    },
    not_started: {
      dot: 'bg-gray-300',
      card: 'bg-gray-50 border-gray-200',
      title: 'text-gray-700',
      text: 'text-gray-500',
      badge: 'Not started',
      badgeStyle: 'bg-gray-200 text-gray-600',
    },
  }

  return (
    <div>
      <p className="text-xs font-sans font-semibold uppercase tracking-widest text-forest mb-2">Tournament Workflow</p>
      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {workflow.steps.map((step, idx) => {
          const style = statusStyles[step.status]
          const actionMeta = actions[step.key]
          return (
            <li key={step.key} className={`border rounded-lg p-3 ${style.card}`}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${style.dot}`} />
                  <span className="text-[11px] font-sans font-semibold text-gray-500">{idx + 1}</span>
                </div>
                <span className={`text-[10px] font-sans font-semibold uppercase px-1.5 py-0.5 rounded ${style.badgeStyle}`}>{style.badge}</span>
              </div>
              <p className={`text-xs font-sans font-semibold leading-snug ${style.title}`}>{step.title}</p>
              <p className={`text-xs font-sans mt-1 ${style.text}`}>{step.label}</p>
              {actionMeta?.action && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <button
                    onClick={actionMeta.action}
                    className="px-2.5 py-1 text-[11px] font-sans font-semibold rounded border border-forest/30 text-forest hover:bg-forest/5"
                  >
                    {actionMeta.label}
                  </button>
                  {actionMeta.secondary?.action && (
                    <button
                      onClick={actionMeta.secondary.action}
                      className="px-2.5 py-1 text-[11px] font-sans font-semibold rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
                    >
                      {actionMeta.secondary.label}
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ── Reusable Save Button ──────────────────────────────────────────────────────
function SaveBtn({ onClick, saving, status, label = 'Save to Cloud', className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className={`flex items-center gap-1.5 px-4 py-2 text-xs font-sans font-semibold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
        status === 'ok'  ? 'bg-green-600 text-white' :
        status === 'err' ? 'bg-red-500   text-white' :
                           'bg-forest    text-white hover:bg-forest/90'
      } ${className}`}
    >
      {saving ? (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
      ) : status === 'ok' ? (
        <>
          <CheckIcon />
          <span>Saved</span>
        </>
      ) : status === 'err' ? (
        <>
          <ErrorIcon />
          <span>Error</span>
        </>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      )}
      {!saving && status !== 'ok' && status !== 'err' && label}
    </button>
  )
}

// ── Changelog Panel ────────────────────────────────────────────────────────────
const ACTION_LABELS = {
  'Scores saved':      { color: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400'   },
  'Pairings saved':    { color: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-400' },
  'Payments saved':    { color: 'bg-green-100 text-green-700',  dot: 'bg-green-400'  },
  'Credits saved':     { color: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400'  },
  'Members saved':     { color: 'bg-teal-100 text-teal-700',    dot: 'bg-teal-400'   },
  'Results published': { color: 'bg-red-100 text-red-700',      dot: 'bg-red-500'    },
  'Snapshot restored': { color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
}
function fmtLogTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function RetroEligibilityPanel({ currentPoy, roundsLookup, openConfirm, logChange }) {
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)

  const affected = useMemo(() => {
    const list = []
    for (const fl of Object.keys(currentPoy?.flights ?? {})) {
      for (const p of (currentPoy.flights[fl] ?? [])) {
        const rounds = roundsLookup[p.name] ?? 0
        if (rounds < 7 && (p.points ?? 0) > 0) {
          list.push({ name: p.name, flight: fl, points: p.points, rounds })
        }
      }
    }
    return list
  }, [currentPoy, roundsLookup])

  async function handleApply() {
    const confirmed = await openConfirm(
      `Zero out Handicap POY points for ${affected.length} player(s) with fewer than 7 rounds? This will update the live standings in Firestore.`
    )
    if (!confirmed) return
    setSaving(true)
    setStatus(null)
    try {
      const newFlights = {}
      for (const fl of Object.keys(currentPoy?.flights ?? {})) {
        const rows = (currentPoy.flights[fl] ?? []).map(p => {
          const rounds = roundsLookup[p.name] ?? 0
          return rounds < 7 ? { ...p, points: 0 } : p
        })
        const sorted = [...rows].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
        newFlights[fl] = sorted.map((p, i) => ({ ...p, rank: i + 1 }))
      }
      await DB.savePoy({ flights: newFlights })
      logChange('Retroactive Handicap POY eligibility fix', `${affected.length} players zeroed`)
      setStatus('ok')
    } catch {
      setStatus('err')
    }
    setSaving(false)
    setTimeout(() => setStatus(null), 4000)
  }

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs font-sans font-semibold uppercase tracking-widest text-forest mb-1">Handicap POY Eligibility Fix</p>
      <p className="text-xs font-sans text-gray-500 mb-3">
        Zeros out Handicap POY points for players with fewer than 7 rounds in their PTM history and re-ranks each flight.
        {affected.length > 0
          ? <span className="ml-1 text-amber-600 font-medium">{affected.length} player(s) have points but fewer than 7 rounds.</span>
          : <span className="ml-1 text-green-600 font-medium">All players with points have 7+ rounds.</span>}
      </p>
      {affected.length > 0 && (
        <ul className="mb-3 text-xs font-sans text-gray-600 space-y-0.5 max-h-40 overflow-y-auto border border-gray-100 rounded p-2">
          {affected.map(p => (
            <li key={p.name + p.flight} className="flex gap-2">
              <span className="font-medium text-darktext">{p.name}</span>
              <span className="text-gray-400">{p.flight}</span>
              <span className="ml-auto text-amber-600">{p.points} pts · {p.rounds} rounds</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={handleApply}
          disabled={saving || affected.length === 0}
          className="px-4 py-2 text-sm font-sans font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Applying…' : `Apply Fix (${affected.length} players)`}
        </button>
        {status === 'ok' && <span className="text-xs font-sans text-green-600 font-semibold">Saved</span>}
        {status === 'err' && <span className="text-xs font-sans text-red-500 font-semibold">Save failed</span>}
      </div>
    </section>
  )
}

function BeginningPtmPanel({ livePtmData, logChange, openConfirm }) {
  const { data: currentSnapshot } = useFireData(DB.listenBeginningPtm, null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null) // 'ok' | 'err'

  const playerCount = Array.isArray(livePtmData) ? livePtmData.filter(p => p.ptm != null).length : 0
  const snapshotCount = Array.isArray(currentSnapshot) ? currentSnapshot.length : 0

  async function handleSave() {
    if (!livePtmData?.length) return
    const confirmed = await openConfirm(
      `Save current PTM data (${playerCount} players) as the beginning-of-year snapshot? This will overwrite any existing snapshot and is used to compute Most/Least Improved standings.`
    )
    if (!confirmed) return
    setSaving(true)
    setStatus(null)
    try {
      const list = livePtmData
        .filter(p => p.name && p.ptm != null)
        .map(p => ({ name: p.name, ptm: p.ptm, tee: p.tee ?? null }))
      await DB.saveBeginningPtm(list)
      logChange('Beginning-of-year PTM snapshot saved', `${list.length} players`)
      setStatus('ok')
    } catch {
      setStatus('err')
    }
    setSaving(false)
    setTimeout(() => setStatus(null), 4000)
  }

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs font-sans font-semibold uppercase tracking-widest text-forest mb-1">Beginning-of-Year PTM Snapshot</p>
      <p className="text-xs font-sans text-gray-500 mb-3">
        Saves the current PTM data as the season-start baseline used to compute Most/Least Improved standings.
        {snapshotCount > 0 && (
          <span className="ml-1 text-forest font-medium">Snapshot exists: {snapshotCount} players.</span>
        )}
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || playerCount === 0}
          className="px-4 py-2 text-sm font-sans font-semibold rounded-lg bg-forest text-white hover:bg-forest/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving…' : `Save Snapshot (${playerCount} players)`}
        </button>
        {status === 'ok' && <span className="text-xs font-sans text-green-600 font-semibold">Saved</span>}
        {status === 'err' && <span className="text-xs font-sans text-red-500 font-semibold">Save failed</span>}
      </div>
    </section>
  )
}

function ChangelogPanel({ changelog }) {
  const sorted = [...changelog].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-forest px-4 py-2.5 flex items-center justify-between">
        <span className="text-white font-sans text-sm font-semibold">Changelog / Audit Log</span>
        <span className="text-white/50 font-sans text-xs">{sorted.length} entries</span>
      </div>
      {sorted.length === 0 ? (
        <p className="px-4 py-10 text-center text-gray-400 font-sans text-sm">
          No changes recorded yet. Actions will appear here after saving.
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          {sorted.map(entry => {
            const style = ACTION_LABELS[entry.action] ?? { color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' }
            return (
              <div key={entry.id} className="flex items-start gap-3 px-4 py-3">
                <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[11px] font-sans font-semibold px-1.5 py-0.5 rounded ${style.color}`}>
                      {entry.action}
                    </span>
                    {entry.details && (
                      <span className="text-xs font-sans text-gray-600 truncate">{entry.details}</span>
                    )}
                  </div>
                  <p className="text-[11px] font-sans text-gray-400 mt-0.5">
                    {fmtLogTime(entry.ts)}
                    {entry.user && <span className="ml-2 text-gray-400">— {entry.user}</span>}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


function SnapshotsPanel({ snapshots, onRestore }) {
  const sorted = [...snapshots].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0)).slice(0, 50)
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-purple-700 px-4 py-2.5 flex items-center justify-between">
        <span className="text-white font-sans text-sm font-semibold">Snapshots / Restore</span>
        <span className="text-white/70 font-sans text-xs">{sorted.length} recent</span>
      </div>
      {sorted.length === 0 ? (
        <p className="px-4 py-10 text-center text-gray-400 font-sans text-sm">No snapshots yet.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {sorted.map(entry => (
            <div key={entry.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-sans font-semibold text-darktext">{entry.type}{entry.tid ? ` · ${entry.tid}` : ''}</p>
                <p className="text-xs font-sans text-gray-500">{fmtLogTime(entry.ts)}{entry.details ? ` — ${entry.details}` : ''}</p>
              </div>
              <button
                type="button"
                onClick={() => onRestore(entry)}
                className="px-3 py-1.5 text-xs font-sans font-semibold rounded border border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PublishConfirmModal({ preview, publishSaving, publishSaveStatus, onCancel, onConfirm }) {
  const { targetTournament, preview: previewData } = preview

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-3xl bg-white rounded-xl border border-gray-200 shadow-2xl max-h-[90vh] overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-darktext font-serif text-2xl">Confirm Publish Results</h2>
          <p className="text-gray-500 font-sans text-sm mt-1">
            This will overwrite live standings and POY with the results below.
          </p>
        </div>

        <div className="px-5 py-4 overflow-y-auto max-h-[58vh]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
              <p className="text-[11px] uppercase tracking-widest font-semibold text-forest font-sans">Tournament</p>
              <p className="text-darktext font-sans font-semibold mt-1">{targetTournament.name}</p>
              <p className="text-gray-500 text-xs font-sans mt-1">{fmtDateShort(targetTournament.date)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
              <p className="text-[11px] uppercase tracking-widest font-semibold text-forest font-sans">Players Affected</p>
              <p className="text-darktext font-sans font-semibold mt-1">
                {previewData.totalPlayersAffected} player{previewData.totalPlayersAffected !== 1 ? 's' : ''}
              </p>
              <p className="text-gray-500 text-xs font-sans mt-1">Based on publishable flights only.</p>
            </div>
          </div>

          <div className="space-y-3">
            {previewData.flightSummaries.map(summary => (
              <div key={summary.flight} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-100 px-3 py-2 flex items-center justify-between">
                  <p className="text-sm font-sans font-semibold text-darktext">{summary.flight}</p>
                  <p className="text-xs font-sans text-gray-500">
                    Winner:{' '}
                    <span className="text-forest font-semibold">
                      {summary.winner ? formatName(summary.winner.winner) : 'No scored winner'}
                    </span>
                  </p>
                </div>
                {summary.topRows.length > 0 ? (
                  <table className="w-full text-xs font-sans">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400">
                        <th className="text-left px-3 py-2">Rank</th>
                        <th className="text-left px-3 py-2">Player</th>
                        <th className="text-center px-3 py-2">+/-</th>
                        <th className="text-center px-3 py-2">POY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.topRows.map(row => (
                        <tr key={`${summary.flight}-${row.rank}-${row.name}`} className="border-b border-gray-50 last:border-b-0">
                          <td className="px-3 py-2 font-semibold text-darktext">{row.rank}</td>
                          <td className="px-3 py-2 text-darktext">{formatName(row.name)}</td>
                          <td className="px-3 py-2 text-center text-gray-500">{fmtPM(row.plusMinus)}</td>
                          <td className="px-3 py-2 text-center text-gray-500">{row.poy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="px-3 py-3 text-xs font-sans text-gray-400">No scored results available for preview.</p>
                )}
              </div>
            ))}
          </div>

          {publishSaveStatus === 'err' && (
            <p className="mt-4 text-sm font-sans text-red-600">Publish failed. Nothing was written. Fix issues and retry.</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={publishSaving}
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-600 text-sm font-sans font-semibold disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={publishSaving}
            className="px-4 py-2 rounded-md bg-gold text-forest text-sm font-sans font-semibold disabled:opacity-60"
          >
            {publishSaving ? 'Publishing…' : 'Confirm & Publish Live Results'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Flight Score Section ──────────────────────────────────────────────────────
function FlightScoreSection({ flightName, players, rawPlayers, onRemove, onUpdate, onClear, onRemoveFlight, fmtPM, fmtPOY }) {
  const scoreInputRefs = useRef({ mobile: [], desktop: [] })

  const setScoreInputRef = (layout, idx, el) => {
    scoreInputRefs.current[layout][idx] = el
  }

  const focusScoreAt = (idx) => {
    const mobileTarget = scoreInputRefs.current.mobile[idx]
    const desktopTarget = scoreInputRefs.current.desktop[idx]
    const target = [mobileTarget, desktopTarget].find(el => el && el.offsetParent !== null) || mobileTarget || desktopTarget
    if (!target) return
    target.focus()
    target.select?.()
  }

  const handleScoreInputKeyDown = (e, idx) => {
    const { key, shiftKey } = e
    if (key === 'ArrowDown' || key === 'Enter') { e.preventDefault(); focusScoreAt(idx + 1); return }
    if (key === 'ArrowUp') { e.preventDefault(); focusScoreAt(Math.max(0, idx - 1)); return }
    if (key === 'Tab') { e.preventDefault(); focusScoreAt(shiftKey ? Math.max(0, idx - 1) : idx + 1) }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-forest px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white font-sans text-sm font-semibold">{flightName}</span>
          {flightName === 'New Players' && (
            <span className="text-xs font-sans px-2 py-0.5 rounded bg-teal-400/30 text-teal-200 border border-teal-400/40">
              scores logged — not published to standings
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gold font-mono text-xs">{rawPlayers.length} players</span>
          {rawPlayers.length > 0 && (
            <button onClick={onClear} className="text-gray-300 hover:text-red-300 text-xs font-sans transition-colors">
              Clear All
            </button>
          )}
          {onRemoveFlight && (
            <button onClick={onRemoveFlight} className="text-gray-300 hover:text-red-300 text-xs font-sans transition-colors">
              Remove Flight
            </button>
          )}
        </div>
      </div>

      {players.length > 0 ? (
        <div>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-2 p-2">
            {players.map((p, idx) => (
              <div key={p.name} className={`border rounded-lg p-3 ${p.wd ? 'border-orange-200 bg-orange-50/40 opacity-60' : `border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-sans text-sm font-semibold text-darktext truncate">{formatName(p.name)}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`stat-number text-xs font-semibold ${p.rank != null && p.rank <= 3 ? 'text-gold' : 'text-gray-400'}`}>
                        {p.wd ? 'WD' : `Rank ${p.rank ?? '—'}`}
                      </span>
                      {!p.wd && (
                        <span className={`stat-number text-xs font-semibold ${
                          p.plusMinus == null ? 'text-gray-300' : p.plusMinus > 0 ? 'text-green-600' : p.plusMinus < 0 ? 'text-red-500' : 'text-gray-400'
                        }`}>
                          {fmtPM(p.plusMinus)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdate(idx, 'wd', !p.wd)}
                      title={p.wd ? 'Undo withdrawal' : 'Mark as withdrew'}
                      className={`text-xs font-sans font-semibold px-1.5 py-0.5 rounded border transition-colors ${
                        p.wd
                          ? 'text-orange-600 border-orange-300 bg-orange-100'
                          : 'text-gray-300 border-gray-200 hover:text-orange-500 hover:border-orange-300'
                      }`}
                    >
                      WD
                    </button>
                    <button onClick={() => onRemove(idx)} title="Remove player"
                      className="text-gray-300 hover:text-red-400 text-xl leading-none transition-colors px-1">×</button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[11px] font-sans text-gray-400">PTM</span>
                    <input type="number" inputMode="numeric" value={p.ptm}
                      onChange={e => onUpdate(idx, 'ptm', e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded px-2 py-2 text-sm font-mono text-center focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-sans text-gray-400">Score</span>
                    {p.wd ? (
                      <div className="mt-1 w-full border border-orange-200 rounded px-2 py-2 text-sm font-mono text-center bg-orange-50 text-orange-500 font-semibold">WD</div>
                    ) : (
                      <input
                        ref={el => setScoreInputRef('mobile', idx, el)}
                        type="number" inputMode="numeric" value={p.score}
                        onChange={e => onUpdate(idx, 'score', e.target.value)}
                        onKeyDown={e => handleScoreInputKeyDown(e, idx)}
                        aria-label={`Score for ${formatName(p.name)}`}
                        className="mt-1 w-full border border-gray-200 rounded px-2 py-2 text-sm font-mono text-center focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                      />
                    )}
                  </label>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className={`stat-number text-xs font-semibold ${
                    p.wd ? 'text-orange-400' : p.eligible === false ? 'text-red-400' : p.poy == null ? 'text-gray-300' : 'text-darktext'
                  }`}>
                    POY: {fmtPOY(p)}
                  </span>
                  <span className={`text-xs font-sans ${p.wd || p.eligible === false ? 'text-gray-300' : 'text-gray-400'}`}>
                    <input type="checkbox" checked={!p.wd && p.eligible !== false}
                      readOnly
                      className="accent-forest w-4 h-4 mr-1 pointer-events-none"
                    />
                    Elig.
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="table-header text-gray-400 text-left">Rank</th>
                  <th className="table-header text-gray-400 text-left">Player</th>
                  <th className="table-header text-gray-400 text-center">PTM</th>
                  <th className="table-header text-gray-400 text-center">Score</th>
                  <th className="table-header text-gray-400 text-center">+/-</th>
                  <th className="table-header text-gray-400 text-center">POY</th>
                  <th className="table-header text-gray-400 text-center">Elig.</th>
                  <th className="table-header text-gray-400 text-center">WD</th>
                  <th className="table-header text-gray-400 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, idx) => (
                  <tr key={p.name} className={`border-b border-gray-100 last:border-0 transition-colors ${p.wd ? 'bg-orange-50/40 opacity-60' : `hover:bg-blue-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}`}>
                    <td className="px-3 py-2">
                      <span className={`stat-number text-xs font-semibold ${p.rank != null && p.rank <= 3 ? 'text-gold' : 'text-gray-400'}`}>
                        {p.wd ? '—' : (p.rank ?? '—')}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-sans text-sm text-darktext whitespace-nowrap">{formatName(p.name)}</td>
                    <td className="px-2 py-1.5 text-center">
                      <input type="number" value={p.ptm} onChange={e => onUpdate(idx, 'ptm', e.target.value)}
                        className="w-14 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {p.wd ? (
                        <span className="inline-block w-14 px-2 py-1 text-xs font-mono font-semibold text-orange-600 bg-orange-100 border border-orange-200 rounded text-center">WD</span>
                      ) : (
                        <input
                          ref={el => setScoreInputRef('desktop', idx, el)}
                          type="number" inputMode="numeric" value={p.score}
                          onChange={e => onUpdate(idx, 'score', e.target.value)}
                          onKeyDown={e => handleScoreInputKeyDown(e, idx)}
                          aria-label={`Score for ${formatName(p.name)}`}
                          className="w-14 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`stat-number text-xs font-semibold ${
                        p.plusMinus == null ? 'text-gray-300' : p.plusMinus > 0 ? 'text-green-600' : p.plusMinus < 0 ? 'text-red-500' : 'text-gray-400'
                      }`}>
                        {p.wd ? '—' : fmtPM(p.plusMinus)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`stat-number text-xs font-semibold ${
                        p.wd ? 'text-orange-400' : p.eligible === false ? 'text-red-400' : p.poy == null ? 'text-gray-300' : 'text-darktext'
                      }`}>
                        {fmtPOY(p)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={!p.wd && p.eligible !== false}
                        readOnly
                        className="accent-forest w-4 h-4 pointer-events-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => onUpdate(idx, 'wd', !p.wd)}
                        title={p.wd ? 'Undo withdrawal' : 'Mark as withdrew'}
                        className={`text-xs font-sans font-semibold px-1.5 py-0.5 rounded border transition-colors ${
                          p.wd
                            ? 'text-orange-600 border-orange-300 bg-orange-100 hover:bg-orange-200'
                            : 'text-gray-300 border-gray-200 hover:text-orange-500 hover:border-orange-300'
                        }`}
                      >
                        WD
                      </button>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => onRemove(idx)} title="Remove player"
                        className="text-gray-300 hover:text-red-400 text-xl leading-none transition-colors">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed m-3 rounded-lg border-gray-100">
          <p className="text-gray-300 font-sans text-xs">No players in {flightName} yet.</p>
        </div>
      )}
    </div>
  )
}

function UsersPanel({
  users, userSearch, setUserSearch, newUser, setNewUser,
  addUser, updateUser, toggleUserStatus, saveUsers, usersSaving, usersSaveStatus,
}) {
  return (
    <div className="space-y-4">
      <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="grid gap-2 sm:grid-cols-4">
          <input value={newUser.name} onChange={e => setNewUser(prev => ({ ...prev, name: e.target.value }))} placeholder="Full name" className="sm:col-span-2 border border-gray-300 rounded-md px-3 py-2 text-sm font-sans" />
          <input type="email" value={newUser.email} onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))} placeholder="Email" className="border border-gray-300 rounded-md px-3 py-2 text-sm font-sans" />
          <select value={newUser.role} onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value }))} className="border border-gray-300 rounded-md px-3 py-2 text-sm font-sans">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={addUser} className="min-h-[44px] px-4 py-2 rounded-md bg-forest text-white text-sm font-semibold font-sans">Add User</button>
          <SaveBtn onClick={saveUsers} saving={usersSaving} status={usersSaveStatus} />
        </div>
      </section>
      <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search users…" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-sans" />
        </div>
        <div className="divide-y divide-gray-100">
          {users.map(user => (
            <div key={user.id} className="p-4 grid gap-2 sm:grid-cols-12 sm:items-center">
              <input value={user.name ?? ''} onChange={e => updateUser(user.id, 'name', e.target.value)} className="sm:col-span-3 border border-gray-300 rounded-md px-2.5 py-2 text-sm font-sans" aria-label={`Name for ${user.email}`} />
              <input type="email" value={user.email ?? ''} onChange={e => updateUser(user.id, 'email', e.target.value)} className="sm:col-span-4 border border-gray-300 rounded-md px-2.5 py-2 text-sm font-sans" aria-label={`Email for ${user.name}`} />
              <select value={user.role ?? 'member'} onChange={e => updateUser(user.id, 'role', e.target.value)} className="sm:col-span-2 border border-gray-300 rounded-md px-2.5 py-2 text-sm font-sans" aria-label={`Role for ${user.name}`}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button onClick={() => toggleUserStatus(user.id)} className={`sm:col-span-3 min-h-[44px] px-3 py-2 rounded-md text-sm font-semibold font-sans border ${user.status === 'disabled' ? 'border-gray-300 text-gray-600 bg-gray-100' : 'border-green-300 text-green-700 bg-green-50'}`}>
                {user.status === 'disabled' ? 'Disabled' : 'Active'}
              </button>
            </div>
          ))}
          {users.length === 0 && <p className="px-4 py-8 text-sm text-gray-500 font-sans text-center">No users match your search.</p>}
        </div>
      </section>
    </div>
  )
}

function ExportPanel({
  tournament, tournamentInfo, totalPlayers, currentPairings, paymentPaidCount, credits,
  onOpenTournamentInfoEditor, onExportPtmPDF, onExportPtmXLSX, onExportResultsPDF, onExportResultsXLSX,
  onExportPairingsPDF, onExportPaymentsPDF, onExportPaymentsXLSX, onExportCreditsPDF, onExportCreditsXLSX,
  onExportBirdiePoolXLSX,
}) {
  const birdieDesc = totalPlayers > 0
    ? <span>Birdie pool sheet with hole columns — <span className="text-forest font-semibold">{totalPlayers} player{totalPlayers !== 1 ? 's' : ''} in field</span></span>
    : 'Birdie pool sheet with hole columns — no field set yet'

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-forest px-4 py-2.5">
        <p className="text-xs font-sans font-semibold uppercase tracking-widest text-white/70">Exports</p>
      </div>
      <div className="divide-y divide-gray-100">
        <ExportRow title="Tournament Info" description="Registration sheet with date, course, entry fee, and Venmo QR"><PdfBtn onClick={onOpenTournamentInfoEditor} disabled={!tournamentInfo}>PDF</PdfBtn></ExportRow>
        <ExportRow title="Points to Make — Full Roster" description="All members grouped by flight with their PTM targets"><PdfBtn onClick={onExportPtmPDF}>PDF</PdfBtn><XlsxBtn onClick={onExportPtmXLSX}>Excel</XlsxBtn></ExportRow>
        <ExportRow title="Tournament Results" description="Per-flight leaderboard with rank, score, +/−, and POY points"><PdfBtn onClick={onExportResultsPDF} disabled={!tournament || totalPlayers === 0}>PDF</PdfBtn><XlsxBtn onClick={onExportResultsXLSX} disabled={!tournament || totalPlayers === 0}>Excel</XlsxBtn></ExportRow>
        <ExportRow title="Birdie Pool" description={birdieDesc}><XlsxBtn onClick={onExportBirdiePoolXLSX} disabled={!tournament || totalPlayers === 0}>Excel</XlsxBtn></ExportRow>
        <ExportRow title="Pairings" description="Tee-time groupings for the round"><PdfBtn onClick={onExportPairingsPDF} disabled={!tournament || currentPairings.length === 0}>PDF</PdfBtn></ExportRow>
        <ExportRow title="Field Roster" description="Players in the field grouped by flight"><PdfBtn onClick={onExportPaymentsPDF} disabled={!tournament || paymentPaidCount === 0}>PDF</PdfBtn><XlsxBtn onClick={onExportPaymentsXLSX} disabled={!tournament || paymentPaidCount === 0}>Excel</XlsxBtn></ExportRow>
        <ExportRow title="Credit on Books" description="Member credit balances by flight"><PdfBtn onClick={onExportCreditsPDF} disabled={Object.keys(credits).length === 0}>PDF</PdfBtn><XlsxBtn onClick={onExportCreditsXLSX} disabled={Object.keys(credits).length === 0}>Excel</XlsxBtn></ExportRow>
      </div>
    </div>
  )
}

function ExportRow({ title, description, children }) {
  return (
    <div className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-700 font-sans">{title}</p>
        <p className="text-[11px] text-gray-400 font-sans">{description}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

// ── Tournament Setup Panel (Score Entry) ──────────────────────────────────────
function ScoreEntryPanel({
  allFlights, tournamentData,
  poolMembersGrouped, poolTotalCount, poolSearch, setPoolSearch,
  selectedPool, togglePoolSelect, toggleGroupSelect, addSelectedPlayers,
  removePlayerFromFlight, updatePlayerInFlight, clearFlightByName,
  fmtPM, fmtPOY, onOpenPublishPreview,
  publishSaving, publishSaveStatus, saveScores, scoresSaving, scoresSaveStatus,
  tournament, totalPlayers, onExportResultsPDF,
  pairingsPosted, onGoToPairings,
  onRemoveExtraFlight,
  onImportScores, effectiveMembers,
}) {
  const hasAnyPlayers = allFlights.some(f => (tournamentData[f]?.length ?? 0) > 0)
  const [showImport, setShowImport] = useState(false)

  return (
    <>
      {/* Two-panel layout */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">

        {/* Left: Member pool */}
        <div className="lg:w-72 flex-shrink-0">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-forest px-4 py-2.5">
              <p className="text-white font-sans text-sm font-semibold">Members</p>
              <p className="text-white/50 text-xs font-sans mt-0.5">Select names, then tap "Add Selected"</p>
            </div>
            <div className="px-3 py-2 border-b border-gray-100">
              <input
                type="text"
                value={poolSearch}
                onChange={e => setPoolSearch(e.target.value)}
                placeholder="Filter members…"
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-forest"
              />
            </div>
            <MemberPool
              poolMembersGrouped={poolMembersGrouped}
              poolTotalCount={poolTotalCount}
              poolSearch={poolSearch}
              selectedPool={selectedPool}
              onToggle={togglePoolSelect}
              onToggleGroup={toggleGroupSelect}
              onAddSelected={addSelectedPlayers}
            />
          </div>
        </div>

        {/* Right: Score entry (locked until pairings posted) */}
        <div className="flex-1 min-w-0">
          {!pairingsPosted ? (
            <div className="bg-white border border-gray-200 rounded-lg flex flex-col items-center justify-center py-16 text-center px-8">
              <LockIcon className="w-10 h-10 text-gray-300 mb-3 opacity-70" />
              <p className="font-sans font-semibold text-darktext mb-1">Score entry locked</p>
              <p className="text-gray-400 font-sans text-sm mb-4">
                Pairings must be published before scores can be entered.
              </p>
              <button onClick={onGoToPairings} className="btn-primary text-sm">
                Go to Pairings →
              </button>
            </div>
          ) : !hasAnyPlayers ? (
            <div className="bg-white border border-gray-200 rounded-lg flex flex-col items-center justify-center py-16 text-center px-8">
              <GolfFlagIcon className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-gray-400 font-sans text-sm">No players added yet.</p>
              <p className="text-gray-400 font-sans text-xs mt-1">Select players from the pool on the left.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowImport(true)}
                  className="px-3 py-1.5 text-xs font-sans font-semibold rounded border border-gray-200 text-gray-500 hover:text-forest hover:border-forest/40 transition-colors"
                >
                  ↑ Import Scores
                </button>
              </div>
              {allFlights.map(f => {
                const rawFlightPlayers = tournamentData[f] ?? []
                const isNewPlayersTab = f === NEW_PLAYERS_FLIGHT
                const isCustomFlight = !FLIGHTS.includes(f) && !isNewPlayersTab
                if (rawFlightPlayers.length === 0 && !isNewPlayersTab) return null
                const flightPlayers = calcFlightPOY(rawFlightPlayers)
                return (
                  <FlightScoreSection
                    key={f}
                    flightName={f}
                    players={flightPlayers}
                    rawPlayers={rawFlightPlayers}
                    onUpdate={(idx, field, val) => updatePlayerInFlight(f, idx, field, val)}
                    onRemove={idx => removePlayerFromFlight(f, idx)}
                    onClear={() => clearFlightByName(f)}
                    onRemoveFlight={isCustomFlight ? () => onRemoveExtraFlight(f) : undefined}
                    fmtPM={fmtPM}
                    fmtPOY={fmtPOY}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>


      {/* Save & Publish */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-forest font-sans text-xs font-semibold uppercase tracking-widest mb-1">Save & Publish</h2>
        <p className="text-gray-500 font-sans text-xs mb-4 leading-relaxed">
          <strong className="text-darktext">Save Draft</strong> — stores scores in the cloud for later.{' '}
          <strong className="text-darktext">Publish Results</strong> — calculates standings and POY and makes them live on the site instantly.
        </p>
        <div className="flex flex-wrap gap-2">
          <SaveBtn onClick={saveScores} saving={scoresSaving} status={scoresSaveStatus} label="Save Draft" />
          <SaveBtn
            onClick={onOpenPublishPreview}
            saving={publishSaving}
            status={publishSaveStatus}
            label="Publish Results"
            className="!bg-gold !text-forest hover:!bg-gold/90"
          />
          <PdfBtn
            onClick={onExportResultsPDF}
            disabled={!tournament || totalPlayers === 0}
          >
            Export Results PDF
          </PdfBtn>
        </div>
      </div>
      {showImport && (
        <ScoreImportModal
          effectiveMembers={effectiveMembers}
          tournamentData={tournamentData}
          allFlights={allFlights}
          onApply={(rows) => { onImportScores(rows); setShowImport(false) }}
          onClose={() => setShowImport(false)}
        />
      )}
    </>
  )
}

// ── Score Import Modal ────────────────────────────────────────────────────────
function parseScoreImport(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!lines.length) return []
  const delim = lines[0].includes('\t') ? '\t' : ','
  const firstCols = lines[0].split(delim).map(c => c.trim().toLowerCase().replace(/\s+/g, ''))
  const nameAliases = ['name', 'player', 'member', 'membername']
  const headerNameIdx = firstCols.findIndex(c => nameAliases.includes(c))
  const headerScoreIdx = firstCols.findIndex(c => c === 'score')
  const hasHeader = headerNameIdx !== -1 || headerScoreIdx !== -1
  const nameIdx  = hasHeader ? (headerNameIdx  !== -1 ? headerNameIdx  : 0) : 0
  const scoreIdx = hasHeader ? (headerScoreIdx !== -1 ? headerScoreIdx : 1) : 1
  const dataLines = hasHeader ? lines.slice(1) : lines
  return dataLines.flatMap(line => {
    const cols = line.split(delim).map(c => c.trim())
    const name = cols[nameIdx] ?? ''
    const rawScore = cols[scoreIdx] ?? ''
    if (!name) return []
    const wd = rawScore.toLowerCase() === 'wd'
    return [{ name, score: wd ? '' : rawScore, wd }]
  })
}

function ScoreImportModal({ effectiveMembers, tournamentData, allFlights, onApply, onClose }) {
  const [text, setText] = useState('')
  const normKey = s => String(s ?? '').trim().toLowerCase()

  const memberLookup = useMemo(() => {
    const map = new Map()
    for (const m of effectiveMembers) {
      map.set(normKey(m.name), m.name)
      const parts = m.name.trim().split(/\s+/)
      if (parts.length >= 2) {
        const lf = `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}`
        if (!map.has(normKey(lf))) map.set(normKey(lf), m.name)
      }
    }
    return map
  }, [effectiveMembers])

  const entryLookup = useMemo(() => {
    const map = new Map()
    for (const fl of allFlights) {
      for (const p of (tournamentData[fl] ?? [])) map.set(normKey(p.name), fl)
    }
    return map
  }, [tournamentData, allFlights])

  const preview = useMemo(() => {
    if (!text.trim()) return []
    return parseScoreImport(text).map(({ name, score, wd }) => {
      const canonical = memberLookup.get(normKey(name))
      if (!canonical) return { name, score, wd, status: 'unknown', flight: null }
      const existingFlight = entryLookup.get(normKey(canonical))
      return {
        name: canonical,
        score,
        wd,
        status: existingFlight ? 'update' : 'add',
        flight: existingFlight ?? effectiveMembers.find(m => m.name === canonical)?.flight ?? '?',
      }
    })
  }, [text, memberLookup, entryLookup, effectiveMembers])

  const canApply = preview.length > 0 && preview.some(r => r.status !== 'unknown')
  const unknownCount = preview.filter(r => r.status === 'unknown').length

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-gold/20 bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-forest font-sans">Import Scores</h3>
            <p className="text-xs text-gray-400 font-sans mt-0.5">Paste CSV or tab-separated data. Columns: <code className="bg-gray-100 px-1 rounded">name, score</code>. Use <code className="bg-gray-100 px-1 rounded">WD</code> as score for withdrawals.</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-xl leading-none">×</button>
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={"name,score\nJohn Smith,38\nJane Doe,WD\nBob Jones,42"}
          rows={6}
          className="w-full border border-gray-200 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-forest resize-y"
          autoFocus
        />
        {preview.length > 0 && (
          <div className="mt-3 border border-gray-100 rounded overflow-hidden">
            <table className="w-full text-xs font-sans">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-3 py-1.5 text-gray-400 font-medium">Player</th>
                  <th className="text-center px-3 py-1.5 text-gray-400 font-medium">Score</th>
                  <th className="text-center px-3 py-1.5 text-gray-400 font-medium">Flight</th>
                  <th className="text-center px-3 py-1.5 text-gray-400 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className={`border-b border-gray-50 last:border-0 ${r.status === 'unknown' ? 'bg-red-50' : 'bg-white'}`}>
                    <td className="px-3 py-1.5 text-darktext font-medium">{formatName(r.name)}</td>
                    <td className="px-3 py-1.5 text-center font-mono">
                      {r.wd
                        ? <span className="text-orange-600 font-semibold">WD</span>
                        : <span className="text-darktext">{r.score}</span>
                      }
                    </td>
                    <td className="px-3 py-1.5 text-center text-gray-500">{r.flight ?? '—'}</td>
                    <td className="px-3 py-1.5 text-center">
                      {r.status === 'unknown' && <span className="text-red-500 font-medium">Not found</span>}
                      {r.status === 'update'  && <span className="text-blue-500 font-medium">Update score</span>}
                      {r.status === 'add'     && <span className="text-green-600 font-medium">Add to flight</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {unknownCount > 0 && (
          <p className="mt-2 text-xs text-red-500 font-sans">{unknownCount} player{unknownCount !== 1 ? 's' : ''} not found in member list and will be skipped.</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 text-xs font-sans rounded border border-gray-200 text-gray-500 hover:text-forest transition-colors">Cancel</button>
          <button
            onClick={() => onApply(preview.filter(r => r.status !== 'unknown').map(r => ({ name: r.name, score: r.score, wd: r.wd })))}
            disabled={!canApply}
            className="px-4 py-1.5 text-xs font-sans font-semibold rounded bg-forest text-white disabled:opacity-40 hover:bg-forest/90 transition-colors"
          >
            Apply {canApply ? `(${preview.filter(r => r.status !== 'unknown').length} players)` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Member Pool (multi-select) ────────────────────────────────────────────────
function MemberPool({
  poolMembersGrouped, poolTotalCount, poolSearch,
  selectedPool, onToggle, onToggleGroup, onAddSelected
}) {
  const selectedCount = selectedPool.size

  return (
    <div>
      {/* Sticky add bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-3 py-2">
        <button
          onClick={onAddSelected}
          disabled={selectedCount === 0}
          className={`w-full py-2 rounded text-xs font-sans font-semibold transition-colors ${
            selectedCount > 0
              ? 'bg-gold text-forest hover:bg-amber-400'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {selectedCount > 0
            ? `Add ${selectedCount} Selected to Assigned Flights`
            : 'Select players below'}
        </button>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: '440px' }}>
        {poolTotalCount === 0 && !poolSearch.trim() ? (
          <p className="text-gray-400 text-xs font-sans text-center py-6">All members added.</p>
        ) : poolTotalCount === 0 && poolSearch.trim() ? (
          <p className="text-gray-400 text-xs font-sans text-center py-6">No matches.</p>
        ) : (
          <div className="p-2">
            {[...Object.entries(poolMembersGrouped)].map(([key, group]) => {
              if (!group.length) return null
              const label = key === '__unassigned__' ? 'Unassigned' : key
              const allInGroupSelected = group.every(m => selectedPool.has(m.name))
              return (
                <div key={key} className="mb-2">
                  <button
                    type="button"
                    onClick={() => onToggleGroup(group)}
                    className={`w-full flex items-center justify-between px-1 pt-1 pb-0.5 text-[10px] font-sans font-semibold uppercase tracking-widest transition-colors ${
                      allInGroupSelected ? 'text-forest' : 'text-gray-400 hover:text-forest'
                    }`}
                  >
                    <span>{label}</span>
                    <span className="normal-case tracking-normal text-[10px]">{allInGroupSelected ? 'Clear' : 'Select all'}</span>
                  </button>
                  <ul className="space-y-0.5">
                    {group.map(m => (
                      <li
                        key={m.name}
                        onClick={() => onToggle(m.name)}
                        className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded cursor-pointer border transition-colors select-none ${
                          selectedPool.has(m.name)
                            ? 'bg-gold/20 border-gold text-forest'
                            : 'bg-gray-50 hover:bg-blue-50 hover:border-blue-200 border-transparent'
                        }`}
                      >
                        <span className="font-sans text-xs text-darktext truncate">{formatName(m.name)}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {m.isPaid && (
                            <span
                              className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-100 text-green-700 border border-green-200 text-[10px] font-bold"
                              title="Paid"
                              aria-label={`${formatName(m.name)} paid`}
                            >
                              $
                            </span>
                          )}
                          {m.ptm != null && (
                            <span className="text-[10px] font-mono text-gray-400">PTM {roundPtm(m.ptm)}</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Pairing Rules Panel ───────────────────────────────────────────────────────
function PairingRulesPanel({ pairingRules, setPairingRules, allEnteredPlayers, flightTagStyles }) {
  const [addingType, setAddingType]       = useState(null)   // 'always' | 'never' | null
  const [draftPlayers, setDraftPlayers]   = useState([])
  const [playerSearch, setPlayerSearch]   = useState('')

  function startAddRule(type) {
    setAddingType(type)
    setDraftPlayers([])
    setPlayerSearch('')
  }

  function cancelAdd() {
    setAddingType(null)
    setDraftPlayers([])
    setPlayerSearch('')
  }

  function toggleDraftPlayer(name) {
    setDraftPlayers(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  function commitRule() {
    if (draftPlayers.length < 2) return
    setPairingRules(prev => [
      ...prev,
      { id: `rule_${Date.now()}`, type: addingType, players: [...draftPlayers] },
    ])
    cancelAdd()
  }

  function deleteRule(id) {
    setPairingRules(prev => prev.filter(r => r.id !== id))
  }

  function removePlayerFromRule(ruleId, playerName) {
    setPairingRules(prev => prev.map(r => {
      if (r.id !== ruleId) return r
      const next = r.players.filter(n => n !== playerName)
      return next.length < 2 ? null : { ...r, players: next }
    }).filter(Boolean))
  }

  const filteredPlayers = allEnteredPlayers.filter(p =>
    !playerSearch || p.name.toLowerCase().includes(playerSearch.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Add buttons */}
      {!addingType && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => startAddRule('always')}
            className="px-3 py-1.5 text-xs font-sans font-semibold rounded border border-emerald-400 text-emerald-700 hover:bg-emerald-50 transition-colors"
          >
            + Always Together
          </button>
          <button
            onClick={() => startAddRule('never')}
            className="px-3 py-1.5 text-xs font-sans font-semibold rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
          >
            + Never Together
          </button>
        </div>
      )}

      {/* Inline rule builder */}
      {addingType && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
              addingType === 'always'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-red-50 text-red-600 border-red-300'
            }`}>
              {addingType === 'always' ? 'Always Together' : 'Never Together'}
            </span>
            <span className="text-xs text-gray-400 font-sans">Select 2 or more players</span>
          </div>

          {allEnteredPlayers.length === 0 ? (
            <p className="text-xs text-gray-400 font-sans italic mb-3">No players entered for this tournament yet.</p>
          ) : (
            <>
              <input
                type="text"
                placeholder="Search players…"
                value={playerSearch}
                onChange={e => setPlayerSearch(e.target.value)}
                className="w-full mb-2 px-2.5 py-1.5 text-xs font-sans border border-gray-200 rounded focus:outline-none focus:border-forest"
              />
              <ul className="max-h-48 overflow-auto border border-gray-100 rounded divide-y divide-gray-50 mb-3">
                {filteredPlayers.length === 0 && (
                  <li className="px-3 py-2 text-xs text-gray-400 font-sans italic">No matches</li>
                )}
                {filteredPlayers.map(p => {
                  const selected = draftPlayers.includes(p.name)
                  return (
                    <li key={p.name}>
                      <button
                        onClick={() => toggleDraftPlayer(p.name)}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                          selected ? 'bg-forest/5' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className="font-sans text-sm text-darktext">{formatName(p.name)}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`text-xs border px-1.5 py-0.5 rounded-full font-sans whitespace-nowrap ${flightTagStyles[p.flight] ?? flightTagStyles.Unassigned}`}>
                            {p.flight}
                          </span>
                          {selected && (
                            <span className="w-4 h-4 rounded-full bg-forest flex items-center justify-center flex-shrink-0">
                              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          {/* Selected chips */}
          {draftPlayers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {draftPlayers.map(name => (
                <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-forest/10 text-forest text-xs font-sans">
                  {formatName(name)}
                  <button onClick={() => toggleDraftPlayer(name)} className="text-forest/50 hover:text-red-500 leading-none">&times;</button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={commitRule}
              disabled={draftPlayers.length < 2}
              className="px-3 py-1.5 text-xs font-sans font-semibold rounded bg-forest text-white disabled:opacity-40 hover:bg-forest/90 transition-colors"
            >
              Save Rule
            </button>
            <button
              onClick={cancelAdd}
              className="px-3 py-1.5 text-xs font-sans rounded border border-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Existing rules */}
      {pairingRules.length === 0 && !addingType && (
        <p className="text-sm text-gray-400 font-sans italic py-4 text-center">
          No rules yet. Rules apply every time you auto-generate pairings.
        </p>
      )}
      <div className="space-y-2">
        {pairingRules.map(rule => (
          <div key={rule.id} className={`rounded-lg border p-3 ${
            rule.type === 'always'
              ? 'bg-emerald-50/60 border-emerald-200'
              : 'bg-red-50/60 border-red-200'
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-wrap">
                <span className={`text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border flex-shrink-0 ${
                  rule.type === 'always'
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                    : 'bg-red-100 text-red-600 border-red-300'
                }`}>
                  {rule.type === 'always' ? 'Always Together' : 'Never Together'}
                </span>
                <div className="flex flex-wrap gap-1">
                  {rule.players.map(name => (
                    <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-gray-200 text-xs font-sans text-darktext">
                      {formatName(name)}
                      <button
                        onClick={() => removePlayerFromRule(rule.id, name)}
                        className="text-gray-300 hover:text-red-400 leading-none"
                        title="Remove player from rule"
                      >&times;</button>
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => deleteRule(rule.id)}
                className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0"
                title="Delete rule"
              >&times;</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Pairings Builder Panel ────────────────────────────────────────────────────
function PairingsPanel({
  totalPlayers, currentPairings, unpairedPlayers, allEnteredPlayers, manualPairings,
  selectedUnpaired, setSelectedUnpaired,
  generatePairings, startManualPairings, addGroupManual, removeGroupManual,
  assignUnpairedToGroup, movePlayerManual, clearPairings, removePairedPlayer, savePairings,
  pairingsSaving, pairingsSaveStatus, pairingsState, onExportPairingsPDF, tournament,
  flightTagStyles, pairingRules, setPairingRules, onImportPairings, allEnteredPlayerNames,
}) {
  const [draggedPlayer, setDraggedPlayer] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const [activeTab, setActiveTab] = useState('pairings')  // 'pairings' | 'rules' | 'import'
  const [importCsvError, setImportCsvError] = useState(null)
  const [importCsvWarning, setImportCsvWarning] = useState(null)
  const importFileRef = useRef(null)

  function parsePairingsCsv(text) {
    const lines = text.trim().split(/\r?\n/)
    if (lines.length < 2) return { error: 'File is empty or has only a header row.' }
    const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
    const groupIdx = rawHeaders.indexOf('group')
    const playerIdx = rawHeaders.findIndex(h => h === 'player' || h === 'name')
    if (groupIdx === -1 || playerIdx === -1) {
      return { error: 'CSV must have "group" and "player" (or "name") columns.' }
    }
    const groups = new Map()
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      const group = cols[groupIdx] ?? ''
      const player = cols[playerIdx] ?? ''
      if (!group || !player) continue
      if (!groups.has(group)) groups.set(group, [])
      groups.get(group).push(player)
    }
    if (groups.size === 0) return { error: 'No valid rows found in the file.' }
    const unknown = []
    for (const players of groups.values()) {
      for (const name of players) {
        if (allEnteredPlayerNames && !allEnteredPlayerNames.has(name)) unknown.push(name)
      }
    }
    const result = [...groups.entries()].map(([label, players], i) => ({ label: `Pairing ${i + 1}`, players }))
    return { groups: result, unknown }
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const parsed = parsePairingsCsv(text)
      if (parsed.error) {
        setImportCsvError(parsed.error)
        setImportCsvWarning(null)
      } else {
        setImportCsvError(null)
        onImportPairings(parsed.groups)
        if (parsed.unknown?.length) {
          setImportCsvWarning(`${parsed.unknown.length} player(s) not in score entry: ${parsed.unknown.slice(0, 3).join(', ')}${parsed.unknown.length > 3 ? '…' : ''}`)
        } else {
          setImportCsvWarning(null)
        }
        setActiveTab('pairings')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function encodeDragPayload(payload) {
    return JSON.stringify(payload)
  }

  function decodeDragPayload(event) {
    try {
      const raw = event.dataTransfer.getData('application/x-cga-pairing-player') || event.dataTransfer.getData('text/plain')
      if (!raw) return null
      const payload = JSON.parse(raw)
      if (!payload || (payload.type !== 'unassigned' && payload.type !== 'group')) return null
      return payload
    } catch {
      return null
    }
  }

  function handleDragStart(event, payload) {
    const encoded = encodeDragPayload(payload)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-cga-pairing-player', encoded)
    event.dataTransfer.setData('text/plain', encoded)
    setDraggedPlayer(payload)
  }

  function handleDragEnd() {
    setDraggedPlayer(null)
    setDropTarget(null)
  }

  function handleDropOnGroup(event, cardIdx) {
    event.preventDefault()
    const source = decodeDragPayload(event)
    if (!source) return
    movePlayerManual(source, { cardIdx })
    setDropTarget(null)
  }

  function handleDropOnPlayer(event, cardIdx, playerIdx) {
    event.preventDefault()
    event.stopPropagation()
    const source = decodeDragPayload(event)
    if (!source) return
    movePlayerManual(source, { cardIdx, playerIdx })
    setDropTarget(null)
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-0 mb-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('pairings')}
          className={`px-4 py-2 text-xs font-sans font-semibold uppercase tracking-widest border-b-2 -mb-px transition-colors ${
            activeTab === 'pairings'
              ? 'border-forest text-forest'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Pairings
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2 text-xs font-sans font-semibold uppercase tracking-widest border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
            activeTab === 'rules'
              ? 'border-forest text-forest'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Pairing Rules
          {pairingRules.length > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-forest text-white text-[10px] font-bold">
              {pairingRules.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`px-4 py-2 text-xs font-sans font-semibold uppercase tracking-widest border-b-2 -mb-px transition-colors ${
            activeTab === 'import'
              ? 'border-forest text-forest'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Import CSV
        </button>
      </div>

      {/* Import panel */}
      {activeTab === 'import' && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs font-sans font-semibold uppercase tracking-widest text-forest mb-1">Import Pairings from CSV</p>
          <p className="text-xs font-sans text-gray-500 mb-4">
            Upload a CSV with <span className="font-mono font-semibold">group</span> and <span className="font-mono font-semibold">player</span> columns.
            Each row is one player; rows with the same group value form one pairing card.
          </p>
          <div className="mb-3 rounded-md bg-gray-50 border border-gray-200 p-3 text-xs font-mono text-gray-600">
            group,player<br />
            1,John Smith<br />
            1,Jane Doe<br />
            1,Bob Jones<br />
            1,Alice Brown<br />
            2,Mike Johnson<br />
            2,Sarah Wilson
          </div>
          <input
            ref={importFileRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            type="button"
            onClick={() => importFileRef.current?.click()}
            className="px-4 py-2 rounded-md bg-forest text-white text-xs font-sans font-semibold hover:bg-forest/90"
          >
            Choose CSV File…
          </button>
          {importCsvError && (
            <p className="mt-3 text-xs font-sans text-red-600 font-semibold">{importCsvError}</p>
          )}
          {importCsvWarning && (
            <p className="mt-3 text-xs font-sans text-amber-600">{importCsvWarning}</p>
          )}
          <p className="mt-4 text-[11px] font-sans text-gray-400">
            Importing replaces current draft pairings. You can still edit them after import.
            Player names must exactly match the names in score entry.
          </p>
        </div>
      )}

      {/* Rules panel */}
      {activeTab === 'rules' && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-sans font-semibold uppercase tracking-widest text-forest mb-4">Pairing Rules</p>
          <PairingRulesPanel
            pairingRules={pairingRules}
            setPairingRules={setPairingRules}
            allEnteredPlayers={allEnteredPlayers}
            flightTagStyles={flightTagStyles}
          />
        </div>
      )}

      {/* Controls */}
      {activeTab === 'pairings' && (
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-sans font-semibold text-gray-500 uppercase tracking-widest">Pairings always in groups of 4</span>
          {pairingRules.length > 0 && (
            <button
              onClick={() => setActiveTab('rules')}
              className="text-xs font-sans text-forest underline underline-offset-2 hover:text-forest/70 transition-colors"
            >
              {pairingRules.length} rule{pairingRules.length !== 1 ? 's' : ''} active
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {totalPlayers > 0 && (
            <>
              <button
                onClick={generatePairings}
                className="px-3 py-1.5 text-xs font-sans font-semibold rounded border border-forest text-forest hover:bg-forest hover:text-white transition-colors"
              >
                {currentPairings.length > 0 ? 'Re-generate (Auto)' : 'Auto-Generate Pairings'}
              </button>
              <button
                onClick={startManualPairings}
                className="px-3 py-1.5 text-xs font-sans font-semibold rounded border border-gold text-amber-700 hover:bg-amber-50 transition-colors"
              >
                Build Your Own
              </button>
            </>
          )}
          {manualPairings && currentPairings.length > 0 && (
            <>
              <button
                onClick={addGroupManual}
                className="px-3 py-1.5 text-xs font-sans rounded border border-dashed border-forest text-forest hover:bg-forest/5 transition-colors"
              >
                + Add Pairing
              </button>
            </>
          )}
          {currentPairings.length > 0 && (
            <>
              <SaveBtn onClick={savePairings} saving={pairingsSaving} status={pairingsSaveStatus} label={pairingsState === 'published' ? 'Publish Updates' : 'Publish Pairings'} />
              <PdfBtn onClick={onExportPairingsPDF} disabled={!tournament}>
                Export Pairings PDF
              </PdfBtn>
              <button
                onClick={clearPairings}
                className="px-3 py-1.5 text-xs font-sans rounded border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>
      )}

      {activeTab === 'pairings' && (<>
      {/* No players notice */}
      {totalPlayers === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <p className="text-amber-700 font-sans text-sm font-medium mb-1">No players entered yet</p>
          <p className="text-amber-600 font-sans text-xs">Switch to Score Entry to add players to flights first.</p>
        </div>
      )}

      {/* Empty state */}
      {currentPairings.length === 0 && totalPlayers > 0 && (
        <div className="border-2 border-dashed border-gray-200 rounded-lg py-16 flex flex-col items-center justify-center">
          <p className="text-gray-400 font-sans text-sm mb-4">No pairings yet. Choose Auto-Generate or Build Your Own above.</p>
        </div>
      )}

      {manualPairings && currentPairings.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,1fr)_minmax(0,2fr)] gap-4 items-start">
          <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
              <h3 className="text-xs font-sans font-semibold text-forest uppercase tracking-widest">Players</h3>
              <span className="text-[11px] font-mono text-gray-500">{unpairedPlayers.length} unassigned</span>
            </div>
            <ul className="max-h-[65vh] overflow-auto divide-y divide-gray-100">
              {unpairedPlayers.length === 0 && (
                <li className="px-4 py-6 text-center text-gray-400 text-xs font-sans">All players are assigned.</li>
              )}
              {unpairedPlayers.map(p => (
                <li key={p.name} className="px-3 py-2">
                  <button
                    draggable
                    onDragStart={(event) => handleDragStart(event, { type: 'unassigned', name: p.name })}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedUnpaired(prev => prev === p.name ? null : p.name)}
                    className={`w-full text-left rounded border px-3 py-2 transition-colors cursor-grab active:cursor-grabbing ${
                      selectedUnpaired === p.name
                        ? 'bg-gold/20 border-gold text-forest'
                        : 'border-gray-200 hover:border-forest/30'
                    } ${draggedPlayer?.type === 'unassigned' && draggedPlayer.name === p.name ? 'opacity-55' : ''}`}
                    aria-label={`Drag or click ${formatName(p.name)} to assign`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-sans text-sm text-darktext truncate">{formatName(p.name)}</span>
                      <span className={`text-xs border px-1.5 py-0.5 rounded-full font-sans whitespace-nowrap ${flightTagStyles[p.flight] ?? flightTagStyles.Unassigned}`}>
                        {p.flight}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
              <h3 className="text-xs font-sans font-semibold text-forest uppercase tracking-widest">Pairings</h3>
              <span className="text-[11px] font-mono text-gray-500">{currentPairings.length} rows</span>
            </div>
            <div className="max-h-[65vh] overflow-auto divide-y divide-gray-100">
              {currentPairings.map((card, cardIdx) => (
                <div
                  key={cardIdx}
                  className={`px-4 py-3 transition-colors ${
                    dropTarget?.type === 'group' && dropTarget.cardIdx === cardIdx
                      ? 'bg-emerald-50/60'
                      : ''
                  }`}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    setDropTarget({ type: 'group', cardIdx })
                  }}
                  onDragLeave={() => setDropTarget(current => (
                    current?.type === 'group' && current.cardIdx === cardIdx ? null : current
                  ))}
                  onDrop={(event) => handleDropOnGroup(event, cardIdx)}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-forest">{card.pairing}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-gray-500">{card.players.length}/4</span>
                      <button onClick={() => removeGroupManual(cardIdx)} className="text-gray-300 hover:text-red-400 text-base leading-none" title="Remove pairing">×</button>
                    </div>
                  </div>
                  <ul className="space-y-1">
                    {card.players.map((player, playerIdx) => (
                      <li
                        key={player.name}
                        draggable
                        onDragStart={(event) => handleDragStart(event, { type: 'group', cardIdx, playerIdx })}
                        onDragEnd={handleDragEnd}
                        onDragOver={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          event.dataTransfer.dropEffect = 'move'
                          setDropTarget({ type: 'player', cardIdx, playerIdx })
                        }}
                        onDragLeave={() => setDropTarget(current => (
                          current?.type === 'player' && current.cardIdx === cardIdx && current.playerIdx === playerIdx ? null : current
                        ))}
                        onDrop={(event) => handleDropOnPlayer(event, cardIdx, playerIdx)}
                        className={`flex items-center justify-between gap-2 border rounded px-2.5 py-1.5 cursor-grab active:cursor-grabbing transition-colors ${
                          dropTarget?.type === 'player' && dropTarget.cardIdx === cardIdx && dropTarget.playerIdx === playerIdx
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-gray-100'
                        } ${
                          draggedPlayer?.type === 'group' && draggedPlayer.cardIdx === cardIdx && draggedPlayer.playerIdx === playerIdx
                            ? 'opacity-55'
                            : ''
                        }`}
                      >
                        <span className="font-sans text-sm text-darktext truncate">{formatName(player.name)}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs border px-1.5 py-0.5 rounded-full font-sans whitespace-nowrap ${flightTagStyles[player.flight] ?? flightTagStyles.Unassigned}`}>
                            {player.flight}
                          </span>
                          <button onClick={() => removePairedPlayer(cardIdx, playerIdx)} className="text-gray-300 hover:text-red-400 text-base leading-none" title="Remove from pairing">×</button>
                        </div>
                      </li>
                    ))}
                    {card.players.length === 0 && (
                      <li className="text-gray-300 text-xs italic font-sans px-1 py-0.5">Empty pairing</li>
                    )}
                  </ul>
                  {selectedUnpaired && card.players.length < 4 && (
                    <button
                      onClick={() => assignUnpairedToGroup(cardIdx)}
                      className="mt-2 w-full py-1.5 text-xs rounded bg-gold/10 text-amber-700 hover:bg-gold/20 font-sans font-semibold transition-colors"
                    >
                      Add {formatName(selectedUnpaired)}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {!manualPairings && unpairedPlayers.length > 0 && currentPairings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex flex-wrap items-center gap-3">
          <span className="text-amber-700 font-sans text-xs font-semibold uppercase tracking-widest flex-shrink-0">
            Not yet paired ({unpairedPlayers.length}) — drag into a group or click a player then click a group
          </span>
          <div className="flex flex-wrap gap-1.5">
            {unpairedPlayers.map(p => (
              <button
                key={p.name}
                draggable
                onDragStart={(event) => handleDragStart(event, { type: 'unassigned', name: p.name })}
                onDragEnd={handleDragEnd}
                onClick={() => setSelectedUnpaired(prev => prev === p.name ? null : p.name)}
                className={`text-xs border px-2 py-0.5 rounded-full font-sans cursor-grab active:cursor-grabbing transition-colors ${
                  selectedUnpaired === p.name
                    ? 'bg-gold/30 border-gold text-forest font-semibold'
                    : flightTagStyles[p.flight] ?? flightTagStyles.Unassigned
                } ${draggedPlayer?.name === p.name ? 'opacity-50' : ''}`}
              >
                {formatName(p.name)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pairing cards grid — always editable */}
      {!manualPairings && currentPairings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {currentPairings.map((card, cardIdx) => (
            <div
              key={card.pairing}
              className={`bg-white border rounded-lg overflow-hidden transition-colors ${
                dropTarget?.type === 'group' && dropTarget.cardIdx === cardIdx
                  ? 'border-emerald-400 bg-emerald-50/30'
                  : 'border-gray-200'
              }`}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                setDropTarget({ type: 'group', cardIdx })
              }}
              onDragLeave={() => setDropTarget(current => (
                current?.type === 'group' && current.cardIdx === cardIdx ? null : current
              ))}
              onDrop={(event) => handleDropOnGroup(event, cardIdx)}
            >
              <div className="bg-forest px-4 py-2 flex items-center justify-between">
                <span className="text-white font-sans text-xs font-semibold uppercase tracking-widest">
                  {card.pairing}
                </span>
                <span className="text-white/50 font-mono text-xs">{card.players.length}/4</span>
              </div>
              <ul className="divide-y divide-gray-100 min-h-[60px]">
                {card.players.map((player, playerIdx) => (
                  <li
                    key={player.name}
                    draggable
                    onDragStart={(event) => handleDragStart(event, { type: 'group', cardIdx, playerIdx })}
                    onDragEnd={handleDragEnd}
                    onDragOver={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      event.dataTransfer.dropEffect = 'move'
                      setDropTarget({ type: 'player', cardIdx, playerIdx })
                    }}
                    onDragLeave={() => setDropTarget(current => (
                      current?.type === 'player' && current.cardIdx === cardIdx && current.playerIdx === playerIdx ? null : current
                    ))}
                    onDrop={(event) => handleDropOnPlayer(event, cardIdx, playerIdx)}
                    className={`px-3 py-2.5 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing transition-colors group ${
                      dropTarget?.type === 'player' && dropTarget.cardIdx === cardIdx && dropTarget.playerIdx === playerIdx
                        ? 'bg-emerald-50 border-l-2 border-l-emerald-400'
                        : ''
                    } ${
                      draggedPlayer?.type === 'group' && draggedPlayer.cardIdx === cardIdx && draggedPlayer.playerIdx === playerIdx
                        ? 'opacity-50'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-sans text-sm text-darktext truncate">{formatName(player.name)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`text-xs border px-1.5 py-0.5 rounded-full font-sans whitespace-nowrap ${flightTagStyles[player.flight] ?? flightTagStyles.Unassigned}`}>
                        {player.flight}
                      </span>
                      <button
                        onClick={() => removePairedPlayer(cardIdx, playerIdx)}
                        className="text-gray-300 hover:text-red-400 text-base leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove from pairing"
                      >&times;</button>
                    </div>
                  </li>
                ))}
                {card.players.length === 0 && (
                  <li className="px-3 py-4 text-center text-gray-300 font-sans text-xs italic">
                    Empty group
                  </li>
                )}
              </ul>
              {selectedUnpaired && card.players.length < 4 && (
                <button
                  onClick={() => assignUnpairedToGroup(cardIdx)}
                  className="w-full py-1.5 text-xs rounded-b bg-gold/10 text-amber-700 hover:bg-gold/20 font-sans font-semibold transition-colors border-t border-amber-100"
                >
                  Add {formatName(selectedUnpaired)}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {currentPairings.length > 0 && (
        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4">
          <p className="text-blue-700 font-sans text-xs leading-relaxed">
            Pairings state: <strong className="uppercase">{pairingsState ?? 'none'}</strong>. Hit <strong>Save Pairings</strong> to publish the current draft.
          </p>
        </div>
      )}
      </>)}
    </div>
  )
}


// ── Flight Management Panel ───────────────────────────────────────────────────
const TEE_OPTIONS = ['Back', 'Senior', 'Front']

function FlightManagementPanel({
  effectiveMembers, membersData, credits, flightSearch, setFlightSearch,
  updateMemberFlight, updateMemberPtm, updateMemberTee, updateMemberName, updateMemberCell, removeMember,
  openConfirm,
  applyCredit,
  savePlayerManagement, playerManagementSaving, playerManagementSaveStatus, flightTagStyles,
  fileInputRef, handleXlsxFile, importPreview, setImportPreview,
  confirmImport, importSaving, importStatus, importError, setImportError,
  allFlights,
}) {
  const FLIGHT_OPTIONS = allFlights
  const SORTABLE_COLUMNS = ['name', 'ptm', 'creditOnBooks', 'tee']
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [editingRows, setEditingRows] = useState({})
  const [rowDrafts, setRowDrafts] = useState({})
  const [creditAdjustments, setCreditAdjustments] = useState({})
  const [creditAppliedFlash, setCreditAppliedFlash] = useState({})
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [bulkTee, setBulkTee] = useState('')
  const [bulkCredit, setBulkCredit] = useState('')
  const [filterFlight, setFilterFlight] = useState('all')
  const [filterTee, setFilterTee] = useState('all')
  const [onlyCredits, setOnlyCredits] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)

  const rows = useMemo(() => {
    const search = flightSearch.trim().toLowerCase()
    return effectiveMembers
      .filter(member => member.active !== false)
      .map(member => {
        const parsedCredit = Number(credits?.[member.name])
        return {
          id: member.id ?? member.name,
          originalName: member.originalName ?? member.name,
          name: member.name,
          flight: (member.flight && allFlights.includes(member.flight)) ? member.flight : null,
          ptm: fmtPtmValue(member.ptm),
          tee: member.tee ?? null,
          creditOnBooks: Number.isFinite(parsedCredit) ? parsedCredit : 0,
        }
      })
      .filter(member => {
        if (search && !member.name.toLowerCase().includes(search) && !formatName(member.name).toLowerCase().includes(search)) return false
        if (filterFlight !== 'all') {
          if (filterFlight === '__unassigned__' && member.flight) return false
          if (filterFlight !== '__unassigned__' && member.flight !== filterFlight) return false
        }
        if (filterTee !== 'all') {
          if (filterTee === '__unset__' && member.tee) return false
          if (filterTee !== '__unset__' && member.tee !== filterTee) return false
        }
        if (onlyCredits && member.creditOnBooks <= 0) return false
        return true
      })
      .sort((a, b) => {
        const direction = sortDir === 'asc' ? 1 : -1
        if (sortBy === 'name') return compareByLastName(a, b) * direction
        if (sortBy === 'ptm') return ((a.ptm ?? Number.NEGATIVE_INFINITY) - (b.ptm ?? Number.NEGATIVE_INFINITY)) * direction
        if (sortBy === 'creditOnBooks') return (a.creditOnBooks - b.creditOnBooks) * direction
        return String(a[sortBy] ?? '').localeCompare(String(b[sortBy] ?? '')) * direction
      })
  }, [credits, effectiveMembers, filterFlight, filterTee, flightSearch, onlyCredits, sortBy, sortDir])

  const selectedCount = selectedRows.size
  const selectedVisibleNames = useMemo(
    () => rows.filter(row => selectedRows.has(row.originalName)).map(row => row.originalName),
    [rows, selectedRows]
  )
  const allVisibleSelected = rows.length > 0 && rows.every(row => selectedRows.has(row.originalName))
  const hasVisibleRows = rows.length > 0
  const totalCreditOnBooks = useMemo(() => rows.reduce((sum, row) => sum + row.creditOnBooks, 0), [rows])

  const rowHeight = 54
  const viewportHeight = 560
  const shouldVirtualize = rows.length >= 200
  const startIndex = shouldVirtualize ? Math.max(0, Math.floor(scrollTop / rowHeight) - 8) : 0
  const endIndex = shouldVirtualize ? Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / rowHeight) + 8) : rows.length
  const visibleRows = shouldVirtualize ? rows.slice(startIndex, endIndex) : rows
  const topSpacerHeight = shouldVirtualize ? startIndex * rowHeight : 0
  const bottomSpacerHeight = shouldVirtualize ? (rows.length - endIndex) * rowHeight : 0

  function updateSort(column) {
    if (!SORTABLE_COLUMNS.includes(column)) return
    if (sortBy === column) setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    else {
      setSortBy(column)
      setSortDir(column === 'name' ? 'asc' : 'desc')
    }
  }

  function startEditingRow(row) {
    setEditingRows(prev => ({ ...prev, [row.originalName]: true }))
    setRowDrafts(prev => ({
      ...prev,
      [row.originalName]: {
        name: row.name,
        tee: row.tee ?? '',
        ptm: row.ptm ?? '',
        cell: row.cell ?? '',
      },
    }))
  }

  function cancelEditingRow(originalName) {
    setEditingRows(prev => ({ ...prev, [originalName]: false }))
    setRowDrafts(prev => {
      const next = { ...prev }
      delete next[originalName]
      return next
    })
  }

  function saveEditingRow(originalName) {
    const draft = rowDrafts[originalName]
    if (!draft) return
    const ptmRaw = String(draft.ptm ?? '').trim()
    const normalizedPtm = ptmRaw === '' ? null : Number(ptmRaw)
    if (ptmRaw !== '' && !Number.isFinite(normalizedPtm)) return
    if (draft.tee && !TEE_OPTIONS.includes(draft.tee)) return
    const newName = (draft.name ?? '').trim()
    if (newName && newName !== originalName) updateMemberName(originalName, newName)
    updateMemberPtm(originalName, ptmRaw === '' ? '' : normalizedPtm)
    updateMemberTee(originalName, draft.tee || '')
    updateMemberCell(originalName, draft.cell || '')
    cancelEditingRow(originalName)
  }

  function applyRowCredit(originalName) {
    const value = creditAdjustments[originalName]
    if (value == null || value === '') return
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed === 0) return
    applyCredit(originalName, parsed)
    setCreditAdjustments(prev => ({ ...prev, [originalName]: '' }))
    setCreditAppliedFlash(prev => ({ ...prev, [originalName]: true }))
    setTimeout(() => setCreditAppliedFlash(prev => ({ ...prev, [originalName]: false })), 1500)
  }

  function toggleSelect(originalName) {
    setSelectedRows(prev => {
      const next = new Set(prev)
      if (next.has(originalName)) next.delete(originalName)
      else next.add(originalName)
      return next
    })
  }

  function toggleSelectVisible() {
    setSelectedRows(prev => {
      const next = new Set(prev)
      if (allVisibleSelected) rows.forEach(row => next.delete(row.originalName))
      else rows.forEach(row => next.add(row.originalName))
      return next
    })
  }

  function applyBulkTee() {
    if (!bulkTee || !TEE_OPTIONS.includes(bulkTee) || selectedVisibleNames.length === 0) return
    selectedVisibleNames.forEach(originalName => updateMemberTee(originalName, bulkTee))
  }

  function applyBulkCredit(sign = 1) {
    if (selectedVisibleNames.length === 0) return
    const parsed = Number(bulkCredit)
    if (!Number.isFinite(parsed) || parsed <= 0) return
    selectedVisibleNames.forEach(originalName => applyCredit(originalName, sign * parsed))
    setBulkCredit('')
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <p className="text-xs font-sans text-gray-500 leading-relaxed">
            Edit individual rows below, or <strong className="text-darktext">upload your spreadsheet</strong> to import tee and PTM data for the whole roster at once.
            Hit <strong className="text-darktext">Save to Cloud</strong> to publish.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleXlsxFile}
            className="hidden"
          />
          <button
            onClick={() => {
              const ws = XLSX.utils.aoa_to_sheet([
                ['Name', 'Tee', 'Points to make', 'Credit on Books', 'Email', 'Phone', 'NEW', '2nd', '3rd', '4th', '5th', '6th', '7th'],
                ['John Smith', 'Back', 90, 0, 'john@example.com', '555-123-4567', 82, 88, 91, '', '', '', ''],
                ['Jane Doe', 'Senior', 105, 5, '', '555-987-6543', 110, 104, 108, 101, 107, 99, 103],
              ])
              const wb = XLSX.utils.book_new()
              XLSX.utils.book_append_sheet(wb, ws, 'Roster')
              XLSX.writeFile(wb, 'player-management-template.xlsx')
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-sans font-semibold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-sans font-semibold rounded-lg border border-forest text-forest hover:bg-forest hover:text-white transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import Excel
          </button>
          <SaveBtn onClick={savePlayerManagement} saving={playerManagementSaving} status={playerManagementSaveStatus} />
        </div>
      </div>

      {/* Import error */}
      {importError && (
        <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm font-sans text-red-700">
          <span className="font-semibold flex-shrink-0">Import error:</span>
          <span className="flex-1 break-all">{importError}</span>
          <button onClick={() => setImportError(null)} className="flex-shrink-0 text-red-400 hover:text-red-700 leading-none text-lg">×</button>
        </div>
      )}

      {/* Import preview */}
      {importPreview && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <p className="text-sm font-sans font-semibold text-amber-800">
                Ready to import — {importPreview.matched.length} members matched
                {importPreview.unmatched.length > 0 && (
                  <span className="text-amber-600"> · {importPreview.unmatched.length} new members will be created</span>
                )}
              </p>
              <p className="text-xs font-sans text-amber-700 mt-0.5">
                {membersData.length === 0
                  ? 'Bootstrapping roster: all unmatched rows will be added as new members.'
                  : 'This will update member info (tee, PTM, contact, credits).'}
                {' '}Review below then confirm.
              </p>
            </div>
            <button
              onClick={() => setImportPreview(null)}
              className="text-amber-500 hover:text-amber-800 text-lg leading-none flex-shrink-0"
            >×</button>
          </div>

          {/* Sample of changes */}
          <div className="overflow-x-auto rounded border border-amber-200 mb-3">
            <table className="w-full text-xs font-sans min-w-[600px]">
              <thead>
                <tr className="bg-amber-100 text-amber-700">
                  <th className="px-2 py-2 text-left font-semibold">Player</th>
                  <th className="px-2 py-2 text-center font-semibold">Tee</th>
                  <th className="px-2 py-2 text-center font-semibold">PTM</th>
                  <th className="px-2 py-2 text-center font-semibold">Credits</th>
                  <th className="px-2 py-2 text-center font-semibold">Email</th>
                  <th className="px-2 py-2 text-center font-semibold">Cell</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.matched.slice(0, 8).map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-amber-50/40'}>
                    <td className="px-2 py-1.5 text-darktext font-medium">{formatName(row.memberName)}</td>
                    <td className="px-2 py-1.5 text-center"><TeeTag tee={row.tee} /></td>
                    <td className="px-2 py-1.5 text-center font-mono text-gray-600">{roundPtm(row.ptm) ?? '—'}</td>
                    <td className="px-2 py-1.5 text-center font-mono text-gray-600">{row.creditOnBooks ?? '—'}</td>
                    <td className="px-2 py-1.5 text-center text-gray-500 truncate text-xs">{row.email ?? '—'}</td>
                    <td className="px-2 py-1.5 text-center text-gray-500 truncate text-xs">{row.cellPhone ?? '—'}</td>
                  </tr>
                ))}
                {importPreview.matched.length > 8 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-2 text-center text-amber-600 italic">
                      …and {importPreview.matched.length - 8} more
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {importPreview.unmatched.length > 0 && (
            <p className="text-xs text-amber-600 mb-3">
              <strong>Not matched:</strong> {importPreview.unmatched.map(r => r.rawName).join(', ')}
            </p>
          )}

          <div className="flex gap-2">
            <SaveBtn
              onClick={confirmImport}
              saving={importSaving}
              status={importStatus}
              label={`Import ${importPreview.matched.length + (membersData.length === 0 ? importPreview.unmatched.length : 0)} Members`}
              className="!bg-amber-600 hover:!bg-amber-700"
            />
            <button
              onClick={() => setImportPreview(null)}
              className="px-3 py-2 text-xs font-sans rounded border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-forest px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-3">
            <span className="text-white font-sans text-sm font-semibold">Player Roster</span>
            <span className="text-white/50 font-mono text-xs">{effectiveMembers.length} members</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <select
              value={filterFlight}
              onChange={e => setFilterFlight(e.target.value)}
              className="border border-white/20 rounded px-2 py-1 text-xs font-sans bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-gold"
            >
              <option value="all" className="text-darktext">All Flights</option>
              <option value="__unassigned__" className="text-darktext">Unassigned</option>
              {FLIGHT_OPTIONS.map(flight => <option key={flight} value={flight} className="text-darktext">{flight}</option>)}
            </select>
            <select
              value={filterTee}
              onChange={e => setFilterTee(e.target.value)}
              className="border border-white/20 rounded px-2 py-1 text-xs font-sans bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-gold"
            >
              <option value="all" className="text-darktext">All Tees</option>
              <option value="__unset__" className="text-darktext">No Tee</option>
              {TEE_OPTIONS.map(tee => <option key={tee} value={tee} className="text-darktext">{tee}</option>)}
            </select>
            <label className="text-white/90 text-xs font-sans flex items-center gap-1.5">
              <input type="checkbox" checked={onlyCredits} onChange={e => setOnlyCredits(e.target.checked)} />
              Credit &gt; $0
            </label>
            <input
              type="text"
              value={flightSearch}
              onChange={e => setFlightSearch(e.target.value)}
              placeholder="Search…"
              className="border border-white/20 rounded px-2 py-1 text-xs font-sans bg-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-gold w-32 sm:w-40"
            />
          </div>
        </div>

        <div className="border-b border-gray-200 px-4 py-2.5 flex flex-wrap gap-2 items-center bg-gray-50/70">
          <span className="text-xs font-sans text-gray-600">Selected: <strong className="text-forest">{selectedVisibleNames.length}</strong></span>
          <select value={bulkTee} onChange={e => setBulkTee(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs font-sans">
            <option value="">Bulk Set Tee</option>
            {TEE_OPTIONS.map(tee => <option key={tee} value={tee}>{tee}</option>)}
          </select>
          <button onClick={applyBulkTee} disabled={!bulkTee || selectedVisibleNames.length === 0} className="px-2.5 py-1 text-xs rounded border border-gray-300 disabled:opacity-40">Apply Tee</button>
          <input value={bulkCredit} onChange={e => setBulkCredit(e.target.value)} type="number" step="0.01" placeholder="Bulk credit $" className="w-28 border border-gray-300 rounded px-2 py-1 text-xs font-mono" />
          <button onClick={() => applyBulkCredit(1)} disabled={!bulkCredit || selectedVisibleNames.length === 0} className="px-2.5 py-1 text-xs rounded bg-green-600 text-white disabled:opacity-40">Bulk Add Credit</button>
          <button onClick={() => applyBulkCredit(-1)} disabled={!bulkCredit || selectedVisibleNames.length === 0} className="px-2.5 py-1 text-xs rounded bg-amber-600 text-white disabled:opacity-40">Bulk Subtract Credit</button>
          <button onClick={() => setSelectedRows(new Set())} disabled={selectedCount === 0} className="px-2.5 py-1 text-xs rounded border border-gray-300 disabled:opacity-40">Clear Selection</button>
        </div>

        <div className="max-h-[560px] overflow-auto" onScroll={e => setScrollTop(e.currentTarget.scrollTop)}>
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="table-header sticky top-0 z-20 bg-gray-50 text-gray-500 text-center w-12">
                  <input type="checkbox" checked={allVisibleSelected && hasVisibleRows} onChange={toggleSelectVisible} />
                </th>
                <th onClick={() => updateSort('name')} className="table-header sticky top-0 z-20 bg-gray-50 text-gray-500 text-left cursor-pointer">Player</th>
                <th onClick={() => updateSort('ptm')} className="table-header sticky top-0 z-20 bg-gray-50 text-gray-500 text-center cursor-pointer">PTM</th>
                <th onClick={() => updateSort('creditOnBooks')} className="table-header sticky top-0 z-20 bg-gray-50 text-gray-500 text-right cursor-pointer">Credit on Books</th>
                <th className="table-header sticky top-0 z-20 bg-gray-50 text-gray-500 text-center">Adjust Credit</th>
                <th onClick={() => updateSort('tee')} className="table-header sticky top-0 z-20 bg-gray-50 text-gray-500 text-center cursor-pointer">Tee</th>
                <th className="table-header sticky top-0 z-20 bg-gray-50 text-gray-500 text-center">Phone</th>
                <th className="table-header sticky top-0 z-20 bg-gray-50 text-gray-500 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shouldVirtualize && topSpacerHeight > 0 && (
                <tr>
                  <td colSpan={8} style={{ height: `${topSpacerHeight}px`, padding: 0, border: 0 }} />
                </tr>
              )}
              {visibleRows.map((row, idx) => {
                const isEditing = !!editingRows[row.originalName]
                const draft = rowDrafts[row.originalName] ?? { name: row.name, flight: row.flight ?? '', tee: row.tee ?? '', ptm: row.ptm ?? '', cell: row.cell ?? '' }
                const setDraft = (patch) => setRowDrafts(prev => ({ ...prev, [row.originalName]: { ...draft, ...patch } }))
                return (
                  <tr
                    key={row.originalName}
                    className={`border-b border-gray-100 last:border-0 transition-colors ${
                      (startIndex + idx) % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                    } ${isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    style={shouldVirtualize ? { height: `${rowHeight}px` } : undefined}
                  >
                    <td className="px-3 py-2.5 text-center sticky left-0 bg-inherit">
                      <input type="checkbox" checked={selectedRows.has(row.originalName)} onChange={() => toggleSelect(row.originalName)} />
                    </td>
                    <td className="px-4 py-2.5 font-sans text-sm text-darktext whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="text"
                          value={draft.name ?? ''}
                          onChange={e => setDraft({ name: e.target.value })}
                          className="border border-gray-300 rounded px-2 py-1 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-forest w-44"
                          placeholder="Player name"
                        />
                      ) : (
                        formatName(row.name)
                      )}
                    </td>

                    <td className="px-4 py-2.5 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          value={draft.ptm}
                          onChange={e => setDraft({ ptm: e.target.value })}
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-forest"
                        />
                      ) : (
                        <span className="stat-number text-xs text-gray-600">
                          {roundPtm(row.ptm) ?? '—'}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-600">
                      {fmtCurrency(row.creditOnBooks)}
                    </td>

                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <input
                          type="number"
                          step="0.01"
                          value={creditAdjustments[row.originalName] ?? ''}
                          onChange={e => setCreditAdjustments(prev => ({ ...prev, [row.originalName]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && applyRowCredit(row.originalName)}
                          placeholder="+ / - $"
                          className="w-24 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                        />
                        <button
                          onClick={() => applyRowCredit(row.originalName)}
                          disabled={!creditAdjustments[row.originalName]}
                          title="Apply adjustment"
                          className={`w-7 h-7 flex items-center justify-center rounded text-sm font-bold disabled:opacity-30 transition-colors ${creditAppliedFlash[row.originalName] ? 'bg-green-600 text-white' : 'bg-forest text-white hover:bg-forest/80'}`}
                        >
                          ✓
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-2.5 text-center">
                      {isEditing ? (
                        <select
                          value={draft.tee}
                          onChange={e => setDraft({ tee: e.target.value })}
                          className="border border-gray-300 rounded px-2 py-1 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-forest"
                        >
                          <option value="">—</option>
                          {TEE_OPTIONS.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      ) : (
                        <TeeTag tee={row.tee} />
                      )}
                    </td>

                    <td className="px-4 py-2.5 text-center">
                      {isEditing ? (
                        <input
                          type="tel"
                          value={draft.cell ?? ''}
                          onChange={e => setDraft({ cell: e.target.value })}
                          className="w-32 border border-gray-300 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-forest"
                          placeholder="555-123-4567"
                        />
                      ) : (
                        <span className="text-xs font-mono text-gray-500">{row.cell || '—'}</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-2 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => saveEditingRow(row.originalName)} className="px-2.5 py-1 text-xs rounded bg-forest text-white hover:bg-forest/80 font-sans font-semibold transition-colors">Save</button>
                          <button onClick={() => cancelEditingRow(row.originalName)} className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-500 hover:text-red-500 hover:border-red-300 transition-colors">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => startEditingRow(row)}
                            className="px-2.5 py-1 text-xs rounded border border-gray-200 text-gray-500 hover:text-forest hover:border-forest font-sans transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={async () => {
                              if (await openConfirm(`Remove ${formatName(row.name)} from the roster? They will be marked inactive and hidden.`))
                                removeMember(row.originalName)
                            }}
                            className="px-2.5 py-1 text-xs rounded border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 font-sans transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {shouldVirtualize && bottomSpacerHeight > 0 && (
                <tr>
                  <td colSpan={8} style={{ height: `${bottomSpacerHeight}px`, padding: 0, border: 0 }} />
                </tr>
              )}
              {!rows.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400 font-sans text-sm">
                    No players match your filters.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-forest/5 border-t border-forest/20">
                <td colSpan={3} className="px-4 py-2 text-xs font-sans text-forest font-semibold uppercase tracking-widest">Visible Credit Total</td>
                <td className="px-4 py-2 text-right font-mono text-xs text-forest font-semibold">{fmtCurrency(totalCreditOnBooks)}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

