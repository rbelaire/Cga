import { createExportPage } from './components/ExportPage'
import { drawDataTable } from './components/DataTable'
import { loadAssetBase64 } from './utils/loadAsset'
import { compareByLastName } from '../utils/formatName'

// ── PDF: Credit on Books ─────────────────────────────────────────────────────
// Uses the shared export layout (createExportPage + drawDataTable) so its
// header/footer/palette match the other CGA PDFs.
export async function exportCreditsPDF(credits, membersList, logoUrl) {
  const logo = await loadAssetBase64(logoUrl)
  const { doc, cursorY, withFooter } = createExportPage({
    title: 'Credit on Books',
    subtitle: 'Member Credit Balances',
    tournamentName: 'CGA 2026',
    tournamentDate: new Date().toISOString(),
    logo,
  })

  const rows = membersList
    .filter(m => m.active !== false)
    .map(m => ({ name: m.name, flight: m.flight ?? 'Unassigned', balance: credits[m.name] ?? 0 }))
    .sort(compareByLastName)
  const nonZeroCount = rows.filter(r => r.balance !== 0).length

  // Column widths sum to the portrait usable width: 110.9 + 47 + 30 = 187.9mm
  drawDataTable(doc, {
    startY: cursorY,
    head: ['Player', 'Flight', 'Balance'],
    body: rows.map(r => [
      r.name,
      r.flight,
      r.balance === 0 ? '$0.00' : `${r.balance < 0 ? '−' : ''}$${Math.abs(r.balance).toFixed(2)}`,
    ]),
    columnStyles: {
      0: { cellWidth: 110.9 },
      1: { cellWidth: 47 },
      2: { halign: 'right', cellWidth: 30 },
    },
    fontSize: 8,
    cellPadding: 1.6,
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

  withFooter(`CGA Credit on Books • ${nonZeroCount} member${nonZeroCount !== 1 ? 's' : ''} with a balance`)
  doc.save('cga-2026-credit-on-books.pdf')
}
