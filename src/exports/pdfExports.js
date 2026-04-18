import autoTable from 'jspdf-autotable'
import { createExportPage, ensurePageSpace } from './components/ExportPage'
import { drawStatGrid } from './components/StatGrid'
import { drawSectionCard } from './components/SectionCard'
import { drawDataTable } from './components/DataTable'
import { drawEmptyState } from './components/EmptyState'
import { FLIGHT_CODES, PDF_COLORS, PDF_LAYOUT } from './utils/constants'
import { formatCurrency, formatDate, formatPTM, formatScore, formatText, formatTrend, formatValue } from './utils/formatters'
import { sanitizeTournamentData } from './utils/sanitize'
import { formatName, compareByLastName } from '../utils/formatName'

function safeFilename(id, suffix, name) {
  const idSlug = formatText(id, 'tournament').replace(/[^a-z0-9]/gi, '-').toLowerCase()
  const nameSlug = name ? `-${name.replace(/[^a-z0-9]/gi, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '')}` : ''
  return `${idSlug}${nameSlug}-${suffix}.pdf`
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

export async function exportTournamentInfoPDF({ tournament, venmoImageUrl, logoUrl, onAssetWarning }) {
  const clean = sanitizeTournamentData(tournament)
  const logo = await loadAssetBase64(logoUrl)
  const venmo = await loadAssetBase64(venmoImageUrl)
  if ((!logo && logoUrl) || (!venmo && venmoImageUrl)) {
    onAssetWarning?.('One or more images could not be loaded and will be omitted from the PDF.')
  }
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
  doc.save(safeFilename(clean.id, 'tournament-info', clean.name))
}

// Draw pairings as a compact 3-column card grid
function drawPairingCards(doc, { groups, startY }) {
  const COLS = 3
  const pageW = doc.internal.pageSize.getWidth()
  const ML = 14
  const GAP = 3
  const cardW = (pageW - ML * 2 - GAP * (COLS - 1)) / COLS
  const TITLE_H = 6.5
  const ROW_H = 4.8
  const PAD_B = 2.5

  // Split into rows of COLS
  const rows = []
  for (let i = 0; i < groups.length; i += COLS) rows.push(groups.slice(i, i + COLS))

  let y = startY
  for (const rowGroups of rows) {
    const maxPlayers = Math.max(...rowGroups.map(g => (g.players ?? []).length), 1)
    const cardH = TITLE_H + maxPlayers * ROW_H + PAD_B

    // Page break if needed
    if (y + cardH > PDF_LAYOUT.bottomSafeY) {
      doc.addPage()
      y = PDF_LAYOUT.newPageTopY
    }

    rowGroups.forEach((group, colIdx) => {
      const x = ML + colIdx * (cardW + GAP)
      const players = group.players ?? []
      const thisH = TITLE_H + Math.max(players.length, 1) * ROW_H + PAD_B

      // Card background
      doc.setDrawColor(...PDF_COLORS.border)
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(x, y, cardW, thisH, 1.2, 1.2, 'FD')

      // Title bar (blue, top portion only — square off bottom edge)
      doc.setFillColor(...PDF_COLORS.blue)
      doc.roundedRect(x, y, cardW, TITLE_H, 1.2, 1.2, 'F')
      doc.rect(x, y + TITLE_H / 2, cardW, TITLE_H / 2, 'F')

      // Title text
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(255, 255, 255)
      doc.text(group.pairing ?? `Pairing ${colIdx + 1}`, x + 2.5, y + TITLE_H - 1.2)

      // Players
      if (players.length === 0) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(6.5)
        doc.setTextColor(...PDF_COLORS.mutedText)
        doc.text('No players assigned', x + 2.5, y + TITLE_H + ROW_H * 0.7)
      } else {
        players.forEach((p, pidx) => {
          const code = FLIGHT_CODES[p.flight] ?? FLIGHT_CODES.Unassigned
          const name = formatText(p.name, 'TBD')
          const py = y + TITLE_H + pidx * ROW_H + ROW_H * 0.7
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7)
          doc.setTextColor(...PDF_COLORS.primaryText)
          doc.text(name, x + 2.5, py)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(6.5)
          doc.setTextColor(...PDF_COLORS.mutedText)
          doc.text(`[${code}]`, x + cardW - 2.5, py, { align: 'right' })
        })
      }
    })

    y += cardH + GAP
  }
  return y
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

  drawPairingCards(doc, { groups, startY: y })

  withFooter('CGA Pairings Sheet')
  doc.save(safeFilename(clean.id, 'pairings', clean.name))
}

