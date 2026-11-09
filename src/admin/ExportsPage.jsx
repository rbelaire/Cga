import { useState } from 'react'
import scheduleData from '../data/schedule.json'
import venmoImage from '../../cga-pay-venmo.jpg'
import { DB } from '../db'
import { mergeSchedule } from '../domain/schedule'
import { calcFlightPOY } from '../utils/poy'
import { SCORE_FLIGHTS } from '../utils/flightOrder'
import { exportCreditsPDF } from '../exports/creditsPdf'
import { exportFieldRosterPDF, exportPairingsPDF, exportPtmPDF, exportResultsPDF, exportTournamentInfoPDF } from '../exports/pdfExports'
import { exportBirdiePoolXLSX, exportCreditsXLSX, exportPaymentsXLSX, exportPayoutDocXLSX, exportPtmXLSX, exportResultsXLSX } from '../exports/xlsxExports'
import { playersIn } from './roster'
import { useClub } from './useClub'
import { Help, Notice, Panel } from './ui'

const logoUrl = `${import.meta.env.BASE_URL}cga.svg`

export default function ExportsPage() {
  const club = useClub()
  const [tid, setTid] = useState(scheduleData[0]?.id || '')
  const [message, setMessage] = useState('')
  const schedule = mergeSchedule(scheduleData, club.status)
  const event = schedule.find((item) => item.id === tid) || schedule[0]
  const info = { ...event, ...(club.lifecycle[tid]?.info || {}) }
  const flightOf = Object.fromEntries(playersIn(club.scores[tid]).map((row) => [row.name, row.flight]))
  const fieldMembers = club.members.map((member) => ({ ...member, flight: flightOf[member.name] || member.flight || '' }))

  async function run(work, flag) {
    setMessage('')
    try {
      await work()
      if (flag) await DB.saveLifecycle(tid, { ...(club.lifecycle[tid] || {}), [flag]: Date.now() })
      setMessage('Download started.')
    } catch (error) {
      setMessage(error?.message || 'That export failed.')
    }
  }

  if (!club.ready) return <Notice>Loading export data…</Notice>

  return (
    <div className="space-y-4">
      <Help>Downloads use the saved field, scores, and results. Pick the event first. Nothing is published by downloading a file.</Help>
      {message && <Notice>{message}</Notice>}
      <label className="block text-sm">Event
        <select value={event?.id || ''} onChange={(input) => setTid(input.target.value)} className="mt-1 w-full rounded-md border border-[#E5E0D4] px-3 py-2">
          {schedule.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <Panel title="Files for this event">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline" onClick={() => run(() => exportTournamentInfoPDF({ tournament: info, venmoImageUrl: venmoImage, logoUrl }))}>Event sheet (PDF)</button>
          <button type="button" className="btn-outline" onClick={() => run(() => exportPairingsPDF({ tournament: info, pairings: club.pairings[tid] || [], logoUrl }))}>Pairings (PDF)</button>
          <button type="button" className="btn-outline" onClick={() => run(() => exportFieldRosterPDF({ tournament: info, paymentMap: club.payments[tid] || {}, members: fieldMembers, flights: SCORE_FLIGHTS, logoUrl }))}>Field roster (PDF)</button>
          <button type="button" className="btn-outline" onClick={() => run(() => exportPaymentsXLSX(info, club.payments[tid] || {}, fieldMembers))}>Field roster (Excel)</button>
          <button type="button" className="btn-outline" onClick={() => run(() => exportResultsPDF({ tournament: info, flightData: club.scores[tid] || {}, flights: SCORE_FLIGHTS, calcFlightPOY, logoUrl }))}>Results (PDF)</button>
          <button type="button" className="btn-outline" onClick={() => run(() => exportResultsXLSX(info, club.scores[tid] || {}))}>Results (Excel)</button>
          <button type="button" className="btn-outline" onClick={() => run(() => exportBirdiePoolXLSX(info, club.scores[tid] || {}, SCORE_FLIGHTS), 'birdiePoolExportedAt')}>Birdie pool (Excel)</button>
          <button type="button" className="btn-outline" onClick={() => run(() => exportPayoutDocXLSX(info, club.results[tid]), 'payoutGeneratedAt')}>Payout (Excel)</button>
        </div>
      </Panel>
      <Panel title="Club files">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline" onClick={() => run(() => exportPtmPDF({ members: club.members, logoUrl }))}>Points to make (PDF)</button>
          <button type="button" className="btn-outline" onClick={() => run(() => exportPtmXLSX(club.members, club.ptm))}>Points to make (Excel)</button>
          <button type="button" className="btn-outline" onClick={() => run(() => exportCreditsPDF(club.credits, club.members, logoUrl))}>Credits (PDF)</button>
          <button type="button" className="btn-outline" onClick={() => run(() => exportCreditsXLSX(club.credits, club.members))}>Credits (Excel)</button>
        </div>
      </Panel>
    </div>
  )
}
