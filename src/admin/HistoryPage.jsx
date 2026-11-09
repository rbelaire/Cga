import { useState } from 'react'
import { DB } from '../db'
import { getSnapshotLabel } from '../services/admin/snapshotService'
import { useClub } from './useClub'
import { note } from './note'
import { Confirm, Help, Notice } from './ui'

export default function HistoryPage() {
  const club = useClub()
  const [pick, setPick] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  if (!club.ready) return <Notice>Loading history…</Notice>

  async function restore() {
    const data = pick?.data || {}
    setBusy(true)
    try {
      if (Array.isArray(data.members)) await DB.saveMembers(data.members)
      if (data.standings) await DB.saveStandings(data.standings)
      if (data.poy) await DB.savePoy(data.poy)
      if (Array.isArray(data.ptm)) await DB.savePtm(data.ptm)
      if (data.credits && typeof data.credits === 'object') await DB.saveCredits(data.credits)
      if (data.status) await DB.saveTournamentStatus(data.status)
      if (pick.tid && data.result) await DB.saveResult(pick.tid, data.result)
      if (pick.tid && data.scores) await DB.saveScores(pick.tid, data.scores)
      if (pick.tid && data.payments) await DB.savePayments(pick.tid, data.payments)
      if (pick.tid && Array.isArray(data.pairings)) await DB.savePairings(pick.tid, data.pairings, { tournament: pick.details || '' })
      await note('Restored a snapshot', getSnapshotLabel(pick), club.actor)
      setMessage('Restored. Public pages will catch up in a moment.')
      setPick(null)
    } catch (error) {
      setMessage(error.message || 'Restore did not finish.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <Help>Snapshots are taken before a publish. Restoring puts the roster, season points, and that event’s result back. The change log is the list of saves.</Help>
      {message && <Notice>{message}</Notice>}
      <section>
        <h2 className="font-heading font-bold text-forest mb-2">Snapshots</h2>
        {club.snapshots.length === 0 ? <Notice>No snapshots yet. Publishing an event creates one.</Notice> : (
          <ul className="space-y-2">
            {club.snapshots.map((entry) => (
              <li key={entry._id || entry.id} className="bg-white border border-[#E5E0D4] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="text-sm">{getSnapshotLabel(entry)} · {entry.details}</span>
                <button type="button" className="btn-outline" onClick={() => setPick(entry)}>Restore</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="font-heading font-bold text-forest mb-2">Change log</h2>
        {club.changelog.length === 0 ? <Notice>No changes have been logged.</Notice> : (
          <ul className="bg-white border border-[#E5E0D4] rounded-xl divide-y divide-[#E5E0D4]">
            {club.changelog.slice(0, 100).map((entry) => (
              <li key={entry.id || `${entry.ts}-${entry.action}`} className="px-4 py-3 text-sm">
                <span className="font-semibold">{entry.action}</span>
                <span className="text-gray-500"> · {entry.details} · {entry.user} · {entry.ts ? new Date(entry.ts).toLocaleString() : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {pick && (
        <Confirm title="Restore this snapshot?" body="This overwrites the current roster and season points with the saved copy." confirmLabel="Restore" busy={busy} onCancel={() => setPick(null)} onConfirm={restore} />
      )}
    </div>
  )
}
