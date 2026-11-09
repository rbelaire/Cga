import { useState } from 'react'
import { DB } from '../../db'
import { buildPublish } from '../../domain/publish'
import { createSnapshotEntry } from '../../services/admin/snapshotService'
import { useClub } from '../useClub'
import { playersIn } from '../roster'
import { note } from '../note'
import { Confirm, Help, Notice, Panel } from '../ui'

export default function PublishStep({ event }) {
  const club = useClub()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const field = playersIn(club.scores[event.id])

  async function publish() {
    setBusy(true)
    setMessage('')
    try {
      const payload = buildPublish({
        tournament: event,
        scoreData: club.scores[event.id],
        standings: club.standings,
        poy: club.poy,
        members: club.members,
        ptmList: club.ptm,
        previousResult: club.results[event.id] || null,
      })
      const snapshot = createSnapshotEntry({
        type: 'pre-publish',
        user: club.actor,
        tournamentId: event.id,
        details: `Before publishing ${event.name}`,
        data: {
          members: club.members,
          standings: club.standings,
          poy: club.poy,
          ptm: club.ptm,
          status: club.status,
          result: club.results[event.id] || null,
        },
      })
      await DB.appendSnapshot(snapshot)
      const status = { ...(club.status || {}), completed: { ...(club.status?.completed || {}), [event.id]: true } }
      await DB.batchPublish({
        tid: event.id,
        resultDoc: payload.resultDoc,
        standings: payload.standings,
        poy: payload.poy,
        members: payload.members,
        ptm: payload.ptm,
        status,
      })
      await note('Results published', event.name, club.actor)
      setMessage('Published. The public pages now include this event, and the season totals kept everyone who did not play. Restore the snapshot from History if you need to undo it.')
      setOpen(false)
    } catch (error) {
      setMessage(error?.message || 'Publish did not finish. Nothing partial is guaranteed; check History before trying again.')
    } finally {
      setBusy(false)
    }
  }

  if (!club.ready) return <Notice>Loading the saved season…</Notice>

  return (
    <div className="space-y-4">
      <Help>Publishing writes the leaderboard, season points, roster points-to-make, and the public points list together. A snapshot is saved first so History can put the season back.</Help>
      {message && <Notice>{message}</Notice>}
      <Panel title="Publish results">
        <p className="text-sm text-gray-600 mb-3">{field.length} players will be included. This does not replace the season with only this event.</p>
        <button type="button" className="btn-primary" disabled={!field.length} onClick={() => setOpen(true)}>Review and publish</button>
      </Panel>
      {open && (
        <Confirm
          title={`Publish ${event.name}?`}
          body="The public site will show these results, and season points will be updated. You can restore the snapshot from History."
          confirmLabel="Publish"
          busy={busy}
          onCancel={() => setOpen(false)}
          onConfirm={publish}
        />
      )}
    </div>
  )
}
