import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { signInWithEmailAndPassword } from 'firebase/auth'
import PageWrapper from '../components/layout/PageWrapper'
import schedule from '../data/schedule.json'
import { formatName, compareByLastName } from '../utils/formatName'
import { DB } from '../db'
import { auth } from '../firebase'
import { useFireData } from '../hooks/useFireData'
import TeeTag from '../components/ui/TeeTag'

const FLIGHTS      = ['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight']
const STORAGE_KEY  = 'cga_admin_v1'
const PAIRINGS_KEY = 'cga_pairings_v1'
const MEMBERS_KEY  = 'cga_members_v1'
const CREDITS_KEY  = 'cga_credits_v1'
const PIN          = import.meta.env.VITE_ADMIN_PIN ?? 'cga2026'

const PDF_NAVY = [27,  59,  111]
const PDF_GOLD = [201, 168, 76]

const flightTagStyles = {
  Championship: 'bg-amber-50 text-amber-700 border-amber-200',
  '1st Flight': 'bg-blue-50 text-blue-700 border-blue-200',
  '2nd Flight': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  '3rd Flight': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '4th Flight': 'bg-purple-50 text-purple-700 border-purple-200',
  '5th Flight': 'bg-pink-50 text-pink-700 border-pink-200',
  Unassigned:   'bg-gray-100 text-gray-600 border-gray-200',
}

// ── POY calculation ────────────────────────────────────────────────────────────
function calcFlightPOY(players) {
  if (!players.length) return players
  const n     = players.length
  const scale = Array.from({ length: n }, (_, i) => 350 - 25 * i)

  const withPM = players.map((p, i) => {
    const hasData = p.ptm !== '' && p.score !== '' && p.ptm != null && p.score != null
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
const fmtPOY = p  => p.poy == null ? '—' : p.eligible === false ? 'X' : p.poy % 1 === 0 ? String(p.poy) : p.poy.toFixed(1)

// Keep downloadJSON for PDF-adjacent uses (e.g. debug), but primary flow is Firestore.
function downloadJSON(obj, filename) {
  const a = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })),
    download: filename,
  })
  a.click()
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
    // Excel format: "Last, First [Suffix]"  OR  "First Last"
    const parts = String(rawExcelName).split(',').map(s => s.trim())
    if (parts.length < 2) return exactLookup[parts[0].toLowerCase()] ?? null
    const lastName  = parts[0]
    const firstName = parts.slice(1).join(' ').trim()  // e.g. "Alan Sr"

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
    const flight          = row['Flight'] ?? null
    const creditOnBooks   = row['Credit on Books'] !== null ? Number(row['Credit on Books']) : null
    const email           = row['Email Address'] ?? row['Email'] ?? null
    const homePhone       = row['Home Phone'] ?? null
    const cellPhone       = row['Cell/Work'] ?? row['Cell'] ?? row['Work'] ?? null
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
      tee, ptm, flight, creditOnBooks, email, homePhone, cellPhone,
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
  } catch (e) {
    console.error('Firestore save error:', e)
    setSaveStatus('err')
    setErrMsg?.(e?.message || String(e) || 'Unknown error')
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

function fmtDateShort(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

// ── PDF utilities ──────────────────────────────────────────────────────────────
async function loadLogoBase64() {
  try {
    const res = await fetch('/cga-logo.jpg')
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror   = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

async function buildPdfHeader(doc, title, subtitle = '') {
  const pw   = doc.internal.pageSize.getWidth()
  const logo = await loadLogoBase64()

  doc.setFillColor(...PDF_NAVY)
  doc.rect(0, 0, pw, 38, 'F')

  if (logo) doc.addImage(logo, 'JPEG', 10, 4, 30, 30)

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
async function exportTournamentInfoPDF(tournament) {
  if (!tournament) return
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const pw  = doc.internal.pageSize.getWidth()
  let y = await buildPdfHeader(doc, 'Tournament Information', 'CGA 2026 Season')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...PDF_NAVY)
  const nameLines = doc.splitTextToSize(tournament.name, pw - 28)
  doc.text(nameLines, 14, y + 6)
  y += 8 + nameLines.length * 9

  doc.setDrawColor(...PDF_GOLD)
  doc.setLineWidth(0.8)
  doc.line(14, y, pw - 14, y)
  y += 10

  const fields = [
    ['DATE',                  fmtDate(tournament.date)],
    ['COURSE',                tournament.course || '—'],
    ['TEE TIME',              tournament.teeTime || '—'],
    ['FORMAT',                tournament.format || '—'],
    ['ENTRY FEE',             tournament.entryFee || '—'],
    ['REGISTRATION DEADLINE', fmtDateShort(tournament.dueDate)],
  ]
  fields.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');  doc.setFontSize(8);  doc.setTextColor(...PDF_NAVY)
    doc.text(label, 14, y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(13); doc.setTextColor(25, 25, 25)
    doc.text(value, 14, y + 6)
    y += 16
  })

  if (tournament.notes) {
    doc.setDrawColor(210, 215, 225); doc.setLineWidth(0.3); doc.line(14, y, pw - 14, y); y += 8
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...PDF_NAVY)
    doc.text('NOTES', 14, y); y += 5
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60, 60, 60)
    const noteLines = doc.splitTextToSize(tournament.notes, pw - 28)
    doc.text(noteLines, 14, y)
    y += noteLines.length * 5 + 6
  }

  doc.setDrawColor(210, 215, 225); doc.setLineWidth(0.3); doc.line(14, y, pw - 14, y); y += 8
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...PDF_NAVY)
  doc.text('ADDITIONAL NOTES', 14, y); y += 6
  for (let i = 0; i < 4; i++) {
    doc.setDrawColor(190, 195, 205); doc.setLineWidth(0.2); doc.line(14, y, pw - 14, y); y += 8
  }

  addPdfFooter(doc, `Generated ${new Date().toLocaleDateString()} · Carencro Golf Association`)
  doc.save(`${tournament.id.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-tournament-info.pdf`)
}

