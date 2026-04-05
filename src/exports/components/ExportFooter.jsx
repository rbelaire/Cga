import { PDF_COLORS } from '../utils/constants'

export function drawExportFooter(doc, { footerNote = '', timestamp = true } = {}) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const total = doc.internal.getNumberOfPages()
  const generated = timestamp ? `Generated ${new Date().toLocaleString()}` : ''

  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i)
    doc.setDrawColor(...PDF_COLORS.gold)
    doc.setLineWidth(0.4)
    doc.line(14, pageH - 15, pageW - 14, pageH - 15)
    doc.setTextColor(...PDF_COLORS.mutedText)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    const left = [footerNote, generated].filter(Boolean).join(' • ')
    doc.text(left, 14, pageH - 10)
    doc.text(`Page ${i} of ${total}`, pageW - 14, pageH - 10, { align: 'right' })
  }
}
