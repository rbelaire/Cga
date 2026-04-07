import autoTable from 'jspdf-autotable'
import { PDF_COLORS } from '../utils/constants'

export function drawDataTable(doc, {
  head,
  body,
  startY,
  columnStyles = {},
  headFill = PDF_COLORS.blue,
  didParseCell,
  margin: marginOverride = {},
  fontSize = 8,
  cellPadding = 1.8,
  headCellPadding = 2,
}) {
  autoTable(doc, {
    head: [head],
    body,
    startY,
    theme: 'striped',
    headStyles: {
      fillColor: headFill,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize,
      cellPadding: headCellPadding,
    },
    alternateRowStyles: { fillColor: PDF_COLORS.rowAlt },
    styles: {
      fontSize,
      cellPadding,
      overflow: 'linebreak',
      textColor: PDF_COLORS.primaryText,
      lineColor: PDF_COLORS.border,
      lineWidth: 0.1,
    },
    columnStyles,
    margin: { left: 14, right: 14, bottom: 20, ...marginOverride },
    didParseCell,
  })
  return doc.lastAutoTable.finalY + 5
}
