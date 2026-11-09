import { useState } from 'react'
import { DB } from '../../db'
import { useClub } from '../useClub'
import { FIELD_CAP, playerRow, playersIn, withPlayer, withoutPlayer } from '../roster'
import { note } from '../note'
import { Confirm, Help, Notice, Panel } from '../ui'

export default function FieldStep({ event }) {
  const club = useClub()
  const [message, setMessage] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const tid = event.id
  const entered = playersIn(club.scores[tid])
  const paid = club.payments[tid] || {}
  const names = new Set(entered.map((row) => row.name))

  async function run(work) {
    setBusy(true)
    setMessage('')
    try {
      await work()
    } catch (error) {
      setMessage(error?.message || 'That save did not go through.')
    } finally {
      setBusy(false)
    }
  }

  if (!club.ready) return <Notice>Loading the saved field…</Notice>

  return (
    <div className="space-y-4">
      <Help>Check everyone who is playing, then mark who has paid. The field saves as you go. Flights come in the next step. The field holds {FIELD_CAP} players.</Help>
      {message && <Notice>{message}</Notice>}
      <Panel title={`${entered.length} entered · ${Object.keys(paid).length} paid`}>
        {club.members.length === 0 ? <p className="text-sm text-gray-500">The roster is empty. Add players on the Roster page first.</p> : (
          <ul className="divide-y divide-[#E5E0D4]">
            {club.members.filter((member) => member?.name).map((member) => {
              const on = names.has(member.name)
              return (
                <li key={member.name} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={on} disabled={busy} onChange={(input) => run(async () => {
                      if (input.target.checked && entered.length >= FIELD_CAP) {
                        setMessage(`The field is full at ${FIELD_CAP} players.`)
                        return
                      }
                      const next = input.target.checked
                        ? withPlayer(club.scores[tid], member.ptm ? 'Championship' : 'New Players', playerRow(member))
                        : withoutPlayer(club.scores[tid], member.name)
                      await DB.saveScores(tid, next)
                      if (!input.target.checked) {
                        const payments = { ...(club.payments[tid] || {}) }
                        delete payments[member.name]
                        await DB.savePayments(tid, payments)
                      }
                    })} />
                    <span>{member.name} <span className="text-gray-500">· PTM {member.ptm ?? 'new'}</span></span>
                  </label>
                  {on && (
                    <label className="text-sm flex items-center gap-2">
                      <input type="checkbox" checked={Boolean(paid[member.name])} disabled={busy} onChange={(input) => run(() => {
                        const payments = { ...(club.payments[tid] || {}) }
                        if (input.target.checked) payments[member.name] = true
                        else delete payments[member.name]
                        return DB.savePayments(tid, payments)
                      })} />
                      Paid
                      <span className="text-gray-500">Credit ${club.credits[member.name] ?? 0}</span>
                    </label>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 mt-4">
          <button type="button" className="btn-outline" disabled={!entered.length || busy} onClick={() => setConfirm('paid')}>Mark every entered player paid</button>
          <button type="button" className="btn-outline" disabled={busy} onClick={() => run(async () => {
            await DB.saveLifecycle(tid, { ...(club.lifecycle[tid] || {}), fieldFinalizedAt: Date.now() })
            await note('Field finalized', event.name, club.actor)
            setMessage('The field is marked final. You can still add someone if a spot opens.')
          })}>Mark the field final</button>
          <button type="button" className="btn-outline" disabled={busy} onClick={() => run(async () => {
            await DB.saveLifecycle(tid, { ...(club.lifecycle[tid] || {}), memoSentAt: Date.now() })
            setMessage('Memo marked as sent.')
          })}>Note that the memo was sent</button>
          <button type="button" className="btn-outline" disabled={!entered.length || busy} onClick={() => setConfirm('clear')}>Clear the field</button>
        </div>
      </Panel>
      {confirm && (
        <Confirm
          title={confirm === 'clear' ? 'Clear this field?' : 'Mark everyone paid?'}
          body={confirm === 'clear' ? 'This removes the entered players and their paid marks for this event only. The roster stays.' : 'Every player currently entered will be marked paid.'}
          confirmLabel={confirm === 'clear' ? 'Clear field' : 'Mark paid'}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => run(async () => {
            if (confirm === 'clear') {
              await DB.saveScores(tid, {})
              await DB.savePayments(tid, {})
              await note('Field cleared', event.name, club.actor)
            } else {
              await DB.savePayments(tid, Object.fromEntries(entered.map((row) => [row.name, true])))
            }
            setConfirm(null)
          })}
        />
      )}
    </div>
  )
}
