import { CGA_BRAND_NAME, PDF_COLORS, PDF_LAYOUT, PDF_TYPOGRAPHY } from '../utils/constants'
import { formatDate, formatText } from '../utils/formatters'

export function drawExportHeader(doc, { title, subtitle = '', tournamentName = '', tournamentDate = '', logo = null }) {
  const pageW = doc.internal.pageSize.getWidth()
  doc.setFillColor(...PDF_COLORS.blue)
  doc.rect(0, 0, pageW, PDF_LAYOUT.topHeaderHeight, 'F')

  if (logo?.data) doc.addImage(logo.data, logo.format, 10, 4, 30, 30)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(PDF_TYPOGRAPHY.section)
  doc.setTextColor(255, 255, 255)
  doc.text(CGA_BRAND_NAME, 46, 12)

  doc.setDrawColor(...PDF_COLORS.gold)
  doc.setLineWidth(0.8)
  doc.line(46, 14, pageW - 10, 14)

  doc.setFontSize(PDF_TYPOGRAPHY.title)
  doc.text(formatText(tournamentName || title, 'Tournament Export'), 46, 23)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(PDF_TYPOGRAPHY.body)
  doc.setTextColor(...PDF_COLORS.gold)
  const line = [formatText(subtitle, ''), formatDate(tournamentDate)].filter(Boolean).join(' • ')
  doc.text(line, 46, 30)

  return PDF_LAYOUT.bodyTopY
}