export async function exportFieldRosterPDF({ tournament, paymentMap, members, flights = [], logoUrl }) {
  const clean = sanitizeTournamentData({ ...tournament, paymentMap, members })
  const logo = await loadAssetBase64(logoUrl)
  const { doc, cursorY, withFooter } = createExportPage({
    title: 'Field Roster',
    subtitle: 'Players by Flight',
    tournamentName: clean.name,
    tournamentDate: clean.date,
    logo,
  })

  const fieldCount = Object.keys(clean.paymentMap).filter(k => !k.includes('__') && clean.paymentMap[k]).length

  let y = drawStatGrid(doc, {
    startY: cursorY,
    cols: 2,
    stats: [
      { label: 'Players in Field', value: String(fieldCount), highlight: true },
      { label: 'Flights', value: String(0) }, // filled below
    ],
  })

  // Build flight groups — only field players, preserving flight order
  const knownFlights = flights.length ? flights : ['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight', 'New Players']
  const grouped = Object.fromEntries(knownFlights.map(f => [f, []]))
  const unassigned = []

  clean.members
    .filter(m => m.name && m.name !== 'Not available' && Boolean(clean.paymentMap[m.name]))
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(m => {
      const entry = { name: m.name, ptm: m.ptm }
      if (grouped[m.flight]) grouped[m.flight].push(entry)
      else unassigned.push(entry)
    })

  const allGroups = [
    ...knownFlights.filter(fl => grouped[fl].length > 0).map(fl => ({ label: fl, names: grouped[fl] })),
    ...(unassigned.length ? [{ label: 'Unassigned', names: unassigned }] : []),
  ]

  // Patch flight count into stat grid now that we know it
  // (re-draw over the placeholder with the correct value)
  const pageW = doc.internal.pageSize.getWidth()
  const cardW = (pageW - 28 - 4) / 2
  doc.setFillColor(255, 255, 255)
  doc.rect(14 + cardW + 4, cursorY, cardW, 20, 'F')
  doc.setDrawColor(...PDF_COLORS.border)
  doc.roundedRect(14 + cardW + 4, cursorY, cardW, 16, 1.2, 1.2, 'D')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...PDF_COLORS.blue)
  doc.text('Flights', 14 + cardW + 4 + 2.5, cursorY + 5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...PDF_COLORS.primaryText)
  doc.text(String(allGroups.length), 14 + cardW + 4 + 2.5, cursorY + 11.5)

  if (allGroups.length === 0) {
    drawEmptyState(doc, { message: 'No players in field for this tournament', startY: y })
    withFooter('CGA Field Roster')
    doc.save(safeFilename(clean.id, 'field-roster', clean.name))
    return
  }

  // ── Flowing 3-column layout with multi-page support ───────────────────────
  // Groups flow left→right across 3 columns; when a column is full a new
  // column starts, and when all 3 are full a new page is added.
  // Fixed readable font sizes — no auto-scaling to tiny text.
  const ML = PDF_LAYOUT.marginX
  const COL_GAP = 4
  const COL_W = (pageW - ML * 2 - COL_GAP * 2) / 3
  const HEADER_H = 7
  const ROW_H = 5
  const F_GAP = 3
  const FONT_HEADER = 7.5
  const FONT_ROW = 7

  let col = 0               // current column index (0–2)
  let pageTopY = y + 2      // top Y for columns on the current page
  let curY = pageTopY       // current drawing cursor within the column

  const colX = (c) => ML + c * (COL_W + COL_GAP)

  for (const group of allGroups) {
    const groupH = HEADER_H + group.names.length * ROW_H + F_GAP

    // If group doesn't fit in current column, advance to the next column/page
    if (curY + groupH > PDF_LAYOUT.bottomSafeY) {
      col++
      if (col >= 3) {
        doc.addPage()
        col = 0
        pageTopY = PDF_LAYOUT.newPageTopY
      }
      curY = pageTopY
    }

    const x = colX(col)

    // Flight header bar
    doc.setFillColor(...PDF_COLORS.blue)
    doc.rect(x, curY, COL_W, HEADER_H, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(FONT_HEADER)
    doc.setTextColor(255, 255, 255)
    doc.text(`${group.label}  (${group.names.length})`, x + 2.5, curY + HEADER_H * 0.72)
    curY += HEADER_H

    // Player rows
    const PTM_W = 12
    const maxNameW = COL_W - PTM_W - 5
    group.names.forEach((player, idx) => {
      doc.setFillColor(...(idx % 2 === 1 ? PDF_COLORS.rowAlt : [255, 255, 255]))
      doc.rect(x, curY, COL_W, ROW_H, 'F')
      doc.setDrawColor(...PDF_COLORS.border)
      doc.setLineWidth(0.1)
      doc.rect(x, curY, COL_W, ROW_H, 'S')

      const rowY = curY + ROW_H * 0.72
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(FONT_ROW)
      doc.setTextColor(...PDF_COLORS.primaryText)
      doc.text(doc.splitTextToSize(player.name, maxNameW)[0], x + 2.5, rowY)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...PDF_COLORS.mutedText)
      doc.text(formatPTM(player.ptm), x + COL_W - 2.5, rowY, { align: 'right' })
      curY += ROW_H
    })

    curY += F_GAP
  }

  withFooter('CGA Field Roster')
  doc.save(safeFilename(clean.id, 'field-roster', clean.name))
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
    doc.save(safeFilename(clean.id, 'results', clean.name))
    return y
  }

  // Column widths sum exactly to pageWidth − marginLeft − marginRight = 187.9mm
  // Rank=14 + Player=80 + PTM=20 + Score=24 + +/-=20 + POY=29.9 = 187.9mm
  const resultsColumnStyles = {
    0: { halign: 'center', cellWidth: 14, fontStyle: 'bold' },
    1: { cellWidth: 80 },
    2: { halign: 'center', cellWidth: 20 },
    3: { halign: 'center', cellWidth: 24, fontStyle: 'bold' },
    4: { halign: 'center', cellWidth: 20 },
    5: { halign: 'center', cellWidth: 29.9 },
  }

  const fmtResultPoy = (p) => {
    if (p.eligible === false) return 'NE'
    if (p.poy == null) return '—'
    return p.poy % 1 === 0 ? String(Math.round(p.poy)) : p.poy.toFixed(1)
  }

  for (const fl of flights) {
    const rows = calcFlightPOY(flightData?.[fl] ?? [])
      .slice()
      .sort((a, b) => {
        if (a.rank == null && b.rank == null) return 0
        if (a.rank == null) return 1
        if (b.rank == null) return -1
        return a.rank - b.rank
      })
    if (!rows.length) continue
    y = ensurePageSpace(doc, y, 24)
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
        fmtResultPoy(p),
      ]),
      columnStyles: resultsColumnStyles,
      fontSize: 7.5,
      cellPadding: 1.3,
      headCellPadding: 1.6,
    })
  }

  withFooter('CGA Tournament Results')
  doc.save(safeFilename(clean.id, 'results', clean.name))
  return y
}

