import jsPDF from 'jspdf'
import { PDF_LAYOUT } from '../utils/constants'
import { drawExportHeader } from './ExportHeader'
import { drawExportFooter } from './ExportFooter'

export function createExportPage({ title, subtitle, tournamentName, tournamentDate, logo, timestamp = true }) {
  const doc = new jsPDF({ unit: PDF_LAYOUT.unit, format: PDF_LAYOUT.pageFormat })
  const y = drawExportHeader(doc, { title, subtitle, tournamentName, tournamentDate, logo })
  return { doc, cursorY: y, withFooter: (footerNote = '') => drawExportFooter(doc, { footerNote, timestamp }) }
}

export function ensurePageSpace(doc, y, neededHeight) {
  if (y + neededHeight <= PDF_LAYOUT.bottomSafeY) return y
  doc.addPage()
  return PDF_LAYOUT.newPageTopY
}