// ── PDF: Pairings ──────────────────────────────────────────────────────────────
async function exportPairingsPDF(tournament, pairings) {
  if (!tournament || !pairings.length) return
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const y = await buildPdfHeader(
    doc, 'Pairings',
    `${tournament.name} · ${fmtDate(tournament.date)} · ${tournament.course}`
  )
  const maxPlayers = Math.max(...pairings.map(c => c.players.length))
  const playerCols = Array.from({ length: maxPlayers }, (_, i) => `Player ${i + 1}`)
  const body = pairings.map((card, i) => {
    const row = [i + 1]
    for (let j = 0; j < maxPlayers; j++) {
      const p = card.players[j]
      row.push(p ? `${p.name}  (${p.flight})` : '')
    }
    return row
  })
  autoTable(doc, {
    head: [['#', ...playerCols]], body, startY: y, theme: 'striped',
    headStyles:      { fillColor: PDF_NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    styles:          { fontSize: 9, cellPadding: 3 },
    columnStyles:    { 0: { halign: 'center', cellWidth: 12, fontStyle: 'bold' } },
    margin:          { left: 14, right: 14 },
  })
  addPdfFooter(doc, `Generated ${new Date().toLocaleDateString()} · Carencro Golf Association`)
  doc.save(`${tournament.id.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-pairings.pdf`)
}

// ── PDF: Points to Make ────────────────────────────────────────────────────────
async function exportPtmPDF(membersList) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  let y = await buildPdfHeader(doc, 'Points to Make', 'CGA 2026 Season — Full Roster by Flight')

  const grouped = FLIGHTS.reduce((acc, f) => ({ ...acc, [f]: [] }), {})
  const unassigned = []
  for (const m of membersList) {
    if (m.active === false) continue
    if (m.flight && grouped[m.flight]) grouped[m.flight].push(m)
    else unassigned.push(m)
  }
  const flightColors = {
    'Championship': [160, 110, 0], '1st Flight': [30, 80, 180],
    '2nd Flight':   [55, 60, 165], '3rd Flight': [20, 120, 80],
    '4th Flight':   [100, 40, 150], '5th Flight': [180, 50, 100],
  }
  for (const fl of FLIGHTS) {
    const members = grouped[fl]
    if (!members.length) continue
    const color = flightColors[fl] ?? PDF_NAVY
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...color)
    doc.text(fl.toUpperCase(), 14, y + 4)
    autoTable(doc, {
      head: [['#', 'Player', 'PTM', 'Tee']],
      body: members.slice().sort((a, b) => a.name.localeCompare(b.name))
                   .map((m, i) => [i + 1, m.name, m.ptm ?? '—', m.tee ?? '—']),
      startY: y + 6, theme: 'striped',
      headStyles:      { fillColor: color, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 2: { halign: 'center', cellWidth: 20, fontStyle: 'bold' }, 3: { halign: 'center', cellWidth: 20 } },
      margin: { left: 14, right: 14 },
    })
    y = doc.lastAutoTable.finalY + 8
  }
  if (unassigned.length) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(100, 100, 100)
    doc.text('UNASSIGNED', 14, y + 4)
    autoTable(doc, {
      head: [['#', 'Player', 'PTM', 'Tee']],
      body: unassigned.slice().sort((a, b) => a.name.localeCompare(b.name))
                      .map((m, i) => [i + 1, m.name, m.ptm ?? '—', m.tee ?? '—']),
      startY: y + 6, theme: 'striped',
      headStyles:      { fillColor: [110, 110, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 2: { halign: 'center', cellWidth: 20, fontStyle: 'bold' }, 3: { halign: 'center', cellWidth: 20 } },
      margin: { left: 14, right: 14 },
    })
  }
  addPdfFooter(doc, `Generated ${new Date().toLocaleDateString()} · Carencro Golf Association`)
  doc.save('cga-2026-points-to-make.pdf')
}

// ── PDF: Tournament Results ────────────────────────────────────────────────────
async function exportResultsPDF(tournament, flightData) {
  if (!tournament) return
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  let y = await buildPdfHeader(
    doc, 'Tournament Results',
    `${tournament.name} · ${fmtDate(tournament.date)} · ${tournament.course}`
  )
  const flightColors = {
    'Championship': [160, 110, 0], '1st Flight': [30, 80, 180],
    '2nd Flight':   [55, 60, 165], '3rd Flight': [20, 120, 80],
    '4th Flight':   [100, 40, 150], '5th Flight': [180, 50, 100],
  }
  for (const fl of FLIGHTS) {
    const rawPs = flightData[fl] ?? []
    const ps    = calcFlightPOY(rawPs)
    if (!ps.length) continue
    const ranked   = [...ps].filter(p => p.rank != null).sort((a, b) => a.rank - b.rank || b.plusMinus - a.plusMinus)
    const unranked = ps.filter(p => p.rank == null)
    const rows     = [...ranked, ...unranked]
    const color = flightColors[fl] ?? PDF_NAVY
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...color)
    doc.text(fl.toUpperCase(), 14, y + 4)
    autoTable(doc, {
      head: [['Rank', 'Player', 'PTM', 'Score', '+/−', 'POY Pts']],
      body: rows.map(p => [
        p.rank ?? '—', p.name + (p.eligible === false ? ' *' : ''), p.ptm ?? '—', p.score ?? '—',
        p.plusMinus == null ? '—' : p.plusMinus > 0 ? `+${p.plusMinus}` : String(p.plusMinus),
        fmtPOY(p),
      ]),
      startY: y + 6, theme: 'striped',
      headStyles:         { fillColor: color, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      styles:             { fontSize: 8, cellPadding: 2 },
      columnStyles: { 0: { halign: 'center', cellWidth: 14 }, 2: { halign: 'center', cellWidth: 14 }, 3: { halign: 'center', cellWidth: 14 }, 4: { halign: 'center', cellWidth: 14 }, 5: { halign: 'center', cellWidth: 22 } },
      margin: { left: 14, right: 14 },
      didParseCell(data) {
        if (data.section !== 'body') return
        const p = rows[data.row.index]
        if (!p) return
        if (data.column.index === 0 && p.rank != null && p.rank <= 3) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.textColor = p.rank === 1 ? PDF_GOLD : color
        }
        if (data.column.index === 4 && p.plusMinus != null) {
          data.cell.styles.textColor = p.plusMinus > 0 ? [0, 140, 60] : p.plusMinus < 0 ? [180, 30, 30] : [100, 100, 100]
        }
      },
    })
    y = doc.lastAutoTable.finalY + 8
  }
  addPdfFooter(doc, `* = ineligible for POY · Generated ${new Date().toLocaleDateString()} · CGA`)
  doc.save(`${tournament.id.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-results.pdf`)
}

// ── PDF: Credit on Books ───────────────────────────────────────────────────────
async function exportCreditsPDF(credits, membersList) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  let y = await buildPdfHeader(doc, 'Credit on Books', `CGA 2026 · As of ${new Date().toLocaleDateString()}`)
  const rows = membersList
    .filter(m => m.active !== false)
    .map(m => ({ name: m.name, flight: m.flight ?? 'Unassigned', balance: credits[m.name] ?? 0 }))
    .sort((a, b) => {
      if (a.balance !== 0 && b.balance === 0) return -1
      if (a.balance === 0 && b.balance !== 0) return 1
      if (a.balance !== b.balance) return b.balance - a.balance
      return a.name.localeCompare(b.name)
    })
  const total        = rows.reduce((s, r) => s + r.balance, 0)
  const nonZeroCount = rows.filter(r => r.balance !== 0).length
  autoTable(doc, {
    head: [['#', 'Player', 'Flight', 'Balance']],
    body: rows.map((r, i) => [
      i + 1, r.name, r.flight,
      r.balance === 0 ? '$0.00' : `${r.balance < 0 ? '−' : ''}$${Math.abs(r.balance).toFixed(2)}`,
    ]),
    foot:   [['', '', 'TOTAL', `${total < 0 ? '−' : ''}$${Math.abs(total).toFixed(2)}`]],
    startY: y, theme: 'striped',
    headStyles:         { fillColor: PDF_NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    footStyles:         { fillColor: PDF_NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    styles:             { fontSize: 8, cellPadding: 2.5 },
    columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 3: { halign: 'right', cellWidth: 30 } },
    margin: { left: 14, right: 14 },
    didParseCell(data) {
      if (data.section !== 'body') return
      const r = rows[data.row.index]
      if (!r) return
      if (data.column.index === 3) {
        if (r.balance > 0)      data.cell.styles.textColor = [0, 140, 60]
        else if (r.balance < 0) data.cell.styles.textColor = [180, 30, 30]
        else                    data.cell.styles.textColor = [180, 180, 180]
      }
      if (r.balance !== 0) data.cell.styles.fontStyle = 'bold'
    },
  })
  addPdfFooter(doc, `${nonZeroCount} member${nonZeroCount !== 1 ? 's' : ''} with balance · Total: $${total.toFixed(2)}`)
  doc.save('cga-2026-credit-on-books.pdf')
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

// ── PIN gate ───────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@cga.local'

export default function Admin() {
  const [pin,       setPin]       = useState('')
  const [unlocked,  setUnlocked]  = useState(false)
  const [err,       setErr]       = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [authError, setAuthError] = useState(null)

  const tryUnlock = async () => {
    if (pin !== PIN) { setErr(true); setTimeout(() => setErr(false), 1500); return }
    setLoading(true)
    setAuthError(null)
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, pin)
      setUnlocked(true)
    } catch (e) {
      setAuthError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!unlocked) return (
    <PageWrapper>
      <div className="max-w-xs mx-auto mt-24">
        <h1 className="section-title text-2xl mb-6">Admin</h1>
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
          <input
            type="password" value={pin} onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && tryUnlock()}
            placeholder="PIN" autoFocus
            className={`w-full border rounded px-3 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-forest ${err ? 'border-red-400' : 'border-gray-300'}`}
          />
          {err && <p className="text-red-500 text-xs font-sans">Incorrect PIN.</p>}
          {authError && <p className="text-red-500 text-xs font-sans break-all">Firebase: {authError}</p>}
          <button onClick={tryUnlock} disabled={loading} className="btn-primary w-full text-center disabled:opacity-60">
            {loading ? 'Signing in…' : 'Unlock'}
          </button>
        </div>
      </div>
    </PageWrapper>
  )

  return <AdminPanel />
}

