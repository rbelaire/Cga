import { PDF_COLORS } from '../utils/constants'

export function drawSectionCard(doc, { x = 14, y = 46, width, title, rows = [], highlight = false }) {
  const pageW = doc.internal.pageSize.getWidth()
  const cardW = width ?? pageW - 28
  const rowHeight = 6
  const height = 10 + (rows.length * rowHeight)

  doc.setDrawColor(...PDF_COLORS.border)
  doc.setFillColor(...(highlight ? PDF_COLORS.rowAlt : [255, 255, 255]))
  doc.roundedRect(x, y, cardW, height, 1.5, 1.5, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...PDF_COLORS.blue)
  doc.text(title, x + 3, y + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.8)
  doc.setTextColor(...PDF_COLORS.primaryText)
  rows.forEach((row, idx) => {
    doc.text(row, x + 3, y + 10 + (idx * rowHeight))
  })

  return y + height + 4
}
