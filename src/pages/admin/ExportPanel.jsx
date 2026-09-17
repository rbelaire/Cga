import { XlsxBtn, PdfBtn } from './ui'

export function ExportPanel({
  tournament, tournamentInfo, totalPlayers, currentPairings, paymentPaidCount, credits,
  onOpenTournamentInfoEditor, onExportPtmPDF, onExportPtmXLSX, onExportResultsPDF, onExportResultsXLSX,
  onExportPairingsPDF, onExportPaymentsPDF, onExportPaymentsXLSX, onExportCreditsPDF, onExportCreditsXLSX,
  onExportBirdiePoolXLSX,
}) {
  const birdieDesc = totalPlayers > 0
    ? <span>Birdie pool sheet with hole columns — <span className="text-forest font-semibold">{totalPlayers} player{totalPlayers !== 1 ? 's' : ''} in field</span></span>
    : 'Birdie pool sheet with hole columns — no field set yet'

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-forest px-4 py-2.5">
        <p className="text-xs font-heading font-semibold uppercase tracking-widest text-white/70">Exports</p>
      </div>
      <div className="divide-y divide-gray-100">
        <ExportRow title="Tournament Info" description="Registration sheet with date, course, entry fee, and Venmo QR"><PdfBtn onClick={onOpenTournamentInfoEditor} disabled={!tournamentInfo}>PDF</PdfBtn></ExportRow>
        <ExportRow title="Points to Make — Full Roster" description="All members grouped by flight with their PTM targets"><PdfBtn onClick={onExportPtmPDF}>PDF</PdfBtn><XlsxBtn onClick={onExportPtmXLSX}>Excel</XlsxBtn></ExportRow>
        <ExportRow title="Tournament Results" description="Per-flight leaderboard with rank, score, +/−, and POY points"><PdfBtn onClick={onExportResultsPDF} disabled={!tournament || totalPlayers === 0}>PDF</PdfBtn><XlsxBtn onClick={onExportResultsXLSX} disabled={!tournament || totalPlayers === 0}>Excel</XlsxBtn></ExportRow>
        <ExportRow title="Birdie Pool" description={birdieDesc}><XlsxBtn onClick={onExportBirdiePoolXLSX} disabled={!tournament || totalPlayers === 0}>Excel</XlsxBtn></ExportRow>
        <ExportRow title="Pairings" description="Tee-time groupings for the round"><PdfBtn onClick={onExportPairingsPDF} disabled={!tournament || currentPairings.length === 0}>PDF</PdfBtn></ExportRow>
        <ExportRow title="Field Roster" description="Players in the field grouped by flight"><PdfBtn onClick={onExportPaymentsPDF} disabled={!tournament || paymentPaidCount === 0}>PDF</PdfBtn><XlsxBtn onClick={onExportPaymentsXLSX} disabled={!tournament || paymentPaidCount === 0}>Excel</XlsxBtn></ExportRow>
        <ExportRow title="Credit on Books" description="Member credit balances by flight"><PdfBtn onClick={onExportCreditsPDF} disabled={Object.keys(credits).length === 0}>PDF</PdfBtn><XlsxBtn onClick={onExportCreditsXLSX} disabled={Object.keys(credits).length === 0}>Excel</XlsxBtn></ExportRow>
      </div>
    </div>
  )
}

export function ExportRow({ title, description, children }) {
  return (
    <div className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-700 font-sans">{title}</p>
        <p className="text-[11px] text-gray-400 font-sans">{description}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