// ── Admin panel ────────────────────────────────────────────────────────────────
function AdminPanel() {
  // Live data from Firebase
  const { data: membersData = [] } = useFireData(DB.listenMembers, [])
  const { data: currentStandings } = useFireData(DB.listenStandings, { flights: {} })
  const { data: livePtmData } = useFireData(DB.listenPtm, [])

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

  const [tid,          setTid]          = useState(schedule[0]?.id ?? '')
  const [flight,       setFlight]       = useState(FLIGHTS[0])
  const [poolSearch,   setPoolSearch]   = useState('')
  const [adminMode,    setAdminMode]    = useState('scores')
  const [creditSearch, setCreditSearch] = useState('')
  const [creditInputs, setCreditInputs] = useState({})

  // Global save error banner
  const [adminError, setAdminError] = useState(null)  // string | null

  // Save states: null | 'ok' | 'err'
  const [scoresSaving,   setScoresSaving]   = useState(false)
  const [scoresSaveStatus, setScoresSaveStatus] = useState(null)
  const [pairingsSaving, setPairingsSaving] = useState(false)
  const [pairingsSaveStatus, setPairingsSaveStatus] = useState(null)
  const [membersSaving,  setMembersSaving]  = useState(false)
  const [membersSaveStatus, setMembersSaveStatus] = useState(null)
  const [creditsSaving,  setCreditsSaving]  = useState(false)
  const [creditsSaveStatus, setCreditsSaveStatus] = useState(null)
  const [publishSaving,  setPublishSaving]  = useState(false)
  const [publishSaveStatus, setPublishSaveStatus] = useState(null)

  // pairings manual mode
  const [manualPairings,   setManualPairings]   = useState(false)
  const [selectedUnpaired, setSelectedUnpaired] = useState(null)

  // flight management edit state
  const [flightSearch,  setFlightSearch]  = useState('')
  const [editingMember, setEditingMember] = useState(null)

  // Excel import state
  const [importPreview,  setImportPreview]  = useState(null)   // { matched, unmatched } | null
  const [importSaving,   setImportSaving]   = useState(false)
  const [importStatus,   setImportStatus]   = useState(null)   // null | 'ok' | 'err'
  const [importError,    setImportError]    = useState(null)   // error message | null
  const fileInputRef = useRef(null)

  // Draft-cache to localStorage (unchanged — keeps data across page refreshes)
  useEffect(() => { localStorage.setItem(STORAGE_KEY,  JSON.stringify(data))            }, [data])
  useEffect(() => { localStorage.setItem(PAIRINGS_KEY, JSON.stringify(pairingsData))    }, [pairingsData])
  useEffect(() => { localStorage.setItem(MEMBERS_KEY,  JSON.stringify(membersOverride)) }, [membersOverride])
  useEffect(() => { localStorage.setItem(CREDITS_KEY,  JSON.stringify(credits))         }, [credits])

  const tournament     = schedule.find(t => t.id === tid)
  const nextTournament = schedule.find(t => t.status === 'upcoming') ?? schedule[schedule.length - 1]
  const rawPlayers     = data[tid]?.[flight] ?? []
  const players      = useMemo(() => calcFlightPOY(rawPlayers), [rawPlayers])
  const totalPlayers = FLIGHTS.reduce((sum, f) => sum + (data[tid]?.[f]?.length ?? 0), 0)

  // All names entered for this tournament across all flights
  const allAddedNames = useMemo(() => {
    const names = new Set()
    for (const fl of FLIGHTS) {
      for (const p of (data[tid]?.[fl] ?? [])) names.add(p.name)
    }
    return names
  }, [data, tid])

  // Effective members list (uses overrides for flight/ptm)
  const effectiveMembers = useMemo(() => {
    return membersData.map(m => ({
      ...m,
      flight: membersOverride[m.name]?.flight ?? m.flight,
      ptm:    membersOverride[m.name]?.ptm    ?? m.ptm,
    }))
  }, [membersData, membersOverride])

  const ptmLookup = useMemo(
    () => Object.fromEntries(effectiveMembers.map(m => [m.name, m.ptm])),
    [effectiveMembers]
  )

  // Pool members (not yet in this tournament), grouped by season flight
  const poolMembersGrouped = useMemo(() => {
    const search   = poolSearch.trim().toLowerCase()
    const filtered = effectiveMembers.filter(m =>
      !allAddedNames.has(m.name) &&
      (search === '' || m.name.toLowerCase().includes(search) || formatName(m.name).toLowerCase().includes(search))
    )
    const groups = {}
    for (const f of [...FLIGHTS, null]) {
      const key = f ?? '__unassigned__'
      groups[key] = filtered
        .filter(m => f === null ? m.flight == null : m.flight === f)
        .sort(compareByLastName)
    }
    return groups
  }, [allAddedNames, poolSearch, effectiveMembers])

  const poolTotalCount = useMemo(
    () => Object.values(poolMembersGrouped).reduce((s, g) => s + g.length, 0),
    [poolMembersGrouped]
  )

  // Pairings derived state
  const currentPairings = pairingsData[tid] ?? []
  const pairedNames     = useMemo(
    () => new Set(currentPairings.flatMap(c => c.players.map(p => p.name))),
    [currentPairings]
  )
  const unpairedPlayers = useMemo(
    () => FLIGHTS.flatMap(fl =>
      (data[tid]?.[fl] ?? [])
        .filter(p => !pairedNames.has(p.name))
        .map(p => ({ name: p.name, flight: fl }))
    ),
    [data, tid, pairedNames]
  )

  // credits derived
  const creditRoster = useMemo(() => {
    const search = creditSearch.trim().toLowerCase()
    return membersData
      .filter(m => m.active !== false)
      .filter(m => !search || m.name.toLowerCase().includes(search))
      .slice()
      .sort(compareByLastName)
  }, [membersData, creditSearch])

  const creditTotal = useMemo(
    () => Object.values(credits).reduce((s, v) => s + v, 0),
    [credits]
  )

  const creditNonZero = useMemo(
    () => Object.values(credits).filter(v => v !== 0).length,
    [credits]
  )

  // ── Score data mutations ──────────────────────────────────────────────────────
  function flightSet(newList) {
    setData(prev => ({ ...prev, [tid]: { ...(prev[tid] ?? {}), [flight]: newList } }))
  }

  function addPlayer(name) {
    if (allAddedNames.has(name)) return
    const ptm = ptmLookup[name] ?? ''
    flightSet([...rawPlayers, { name, ptm: ptm !== null && ptm !== undefined ? ptm : '', score: '', eligible: true }])
  }

  function addSelectedPlayers() {
    const toAdd = [...selectedPool].filter(n => !allAddedNames.has(n))
    if (!toAdd.length) return
    flightSet([...rawPlayers, ...toAdd.map(name => ({ name, ptm: '', score: '', eligible: true }))])
    setSelectedPool(new Set())
  }

  function togglePoolSelect(name) {
    setSelectedPool(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  function toggleGroupSelect(members) {
    const names     = members.map(m => m.name)
    const allChosen = names.every(n => selectedPool.has(n))
    setSelectedPool(prev => {
      const next = new Set(prev)
      if (allChosen) names.forEach(n => next.delete(n))
      else           names.forEach(n => next.add(n))
      return next
    })
  }

  function removePlayer(idx) {
    const fl = [...rawPlayers]; fl.splice(idx, 1); flightSet(fl)
  }

  function updatePlayer(idx, field, val) {
    const fl = [...rawPlayers]
    fl[idx]  = { ...fl[idx], [field]: val }
    flightSet(fl)
  }

  function clearFlight() {
    if (!window.confirm(`Clear all players from ${flight}?`)) return
    flightSet([])
  }

  // Move player to a different flight
  function movePlayerToFlight(playerIdx, targetFlight) {
    const player = rawPlayers[playerIdx]
    if (!player) return
    setData(prev => {
      const td = { ...(prev[tid] ?? {}) }
      const srcList = [...(td[flight] ?? [])]
      srcList.splice(playerIdx, 1)
      td[flight] = srcList
      const dstList = [...(td[targetFlight] ?? [])]
      dstList.push({ ...player })
      td[targetFlight] = dstList
      return { ...prev, [tid]: td }
    })
  }

  const flightIdx  = FLIGHTS.indexOf(flight)
  const prevFlight = flightIdx > 0                  ? FLIGHTS[flightIdx - 1] : null
  const nextFlight = flightIdx < FLIGHTS.length - 1 ? FLIGHTS[flightIdx + 1] : null

  // ── Pairings functions ────────────────────────────────────────────────────────
  function generatePairings() {
    const allPlayers = FLIGHTS.flatMap(fl =>
      (data[tid]?.[fl] ?? []).map(p => ({ name: p.name, flight: fl }))
    )
    if (!allPlayers.length) return

    // Distribute players from different flights into each group of 4
    // Strategy: interleave by flight so each group has players from 4 different flights
    const byFlight = {}
    for (const fl of FLIGHTS) {
      const ps = allPlayers.filter(p => p.flight === fl)
      if (ps.length) byFlight[fl] = ps
    }
    const flightQueues = Object.values(byFlight)
    const numGroups    = Math.ceil(allPlayers.length / 4)
    const groups       = Array.from({ length: numGroups }, () => [])

    // Round-robin assignment across flights to maximize flight diversity
    let groupIdx = 0
    let safetyCounter = 0
    const maxIterations = allPlayers.length * 2 + 10

    while (flightQueues.some(q => q.length > 0) && safetyCounter < maxIterations) {
      safetyCounter++
      // Find the non-empty flight queue whose flight is least represented in current group
      const currentGroup = groups[groupIdx]
      const representedFlights = new Set(currentGroup.map(p => p.flight))
      // Prioritize queues not yet in this group
      const candidates = flightQueues.filter(q => q.length > 0 && !representedFlights.has(q[0].flight))
      const pick = candidates.length > 0 ? candidates[0] : flightQueues.find(q => q.length > 0)
      if (!pick) break
      currentGroup.push(pick.shift())
      if (currentGroup.length >= 4) {
        groupIdx++
        if (groupIdx >= numGroups) groupIdx = numGroups - 1
      }
    }

    const newPairings = groups
      .filter(g => g.length > 0)
      .map((ps, i) => ({ pairing: `Pairing ${i + 1}`, players: ps }))
    setPairingsData(prev => ({ ...prev, [tid]: newPairings }))
    setManualPairings(false)
    setSelectedUnpaired(null)
  }

  function startManualPairings() {
    // Initialize with empty groups if none exist
    if (!currentPairings.length) {
      const numGroups = Math.ceil(totalPlayers / 4) || 1
      const empty = Array.from({ length: numGroups }, (_, i) => ({ pairing: `Pairing ${i + 1}`, players: [] }))
      setPairingsData(prev => ({ ...prev, [tid]: empty }))
    }
    setManualPairings(true)
    setSelectedUnpaired(null)
  }

  function addGroupManual() {
    const idx = currentPairings.length + 1
    setPairingsData(prev => ({
      ...prev,
      [tid]: [...(prev[tid] ?? []), { pairing: `Pairing ${idx}`, players: [] }]
    }))
  }

  function removeGroupManual(cardIdx) {
    const updated = currentPairings.map(c => ({ ...c, players: [...c.players] }))
    // Move players back to unpaired (just remove the group)
    updated.splice(cardIdx, 1)
    // Re-label
    updated.forEach((c, i) => { c.pairing = `Pairing ${i + 1}` })
    setPairingsData(prev => ({ ...prev, [tid]: updated }))
  }

  function assignUnpairedToGroup(cardIdx) {
    if (!selectedUnpaired) return
    const player = unpairedPlayers.find(p => p.name === selectedUnpaired)
    if (!player) return
    const updated = currentPairings.map((c, ci) =>
      ci === cardIdx
        ? { ...c, players: [...c.players, { name: player.name, flight: player.flight }] }
        : c
    )
    setPairingsData(prev => ({ ...prev, [tid]: updated }))
    setSelectedUnpaired(null)
  }

  function clearPairings() {
    if (!window.confirm('Clear all pairings for this tournament?')) return
    setPairingsData(prev => ({ ...prev, [tid]: [] }))
    setManualPairings(false)
    setSelectedUnpaired(null)
  }

  function removePairedPlayer(cardIdx, playerIdx) {
    const updated = currentPairings.map((c, ci) =>
      ci === cardIdx
        ? { ...c, players: c.players.filter((_, pi) => pi !== playerIdx) }
        : c
    )
    setPairingsData(prev => ({ ...prev, [tid]: updated }))
  }

  async function savePairings() {
    if (!tournament) return
    await withSaveState(setPairingsSaving, setPairingsSaveStatus, () =>
      DB.savePairings({ ...pairingsData }), setAdminError
    )
  }

  // ── Flight management mutations ───────────────────────────────────────────────
  function updateMemberFlight(name, newFlight) {
    setMembersOverride(prev => ({
      ...prev,
      [name]: { ...(prev[name] ?? {}), flight: newFlight || null }
    }))
  }

  function updateMemberPtm(name, newPtm) {
    setMembersOverride(prev => ({
      ...prev,
      [name]: { ...(prev[name] ?? {}), ptm: newPtm === '' ? null : Number(newPtm) }
    }))
  }

  function updateMemberTee(name, newTee) {
    setMembersOverride(prev => ({
      ...prev,
      [name]: { ...(prev[name] ?? {}), tee: newTee || null }
    }))
  }

  async function saveMembers() {
    const updated = membersData.map(m => ({
      ...m,
      flight: membersOverride[m.name]?.flight ?? m.flight,
      ptm:    membersOverride[m.name]?.ptm    ?? m.ptm,
      tee:    membersOverride[m.name]?.tee    ?? m.tee,
    }))
    await withSaveState(setMembersSaving, setMembersSaveStatus, () =>
      DB.saveMembers(updated), setAdminError
    )
  }

  // ── Credit mutations ──────────────────────────────────────────────────────────
  function applyCredit(name, amount) {
    const n = parseFloat(amount)
    if (isNaN(n) || n === 0) return
    setCredits(prev => ({ ...prev, [name]: +((prev[name] ?? 0) + n).toFixed(2) }))
    setCreditInputs(prev => ({ ...prev, [name]: '' }))
  }

  function clearCredit(name) {
    setCredits(prev => { const next = { ...prev }; delete next[name]; return next })
  }

  function clearAllCredits() {
    if (!window.confirm('Clear ALL credit balances? This cannot be undone.')) return
    setCredits({})
  }

  async function saveCredits() {
    await withSaveState(setCreditsSaving, setCreditsSaveStatus, () =>
      DB.saveCredits(credits), setAdminError
    )
  }

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
        ? [...importPreview.matched, ...importPreview.unmatched.map(r => ({ ...r, memberName: r.rawName }))]
        : importPreview.matched

      // Build updated member list: apply all Excel fields to members
      const overrideMap = {}
      for (const row of rowsToImport) {
        if (row.memberName) {
          overrideMap[row.memberName] = {
            name:              row.memberName,
            ...(row.tee            !== null ? { tee:           row.tee                } : {}),
            ...(row.ptm            !== null ? { ptm:           Number(row.ptm)        } : {}),
            ...(row.flight         !== null ? { flight:        row.flight             } : {}),
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
          flight: membersOverride[m.name]?.flight ?? overrideMap[m.name]?.flight ?? m.flight,
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
    await withSaveState(setScoresSaving, setScoresSaveStatus, () =>
      DB.saveScores(data), setAdminError
    )
  }

  // ── Publish tournament results to Firestore ───────────────────────────────────
  async function doExport() {
    if (!tournament) return
    await withSaveState(setPublishSaving, setPublishSaveStatus, async () => {
      const flightWinners = [], leaderboard = {}
      for (const fl of FLIGHTS) {
        const ps      = calcFlightPOY(data[tid]?.[fl] ?? [])
        const ranked  = [...ps].filter(p => p.rank != null).sort((a, b) => a.rank - b.rank || b.plusMinus - a.plusMinus)
        const allRows = [...ranked, ...ps.filter(p => p.rank == null)]
        leaderboard[fl] = allRows.map(p => ({
          rank: p.rank ?? 0, name: p.name, poy: p.poy ?? 0,
          points: Number(p.score) || 0, ptm: Number(p.ptm) || 0, plusMinus: p.plusMinus ?? 0,
        }))
        if (ranked[0]) flightWinners.push({ flight: fl, winner: ranked[0].name, points: ranked[0].poy ?? 0 })
      }

      const resultDoc = {
        id: tid, name: tournament.name, date: tournament.date, course: tournament.course,
        format: 'Individual Stroke Play', status: 'completed', flightWinners, leaderboard,
      }

      const newPoy = { flights: {} }
      for (const fl of FLIGHTS) {
        const ps = calcFlightPOY(data[tid]?.[fl] ?? [])
        newPoy.flights[fl] = [...ps].sort((a, b) => (b.poy ?? -1) - (a.poy ?? -1))
          .map((p, i) => ({ rank: i + 1, name: p.name, points: p.poy ?? 0, events: 1 }))
      }

      const prevPtmLookup = {}
      for (const fl of FLIGHTS) {
        for (const p of (currentStandings.flights[fl] ?? [])) {
          if (p.ptm != null) prevPtmLookup[p.name] = p.ptm
        }
      }

      const newStandings = { flights: {} }
      for (const fl of FLIGHTS) {
        const ps     = calcFlightPOY(data[tid]?.[fl] ?? [])
        const sorted = [...ps].sort((a, b) => (b.poy ?? -1) - (a.poy ?? -1))
        newStandings.flights[fl] = sorted.map((p, i) => {
          const newPtm   = ptmLookup[p.name] ?? (Number(p.ptm) || null)
          const oldPtm   = prevPtmLookup[p.name] ?? null
          const ptmDelta = (newPtm != null && oldPtm != null) ? +(newPtm - oldPtm).toFixed(2) : 0
          return {
            rank: i + 1, name: p.name, poy: p.poy ?? 0, ptm: newPtm, ptmDelta,
            latestScore: Number(p.score) || null, latestTournament: tournament.name, events: 1, trend: 'up',
          }
        })
      }

      await Promise.all([
        DB.saveResult(tid, resultDoc),
        DB.savePoy(newPoy),
        DB.saveStandings(newStandings),
      ])
    }, setAdminError)
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

      {/* Tournament selector */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <label className="block text-xs font-sans font-semibold uppercase tracking-widest text-forest mb-2">Tournament</label>
        <select
          value={tid}
          onChange={e => { setTid(e.target.value); setFlight(FLIGHTS[0]); setPoolSearch('') }}
          className="border border-gray-300 rounded px-3 py-2 text-sm font-sans w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-forest"
        >
          {schedule.map(t => <option key={t.id} value={t.id}>{t.name} — {t.date}</option>)}
        </select>
        {tournament && (
          <p className="text-xs text-gray-400 font-sans mt-1.5">
            {tournament.course} · {tournament.format} · {totalPlayers} player{totalPlayers !== 1 ? 's' : ''} entered
          </p>
        )}
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          ['scores',   'Score Entry'],
          ['pairings', 'Pairings Builder'],
          ['flights',  'Flight Management'],
          ['credits',  'Credit on Books'],
        ].map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => setAdminMode(mode)}
            className={`px-4 py-2 text-xs font-sans font-semibold rounded-md transition-colors ${
              adminMode === mode
                ? 'bg-forest text-white'
                : 'bg-white text-gray-500 border border-gray-200 hover:text-forest hover:border-forest'
            }`}
          >
            {label}
            {mode === 'credits' && creditNonZero > 0 && (
              <span className="ml-1.5 bg-gold text-forest rounded-full px-1.5 py-0.5 text-[10px] font-bold">{creditNonZero}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          SCORE ENTRY MODE
      ══════════════════════════════════════════════════════════════════════════ */}
      {adminMode === 'scores' && (
        <ScoreEntryPanel
          flights={FLIGHTS}
          flight={flight}
          setFlight={f => { setFlight(f); setPoolSearch('') }}
          data={data}
          tid={tid}
          players={players}
          rawPlayers={rawPlayers}
          poolMembersGrouped={poolMembersGrouped}
          poolTotalCount={poolTotalCount}
          poolSearch={poolSearch}
          setPoolSearch={setPoolSearch}
          addPlayer={addPlayer}
          removePlayer={removePlayer}
          updatePlayer={updatePlayer}
          clearFlight={clearFlight}
          movePlayerToFlight={movePlayerToFlight}
          prevFlight={prevFlight}
          nextFlight={nextFlight}
          fmtPM={fmtPM}
          fmtPOY={fmtPOY}
          doExport={doExport}
          publishSaving={publishSaving}
          publishSaveStatus={publishSaveStatus}
          saveScores={saveScores}
          scoresSaving={scoresSaving}
          scoresSaveStatus={scoresSaveStatus}
          ptmLookup={ptmLookup}
          tournament={tournament}
          totalPlayers={totalPlayers}
          onExportResultsPDF={() => exportResultsPDF(tournament, data[tid] ?? {})}
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
          manualPairings={manualPairings}
          selectedUnpaired={selectedUnpaired}
          setSelectedUnpaired={setSelectedUnpaired}
          generatePairings={generatePairings}
          startManualPairings={startManualPairings}
          addGroupManual={addGroupManual}
          removeGroupManual={removeGroupManual}
          assignUnpairedToGroup={assignUnpairedToGroup}
          clearPairings={clearPairings}
          removePairedPlayer={removePairedPlayer}
          savePairings={savePairings}
          pairingsSaving={pairingsSaving}
          pairingsSaveStatus={pairingsSaveStatus}
          onExportPairingsPDF={() => exportPairingsPDF(tournament, currentPairings)}
          tournament={tournament}
          flightTagStyles={flightTagStyles}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          FLIGHT MANAGEMENT MODE
      ══════════════════════════════════════════════════════════════════════════ */}
      {adminMode === 'flights' && (
        <FlightManagementPanel
          effectiveMembers={effectiveMembers}
          membersData={membersData}
          flightSearch={flightSearch}
          setFlightSearch={setFlightSearch}
          editingMember={editingMember}
          setEditingMember={setEditingMember}
          updateMemberFlight={updateMemberFlight}
          updateMemberPtm={updateMemberPtm}
          updateMemberTee={updateMemberTee}
          saveMembers={saveMembers}
          membersSaving={membersSaving}
          membersSaveStatus={membersSaveStatus}
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
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          CREDIT ON BOOKS MODE
      ════════════════════════════════════════════════════════════════════════ */}
      {adminMode === 'credits' && (
        <div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-48">
              <input
                type="text"
                value={creditSearch}
                onChange={e => setCreditSearch(e.target.value)}
                placeholder="Search members…"
                className="w-full border border-gray-200 rounded px-3 py-2 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-forest"
              />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <div className="text-xs font-sans text-gray-500">
                <span className="font-semibold text-forest">{creditNonZero}</span> with balance ·{' '}
                <span className={`font-semibold stat-number ${creditTotal > 0 ? 'text-green-600' : creditTotal < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                  {creditTotal < 0 ? '−' : ''}${Math.abs(creditTotal).toFixed(2)}
                </span>{' '}
                total
              </div>
              <SaveBtn onClick={saveCredits} saving={creditsSaving} status={creditsSaveStatus} />
              <PdfBtn onClick={() => exportCreditsPDF(credits, membersData)}>
                Export Credits PDF
              </PdfBtn>
              {Object.keys(credits).length > 0 && (
                <button
                  onClick={clearAllCredits}
                  className="px-3 py-1.5 text-xs font-sans rounded border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-forest px-4 py-2.5 flex items-center justify-between">
              <span className="text-white font-sans text-sm font-semibold">Member Credit Balances</span>
              <span className="text-white/50 font-sans text-xs">{creditRoster.length} members</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[540px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="table-header text-gray-400 text-left">Player</th>
                    <th className="table-header text-gray-400 text-left">Flight</th>
                    <th className="table-header text-gray-400 text-right">Balance</th>
                    <th className="table-header text-gray-400 text-center">Add / Subtract</th>
                    <th className="table-header text-gray-400 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {creditRoster.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-400 font-sans text-sm">
                        No members match your search.
                      </td>
                    </tr>
                  ) : (
                    creditRoster.map((m, idx) => {
                      const balance = credits[m.name] ?? 0
                      const input   = creditInputs[m.name] ?? ''
                      return (
                        <tr
                          key={m.name}
                          className={`border-b border-gray-100 last:border-0 transition-colors ${
                            balance !== 0 ? 'hover:bg-amber-50/30' : 'hover:bg-gray-50'
                          } ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                        >
                          <td className="px-4 py-2.5 font-sans text-sm text-darktext whitespace-nowrap">
                            {formatName(m.name)}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`text-xs border px-1.5 py-0.5 rounded-full font-sans whitespace-nowrap ${flightTagStyles[m.flight] ?? flightTagStyles.Unassigned}`}>
                              {m.flight ?? 'Unassigned'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`stat-number text-sm font-bold ${
                              balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-500' : 'text-gray-300'
                            }`}>
                              {balance < 0 ? '−' : ''}${Math.abs(balance).toFixed(2)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="number"
                                step="0.01"
                                value={input}
                                onChange={e => setCreditInputs(prev => ({ ...prev, [m.name]: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && applyCredit(m.name, input)}
                                placeholder="+/− $"
                                className="w-24 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                              />
                              <button
                                onClick={() => applyCredit(m.name, input)}
                                disabled={!input}
                                title="Apply adjustment"
                                className="w-7 h-7 flex items-center justify-center bg-forest text-white rounded text-sm font-bold disabled:opacity-30 hover:bg-forest/80 transition-colors"
                              >
                                ✓
                              </button>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center">
                            {balance !== 0 && (
                              <button
                                onClick={() => clearCredit(m.name)}
                                title="Clear balance"
                                className="text-gray-300 hover:text-red-400 text-xl leading-none transition-colors"
                              >
                                ×
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                {creditNonZero > 0 && (
                  <tfoot>
                    <tr className="bg-forest/5 border-t-2 border-forest/20">
                      <td colSpan={2} className="px-4 py-2.5 font-sans text-xs font-semibold uppercase tracking-widest text-forest">
                        Total on Books
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`stat-number text-sm font-bold ${
                          creditTotal > 0 ? 'text-green-600' : creditTotal < 0 ? 'text-red-500' : 'text-gray-400'
                        }`}>
                          {creditTotal < 0 ? '−' : ''}${Math.abs(creditTotal).toFixed(2)}
                        </span>
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PDF REPORTS  (always visible)
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="mt-6 bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-forest font-sans text-xs font-semibold uppercase tracking-widest mb-1">PDF Reports</h2>
        <p className="text-gray-500 font-sans text-xs mb-4 leading-relaxed">
          Generate printable PDF documents for distribution.
        </p>
        <div className="flex flex-wrap gap-2">
          <PdfBtn onClick={() => exportTournamentInfoPDF(nextTournament)} disabled={!nextTournament}>
            Next Tournament Info
          </PdfBtn>
          <PdfBtn onClick={() => exportTournamentInfoPDF(tournament)} disabled={!tournament}>
            Selected Tournament Info
          </PdfBtn>
          <PdfBtn onClick={() => exportPtmPDF(membersData)}>
            Points to Make (Full Roster)
          </PdfBtn>
          {totalPlayers > 0 && (
            <PdfBtn onClick={() => exportResultsPDF(tournament, data[tid] ?? {})} disabled={!tournament}>
              Tournament Results
            </PdfBtn>
          )}
          {currentPairings.length > 0 && (
            <PdfBtn onClick={() => exportPairingsPDF(tournament, currentPairings)} disabled={!tournament}>
              Pairings
            </PdfBtn>
          )}
          {Object.keys(credits).length > 0 && (
            <PdfBtn onClick={() => exportCreditsPDF(credits, membersData)}>
              Credit on Books
            </PdfBtn>
          )}
        </div>
      </div>
    </PageWrapper>
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
      ) : status === 'ok' ? '✓ Saved' : status === 'err' ? '✗ Error' : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      )}
      {!saving && status !== 'ok' && status !== 'err' && label}
    </button>
  )
}

// ── Score Entry Panel ─────────────────────────────────────────────────────────
function ScoreEntryPanel({
  flights, flight, setFlight, data, tid, players, rawPlayers,
  poolMembersGrouped, poolTotalCount, poolSearch, setPoolSearch,
  addPlayer, removePlayer, updatePlayer, clearFlight, movePlayerToFlight,
  prevFlight, nextFlight, fmtPM, fmtPOY, doExport,
  publishSaving, publishSaveStatus, saveScores, scoresSaving, scoresSaveStatus,
  tournament, totalPlayers, onExportResultsPDF,
}) {
  return (
    <>
      {/* Flight tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {flights.map(f => {
          const cnt = data[tid]?.[f]?.length ?? 0
          return (
            <button key={f} onClick={() => setFlight(f)}
              className={`px-3 py-1.5 text-xs font-sans font-medium rounded transition-colors ${
                flight === f ? 'bg-gold text-forest' : 'bg-white text-gray-500 border border-gray-200 hover:text-forest hover:border-gold'
              }`}
            >
              {f}{cnt > 0 && <span className="ml-1 opacity-60">({cnt})</span>}
            </button>
          )
        })}
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">

        {/* Left: Member pool */}
        <div className="lg:w-72 flex-shrink-0">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-forest px-4 py-2.5">
              <p className="text-white font-sans text-sm font-semibold">Members</p>
              <p className="text-white/50 text-xs font-sans mt-0.5">Tap a name, then tap "Add to Flight"</p>
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
              onAdd={addPlayer}
              currentFlight={flight}
            />
          </div>
        </div>

        {/* Right: Flight panel */}
        <div className="flex-1 min-w-0">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-forest px-4 py-2.5 flex items-center justify-between">
              <span className="text-white font-sans text-sm font-semibold">{flight}</span>
              <div className="flex items-center gap-3">
                <span className="text-gold font-mono text-xs">{rawPlayers.length} players</span>
                {rawPlayers.length > 0 && (
                  <button onClick={clearFlight} className="text-gray-300 hover:text-red-300 text-xs font-sans transition-colors">
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {players.length > 0 ? (
              <div className="overflow-x-auto">
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
                      <th className="table-header text-gray-400 text-center">Move to Flight</th>
                      <th className="table-header text-gray-400 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p, idx) => (
                      <tr
                        key={p.name}
                        className={`border-b border-gray-100 last:border-0 transition-colors hover:bg-blue-50 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                        }`}
                      >
                        {/* Rank */}
                        <td className="px-3 py-2">
                          <span className={`stat-number text-xs font-semibold ${p.rank != null && p.rank <= 3 ? 'text-gold' : 'text-gray-400'}`}>
                            {p.rank ?? '—'}
                          </span>
                        </td>
                        {/* Name */}
                        <td className="px-3 py-2 font-sans text-sm text-darktext whitespace-nowrap">
                          {formatName(p.name)}
                        </td>
                        {/* PTM */}
                        <td className="px-2 py-1.5 text-center">
                          <input type="number" value={p.ptm} onChange={e => updatePlayer(idx, 'ptm', e.target.value)}
                            className="w-14 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                          />
                        </td>
                        {/* Score */}
                        <td className="px-2 py-1.5 text-center">
                          <input type="number" value={p.score} onChange={e => updatePlayer(idx, 'score', e.target.value)}
                            className="w-14 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                          />
                        </td>
                        {/* +/- */}
                        <td className="px-3 py-2 text-center">
                          <span className={`stat-number text-xs font-semibold ${
                            p.plusMinus == null ? 'text-gray-300' : p.plusMinus > 0 ? 'text-green-600' : p.plusMinus < 0 ? 'text-red-500' : 'text-gray-400'
                          }`}>
                            {fmtPM(p.plusMinus)}
                          </span>
                        </td>
                        {/* POY */}
                        <td className="px-3 py-2 text-center">
                          <span className={`stat-number text-xs font-semibold ${
                            p.eligible === false ? 'text-red-400' : p.poy == null ? 'text-gray-300' : 'text-darktext'
                          }`}>
                            {fmtPOY(p)}
                          </span>
                        </td>
                        {/* Eligible */}
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={p.eligible !== false}
                            onChange={e => updatePlayer(idx, 'eligible', e.target.checked)}
                            className="accent-forest cursor-pointer w-4 h-4"
                          />
                        </td>
                        {/* Move to flight */}
                        <td className="px-2 py-1.5 text-center">
                          <MoveToFlightSelect
                            currentFlight={flight}
                            allFlights={flights}
                            prevFlight={prevFlight}
                            nextFlight={nextFlight}
                            onMove={targetFlight => movePlayerToFlight(idx, targetFlight)}
                          />
                        </td>
                        {/* Remove */}
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => removePlayer(idx)}
                            title="Remove player from this tournament"
                            className="text-gray-300 hover:text-red-400 text-xl leading-none transition-colors"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed m-4 rounded-lg border-gray-200">
                <span className="text-3xl mb-2 text-gray-300">⛳</span>
                <p className="text-gray-400 font-sans text-sm">No players added yet.</p>
                <p className="text-gray-400 font-sans text-xs mt-1">Select a player from the list on the left.</p>
              </div>
            )}
          </div>
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
            onClick={doExport}
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
    </>
  )
}

// ── Member Pool (click-to-add) ────────────────────────────────────────────────
function MemberPool({ poolMembersGrouped, poolTotalCount, poolSearch, onAdd, currentFlight }) {
  const [selected, setSelected] = useState(null)

  function handleSelect(name) {
    setSelected(prev => prev === name ? null : name)
  }

  function handleAdd() {
    if (!selected) return
    onAdd(selected)
    setSelected(null)
  }

  return (
    <div>
      {/* Sticky add bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-3 py-2">
        <button
          onClick={handleAdd}
          disabled={!selected}
          className={`w-full py-2 rounded text-xs font-sans font-semibold transition-colors ${
            selected
              ? 'bg-gold text-forest hover:bg-amber-400'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {selected ? `Add ${formatName(selected)} → ${currentFlight}` : 'Select a player below'}
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
              return (
                <div key={key} className="mb-2">
                  <p className="px-1 pt-1 pb-0.5 text-[10px] font-sans font-semibold uppercase tracking-widest text-gray-400">
                    {label}
                  </p>
                  <ul className="space-y-0.5">
                    {group.map(m => (
                      <li
                        key={m.name}
                        onClick={() => handleSelect(m.name)}
                        className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded cursor-pointer border transition-colors select-none ${
                          selected === m.name
                            ? 'bg-gold/20 border-gold text-forest'
                            : 'bg-gray-50 hover:bg-blue-50 hover:border-blue-200 border-transparent'
                        }`}
                      >
                        <span className="font-sans text-xs text-darktext truncate">{formatName(m.name)}</span>
                        {m.ptm != null && (
                          <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">PTM {m.ptm}</span>
                        )}
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

// ── Move to Flight Select ─────────────────────────────────────────────────────
function MoveToFlightSelect({ currentFlight, allFlights, prevFlight, nextFlight, onMove }) {
  const [val, setVal] = useState('')

  const otherFlights = allFlights.filter(f => f !== currentFlight)

  function handleChange(e) {
    const target = e.target.value
    setVal('')
    if (target) onMove(target)
  }

  return (
    <select
      value={val}
      onChange={handleChange}
      className="border border-gray-200 rounded px-1 py-1 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-forest text-gray-500 bg-white min-w-[110px]"
    >
      <option value="">Move to…</option>
      {prevFlight && <option value={prevFlight}>↑ Promote → {prevFlight}</option>}
      {nextFlight && <option value={nextFlight}>↓ Relegate → {nextFlight}</option>}
      <optgroup label="Any flight">
        {otherFlights.map(f => (
          <option key={f} value={f}>{f}</option>
        ))}
      </optgroup>
    </select>
  )
}

// ── Pairings Builder Panel ────────────────────────────────────────────────────
function PairingsPanel({
  totalPlayers, currentPairings, unpairedPlayers, manualPairings,
  selectedUnpaired, setSelectedUnpaired,
  generatePairings, startManualPairings, addGroupManual, removeGroupManual,
  assignUnpairedToGroup, clearPairings, removePairedPlayer, savePairings,
  pairingsSaving, pairingsSaveStatus, onExportPairingsPDF, tournament,
  flightTagStyles,
}) {
  return (
    <div>
      {/* Controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-sans font-semibold text-gray-500 uppercase tracking-widest">Pairings always in groups of 4</span>
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
          {currentPairings.length > 0 && (
            <>
              <SaveBtn onClick={savePairings} saving={pairingsSaving} status={pairingsSaveStatus} label="Save Pairings" />
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

      {/* No players notice */}
      {totalPlayers === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <p className="text-amber-700 font-sans text-sm font-medium mb-1">No players entered yet</p>
          <p className="text-amber-600 font-sans text-xs">Switch to Score Entry to add players to flights first.</p>
        </div>
      )}

      {/* Manual build: unpaired pool */}
      {manualPairings && unpairedPlayers.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <p className="text-xs font-sans font-semibold text-forest uppercase tracking-widest mb-3">
            Unassigned Players — select one, then click a pairing group below
          </p>
          <div className="flex flex-wrap gap-2">
            {unpairedPlayers.map(p => (
              <button
                key={p.name}
                onClick={() => setSelectedUnpaired(prev => prev === p.name ? null : p.name)}
                className={`text-xs border px-3 py-1.5 rounded-full font-sans transition-colors ${
                  selectedUnpaired === p.name
                    ? 'bg-gold border-gold text-forest font-semibold'
                    : (flightTagStyles[p.flight] ?? flightTagStyles.Unassigned)
                }`}
              >
                {formatName(p.name)}
                <span className="ml-1 opacity-60 text-[10px]">{p.flight}</span>
              </button>
            ))}
          </div>
          <button
            onClick={addGroupManual}
            className="mt-3 px-3 py-1.5 text-xs font-sans rounded border border-dashed border-forest text-forest hover:bg-forest/5 transition-colors"
          >
            + Add New Pairing Group
          </button>
        </div>
      )}

      {/* Auto-mode unpaired banner */}
      {!manualPairings && unpairedPlayers.length > 0 && currentPairings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex flex-wrap items-center gap-3">
          <span className="text-amber-700 font-sans text-xs font-semibold uppercase tracking-widest flex-shrink-0">
            Not yet paired ({unpairedPlayers.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {unpairedPlayers.map(p => (
              <span key={p.name} className={`text-xs border px-2 py-0.5 rounded-full font-sans ${flightTagStyles[p.flight] ?? flightTagStyles.Unassigned}`}>
                {formatName(p.name)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {currentPairings.length === 0 && totalPlayers > 0 && (
        <div className="border-2 border-dashed border-gray-200 rounded-lg py-16 flex flex-col items-center justify-center">
          <p className="text-gray-400 font-sans text-sm mb-4">No pairings yet. Choose Auto-Generate or Build Your Own above.</p>
        </div>
      )}

      {/* Pairing cards grid */}
      {currentPairings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {currentPairings.map((card, cardIdx) => (
            <div
              key={cardIdx}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
            >
              <div className="bg-forest px-4 py-2 flex items-center justify-between">
                <span className="text-white font-sans text-xs font-semibold uppercase tracking-widest">
                  {card.pairing}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-white/50 font-mono text-xs">{card.players.length} players</span>
                  {manualPairings && (
                    <button
                      onClick={() => removeGroupManual(cardIdx)}
                      className="text-white/40 hover:text-red-300 text-sm leading-none transition-colors"
                      title="Remove this group"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              <ul className="divide-y divide-gray-100 min-h-[60px]">
                {card.players.map((player, playerIdx) => (
                  <li
                    key={player.name}
                    className="px-3 py-2.5 flex items-center justify-between gap-2"
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
                        className="text-gray-300 hover:text-red-400 text-base leading-none transition-colors ml-0.5"
                        title="Remove from pairing"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
                {card.players.length === 0 && (
                  <li className="px-3 py-4 text-center text-gray-300 font-sans text-xs italic">
                    Empty group
                  </li>
                )}
              </ul>
              {manualPairings && selectedUnpaired && card.players.length < 4 && (
                <div className="border-t border-dashed border-gold/40 p-2">
                  <button
                    onClick={() => assignUnpairedToGroup(cardIdx)}
                    className="w-full py-1.5 text-xs rounded bg-gold/10 text-amber-700 hover:bg-gold/20 font-sans font-semibold transition-colors"
                  >
                    Add {formatName(selectedUnpaired)} here
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {currentPairings.length > 0 && (
        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4">
          <p className="text-blue-700 font-sans text-xs leading-relaxed">
            Hit <strong>Save Pairings</strong> to publish directly to the site. Members will see pairings live immediately.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Flight Management Panel ───────────────────────────────────────────────────
const TEE_OPTIONS = ['Back', 'Senior', 'Front']

function FlightManagementPanel({
  effectiveMembers, membersData, flightSearch, setFlightSearch,
  editingMember, setEditingMember,
  updateMemberFlight, updateMemberPtm, updateMemberTee,
  saveMembers, membersSaving, membersSaveStatus, flightTagStyles,
  fileInputRef, handleXlsxFile, importPreview, setImportPreview,
  confirmImport, importSaving, importStatus, importError, setImportError,
}) {
  const filtered = useMemo(() => {
    const s = flightSearch.trim().toLowerCase()
    return [...effectiveMembers]
      .filter(m => s === '' || m.name.toLowerCase().includes(s) || formatName(m.name).toLowerCase().includes(s))
      .sort(compareByLastName)
  }, [effectiveMembers, flightSearch])

  const FLIGHT_OPTIONS = ['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight']

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
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-sans font-semibold rounded-lg border border-forest text-forest hover:bg-forest hover:text-white transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import Excel
          </button>
          <SaveBtn onClick={saveMembers} saving={membersSaving} status={membersSaveStatus} />
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
                  : 'This will update member info (flight, tee, PTM, contact, credits).'}
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
                  <th className="px-2 py-2 text-center font-semibold">Flight</th>
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
                    <td className="px-2 py-1.5 text-center text-gray-600">{row.flight ?? '—'}</td>
                    <td className="px-2 py-1.5 text-center"><TeeTag tee={row.tee} /></td>
                    <td className="px-2 py-1.5 text-center font-mono text-gray-600">{row.ptm ?? '—'}</td>
                    <td className="px-2 py-1.5 text-center font-mono text-gray-600">{row.creditOnBooks ?? '—'}</td>
                    <td className="px-2 py-1.5 text-center text-gray-500 truncate text-xs">{row.email ?? '—'}</td>
                    <td className="px-2 py-1.5 text-center text-gray-500 truncate text-xs">{row.cellPhone ?? '—'}</td>
                  </tr>
                ))}
                {importPreview.matched.length > 8 && (
                  <tr>
                    <td colSpan={7} className="px-2 py-2 text-center text-amber-600 italic">
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
        <div className="bg-forest px-4 py-3 flex items-center gap-3">
          <span className="text-white font-sans text-sm font-semibold">Player Roster</span>
          <span className="text-white/50 font-mono text-xs">{effectiveMembers.length} members</span>
          <div className="ml-auto">
            <input
              type="text"
              value={flightSearch}
              onChange={e => setFlightSearch(e.target.value)}
              placeholder="Search…"
              className="border border-white/20 rounded px-2 py-1 text-xs font-sans bg-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-gold w-40"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="table-header text-gray-500 text-left">Player</th>
                <th className="table-header text-gray-500 text-left">Flight</th>
                <th className="table-header text-gray-500 text-center">PTM</th>
                <th className="table-header text-gray-500 text-center">Tee</th>
                <th className="table-header text-gray-500 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, idx) => {
                const isEditing = editingMember === m.name
                return (
                  <tr
                    key={m.name}
                    className={`border-b border-gray-100 last:border-0 transition-colors ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                    } ${isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    {/* Name */}
                    <td className="px-4 py-2.5 font-sans text-sm text-darktext whitespace-nowrap">
                      {formatName(m.name)}
                    </td>

                    {/* Flight */}
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <select
                          value={m.flight ?? ''}
                          onChange={e => updateMemberFlight(m.name, e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-forest w-full max-w-[180px]"
                          autoFocus
                        >
                          <option value="">— Unassigned —</option>
                          {FLIGHT_OPTIONS.map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-xs border px-2 py-0.5 rounded-full font-sans ${
                          m.flight ? (flightTagStyles[m.flight] ?? flightTagStyles.Unassigned) : flightTagStyles.Unassigned
                        }`}>
                          {m.flight ?? 'Unassigned'}
                        </span>
                      )}
                    </td>

                    {/* PTM */}
                    <td className="px-4 py-2.5 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          value={m.ptm ?? ''}
                          onChange={e => updateMemberPtm(m.name, e.target.value)}
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-forest"
                        />
                      ) : (
                        <span className="stat-number text-xs text-gray-600">
                          {m.ptm ?? '—'}
                        </span>
                      )}
                    </td>

                    {/* Tee */}
                    <td className="px-4 py-2.5 text-center">
                      {isEditing ? (
                        <select
                          value={m.tee ?? ''}
                          onChange={e => updateMemberTee(m.name, e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-forest"
                        >
                          <option value="">—</option>
                          {TEE_OPTIONS.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      ) : (
                        <TeeTag tee={m.tee} />
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-2 text-center">
                      {isEditing ? (
                        <button
                          onClick={() => setEditingMember(null)}
                          className="px-3 py-1 text-xs rounded bg-forest text-white hover:bg-forest/80 font-sans font-semibold transition-colors"
                        >
                          Done
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditingMember(m.name)}
                          className="px-3 py-1 text-xs rounded border border-gray-200 text-gray-500 hover:text-forest hover:border-forest font-sans transition-colors"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
