import { PDF_COLORS } from '../utils/constants'

export function drawEmptyState(doc, { message, startY, height = 24 }) {
  const pageW = doc.internal.pageSize.getWidth()
  doc.setDrawColor(...PDF_COLORS.border)
  doc.setFillColor(251, 252, 254)
  doc.roundedRect(14, startY, pageW - 28, height, 1.5, 1.5, 'FD')

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.setTextColor(...PDF_COLORS.mutedText)
  doc.text(message, pageW / 2, startY + (height / 2) + 1.5, { align: 'center' })

  return startY + height + 6
}
