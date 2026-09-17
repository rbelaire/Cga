import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { loadAssetBase64 } from './utils/loadAsset'
import { compareByLastName } from '../utils/formatName'

const PDF_NAVY = [27, 59, 111]
const PDF_GOLD = [201, 168, 76]

async function buildPdfHeader(doc, title, subtitle = '') {
  const pw   = doc.internal.pageSize.getWidth()
  const logo = await loadAssetBase64(`${import.meta.env.BASE_URL}cga-logo.png`)

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

// ── PDF: Credit on Books ─────────────────────────────────────────────────────
export async function exportCreditsPDF(credits, membersList) {
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
