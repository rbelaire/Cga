import { PDF_COLORS } from '../utils/constants'

export function drawStatGrid(doc, { stats = [], startY = 46, cols = 2 }) {
  const pageW = doc.internal.pageSize.getWidth()
  const cardW = (pageW - 28 - ((cols - 1) * 4)) / cols
  const rowH = 16

  stats.forEach((stat, idx) => {
    const col = idx % cols
    const row = Math.floor(idx / cols)
    const x = 14 + (col * (cardW + 4))
    const y = startY + (row * (rowH + 4))

    doc.setDrawColor(...PDF_COLORS.border)
    doc.setFillColor(...(stat.highlight ? [255, 247, 214] : [255, 255, 255]))
    doc.roundedRect(x, y, cardW, rowH, 1.2, 1.2, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...PDF_COLORS.blue)
    doc.text(stat.label, x + 2.5, y + 5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...PDF_COLORS.primaryText)
    doc.text(stat.value, x + 2.5, y + 11.5)
  })

  return startY + (Math.ceil(stats.length / cols) * (rowH + 4))
}
