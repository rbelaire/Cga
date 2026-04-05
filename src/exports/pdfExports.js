import { createExportPage, ensurePageSpace } from './components/ExportPage'
import { drawStatGrid } from './components/StatGrid'
import { drawSectionCard } from './components/SectionCard'
import { drawDataTable } from './components/DataTable'
import { drawEmptyState } from './components/EmptyState'
import { FLIGHT_CODES, PDF_COLORS } from './utils/constants'
import { formatCurrency, formatDate, formatPTM, formatScore, formatText, formatTrend, formatValue } from './utils/formatters'
import { sanitizeTournamentData } from './utils/sanitize'

function safeFilename(id, suffix) {
  return `${formatText(id, 'tournament').replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${suffix}.pdf`
}

async function loadAssetBase64(url) {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve({
        data: reader.result,
        format: blob.type === 'image/png' ? 'PNG' : 'JPEG',
      })
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function normalizeResultsHeader(text) {
  return formatText(text).replace(/[+\u2212/-]+/g, '+/-')
}

export async function exportTournamentInfoPDF({ tournament, venmoImageUrl, logoUrl }) {
  const clean = sanitizeTournamentData(tournament)
  const logo = await loadAssetBase64(logoUrl)
  const venmo = await loadAssetBase64(venmoImageUrl)
  const { doc, cursorY, withFooter } = createExportPage({
    title: 'Tournament Information',
    subtitle: 'Official Tournament Brief',
    tournamentName: clean.name,
    tournamentDate: clean.date,
    logo,
  })

  const stats = [
    { label: 'Date', value: formatDate(clean.date) },
    { label: 'Course', value: formatValue(clean.course, 'text') || 'Not available' },
    { label: 'Tee Time', value: formatValue(clean.teeTime, 'text') || 'Not available' },
    { label: 'Format', value: formatValue(clean.format, 'text') || 'Not available' },
    { label: 'Entry Fee', value: formatCurrency(clean.entryFee) },
    { label: 'Deadline', value: formatDate(clean.dueDate), highlight: true },
  ]

  let y = drawStatGrid(doc, { stats, startY: cursorY, cols: 2 })

  const notes = formatText(clean.notes, '')
  if (notes) {
    y = drawSectionCard(doc, {
      y,
      title: 'Notes',
      rows: doc.splitTextToSize(notes, 176),
    })
  } else {
    y = drawEmptyState(doc, { message: 'Registration in progress', startY: y })
  }

  if (venmo?.data) {
    y = ensurePageSpace(doc, y, 52)
    const pageW = doc.internal.pageSize.getWidth()
    drawSectionCard(doc, { y, title: 'Payment', rows: ['Scan to pay on Venmo.'], highlight: true })
    const props = doc.getImageProperties(venmo.data)
    const ratio = props.width / props.height
    const h = 40
    const w = h * ratio
    const x = pageW - 14 - w
    doc.addImage(venmo.data, venmo.format, x, y + 4, w, h)
  }

  withFooter('CGA Tournament Information')
  doc.save(safeFilename(clean.id, 'tournament-info'))
}

export async function exportPairingsPDF({ tournament, pairings, logoUrl }) {
  const clean = sanitizeTournamentData({ ...tournament, groups: pairings })
  const logo = await loadAssetBase64(logoUrl)
  const { doc, cursorY, withFooter } = createExportPage({
    title: 'Pairings',
    subtitle: `${clean.course} • ${formatDate(clean.date)}`,
    tournamentName: clean.name,
    tournamentDate: clean.date,
    logo,
  })
  const groups = clean.groups
  const playerCount = groups.reduce((sum, g) => sum + (g.players?.length ?? 0), 0)
  let y = drawSectionCard(doc, {
    y: cursorY,
    title: 'Summary',
    rows: [`${groups.length} groups • ${playerCount} players`],
    highlight: true,
  })

  for (let i = 0; i < groups.length; i += 1) {
    const group = groups[i]
    const lines = (group.players ?? []).map((p, idx) => {
      const code = FLIGHT_CODES[p.flight] ?? FLIGHT_CODES.Unassigned
      const name = formatText(p.name, 'Not available')
      return `${idx + 1}. ${name} [${code}]`
    })
    y = ensurePageSpace(doc, y, 20 + (lines.length * 6))
    y = drawSectionCard(doc, {
      y,
      title: `Group ${i + 1}`,
      rows: lines.length ? lines : ['No players assigned'],
    })
  }

  withFooter('CGA Pairings Sheet')
  doc.save(safeFilename(clean.id, 'pairings'))
}

export async function exportPaymentsPDF({ tournament, paymentMap, members, logoUrl }) {
  const clean = sanitizeTournamentData({ ...tournament, paymentMap, members })
  const logo = await loadAssetBase64(logoUrl)
  const { doc, cursorY, withFooter } = createExportPage({
    title: 'Payment Status',
    subtitle: 'Member Payment Report',
    tournamentName: clean.name,
    tournamentDate: clean.date,
    logo,
  })

  const rows = clean.members
    .filter(m => m.name && m.name !== 'Not available')
    .map(m => ({
      name: m.name,
      paid: Boolean(clean.paymentMap[m.name]),
      method: formatText(clean.paymentMap?.[`${m.name}__method`], ''),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const paidCount = rows.filter(r => r.paid).length
  const total = rows.length
  const unpaidCount = total - paidCount
  const pct = total ? `${Math.round((paidCount / total) * 100)}%` : '0%'

  let y = drawStatGrid(doc, {
    startY: cursorY,
    cols: 4,
    stats: [
      { label: 'Total Players', value: String(total) },
      { label: 'Paid', value: String(paidCount) },
      { label: 'Unpaid', value: String(unpaidCount) },
      { label: 'Paid %', value: pct, highlight: true },
    ],
  })

  y = drawDataTable(doc, {
    startY: y,
    head: ['Name', 'Status', 'Method'],
    body: rows.map(r => [r.name, r.paid ? 'Paid' : 'Unpaid', r.method || '—']),
    columnStyles: {
      0: { cellWidth: 96 },
      1: { halign: 'center', cellWidth: 28, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 48 },
    },
    didParseCell(data) {
      if (data.section !== 'body' || data.column.index !== 1) return
      const paid = rows[data.row.index]?.paid
      data.cell.styles.fillColor = paid ? PDF_COLORS.badgePaidBg : PDF_COLORS.badgeUnpaidBg
      data.cell.styles.textColor = paid ? PDF_COLORS.badgePaidText : PDF_COLORS.badgeUnpaidText
    },
  })

  withFooter('CGA Payment Report')
  doc.save(safeFilename(clean.id, 'payments'))
  return y
}

export async function exportResultsPDF({ tournament, flightData, flights, calcFlightPOY, logoUrl }) {
  const clean = sanitizeTournamentData({ ...tournament })
  const logo = await loadAssetBase64(logoUrl)
  const { doc, cursorY, withFooter } = createExportPage({
    title: 'Results',
    subtitle: `${clean.course} • Finalized Leaderboard`,
    tournamentName: clean.name,
    tournamentDate: clean.date,
    logo,
  })

  const hasScores = flights.some(fl => (flightData?.[fl] ?? []).some(p => p?.score != null && p?.score !== ''))
  let y = cursorY

  if (!hasScores) {
    y = drawEmptyState(doc, { startY: y, message: 'Results pending — scores not yet posted' })
    withFooter('CGA Tournament Results')
    doc.save(safeFilename(clean.id, 'results'))
    return y
  }

  for (const fl of flights) {
    const rows = calcFlightPOY(flightData?.[fl] ?? [])
    if (!rows.length) continue
    y = ensurePageSpace(doc, y, 36)
    y = drawSectionCard(doc, { y, title: fl, rows: [] })

    y = drawDataTable(doc, {
      startY: y - 2,
      head: ['Rank', 'Player', 'PTM', 'Score', normalizeResultsHeader('+/-'), 'POY'],
      body: rows.map(p => [
        formatValue(p.rank, 'number'),
        formatText(p.name, 'Not available'),
        formatPTM(p.ptm),
        formatScore(p.score),
        formatTrend(p.plusMinus),
        p.poy == null ? '—' : String(p.poy),
      ]),
      columnStyles: {
        0: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
        2: { halign: 'center', cellWidth: 16 },
        3: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
        4: { halign: 'center', cellWidth: 16 },
        5: { halign: 'center', cellWidth: 18 },
      },
    })
  }

  withFooter('CGA Tournament Results')
  doc.save(safeFilename(clean.id, 'results'))
  return y
}

export async function exportPtmPDF({ members, flights, logoUrl }) {
  const clean = sanitizeTournamentData({ members })
  const logo = await loadAssetBase64(logoUrl)
  const { doc, cursorY, withFooter } = createExportPage({
    title: 'Points to Make',
    subtitle: 'Season roster grouped by flight',
    tournamentName: 'CGA 2026',
    tournamentDate: new Date().toISOString(),
    logo,
  })

  const grouped = Object.fromEntries(flights.map(f => [f, []]))
  const unassigned = []
  clean.members.filter(m => m.active !== false).forEach(m => {
    if (grouped[m.flight]) grouped[m.flight].push(m)
    else unassigned.push(m)
  })

  let y = cursorY
  const drawGroup = (label, membersInFlight) => {
    if (!membersInFlight.length) return
    y = ensurePageSpace(doc, y, 30)
    y = drawSectionCard(doc, { y, title: label, rows: [] })
    y = drawDataTable(doc, {
      startY: y - 2,
      head: ['Player', 'PTM', 'Tee'],
      body: membersInFlight
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(m => [formatText(m.name, 'Not available'), formatPTM(m.ptm), formatValue(m.tee, 'text') || '—']),
      columnStyles: {
        0: { cellWidth: 120 },
        1: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
        2: { halign: 'center', cellWidth: 22 },
      },
    })
  }

  flights.forEach(fl => drawGroup(fl, grouped[fl]))
  drawGroup('Unassigned', unassigned)

  withFooter('CGA Points to Make')
  doc.save('cga-2026-points-to-make.pdf')
}