export async function exportPtmPDF({ members, logoUrl }) {
  const clean = sanitizeTournamentData({ members })
  const logo = await loadAssetBase64(logoUrl)

  // Landscape letter: 279.4 × 215.9 mm — wide enough for 10 columns
  const { doc, cursorY, withFooter } = createExportPage({
    title: 'Points to Make',
    subtitle: 'Season roster sorted alphabetically',
    tournamentName: 'CGA 2026',
    tournamentDate: new Date().toISOString(),
    logo,
    orientation: 'landscape',
  })

  const sortedMembers = clean.members
    .filter(m => m.active !== false)
    .slice()
    .sort(compareByLastName)

  // Landscape letter usable width: 279.4 − 14 − 14 = 251.4 mm
  // Player(90) + PTM(15) + Tee(12) + R1-R7(19.2 each = 134.4) = 251.4
  const ROUND_W = 19.2
  const colStyles = {
    0: { cellWidth: 90 },
    1: { halign: 'center', cellWidth: 15, fontStyle: 'bold' },
    2: { halign: 'center', cellWidth: 12 },
    3: { halign: 'center', cellWidth: ROUND_W },
    4: { halign: 'center', cellWidth: ROUND_W },
    5: { halign: 'center', cellWidth: ROUND_W },
    6: { halign: 'center', cellWidth: ROUND_W },
    7: { halign: 'center', cellWidth: ROUND_W },
    8: { halign: 'center', cellWidth: ROUND_W },
    9: { halign: 'center', cellWidth: ROUND_W },
  }

  const ML = PDF_LAYOUT.marginX
  const MR = PDF_LAYOUT.marginX

  autoTable(doc, {
    head: [['Player', 'PTM', 'T', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7']],
    body: sortedMembers.map(m => {
      const hist = Array.isArray(m.history) ? m.history : []
      return [
        formatName(formatText(m.name, 'Not available')),
        formatPTM(m.ptm),
        formatValue(m.tee, 'text') || '—',
        ...Array.from({ length: 7 }, (_, i) => hist[i] != null ? String(hist[i]) : ''),
      ]
    }),
    startY: cursorY,
    theme: 'striped',
    headStyles: { fillColor: PDF_COLORS.blue, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, cellPadding: 1.2 },
    alternateRowStyles: { fillColor: PDF_COLORS.rowAlt },
    styles: { fontSize: 7, cellPadding: 1, overflow: 'linebreak', textColor: PDF_COLORS.primaryText, lineColor: PDF_COLORS.border, lineWidth: 0.1 },
    columnStyles: colStyles,
    margin: { left: ML, right: MR, bottom: 20 },
  })

  withFooter('CGA Points to Make')
  doc.save('cga-2026-points-to-make.pdf')
}
