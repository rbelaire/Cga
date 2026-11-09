import { useState } from 'react'
import { DB } from '../db'
import { zeroIneligibleSeasonPoints } from '../domain/publish'
import { buildRoundsByName } from '../utils/poy'
import { parseBeginningPtmXlsx, parseRosterXlsx } from '../exports/xlsxExports'
import { useClub } from './useClub'
import { note } from './note'
import { Confirm, Help, Notice, Panel } from './ui'

const TEES = ['Back', 'Senior', 'Front']

export default function RosterPage() {
  const club = useClub()
  const [message, setMessage] = useState('')
  const [confirm, setConfirm] = useState(null)
  if (!club.ready) return <Notice>Loading the roster…</Notice>
  return (
    <div className="space-y-4">
      <Help>Change a player’s name, tee, points to make, phone, or credit, then save that row. Saves go to the live club record. Removing someone asks you to confirm.</Help>
      {message && <Notice>{message}</Notice>}
      {club.members.length === 0 && <Notice>No players are on the roster yet. Add one below or import a spreadsheet.</Notice>}
      <ul className="space-y-3">
        {club.members.map((member) => (
          <MemberRow key={`${member.name}|${member.ptm}|${member.tee}|${club.credits[member.name] ?? 0}`} member={member} credit={club.credits[member.name] ?? 0} onMessage={setMessage} onRemove={() => setConfirm(member.name)} />
        ))}
      </ul>
      <AddMember onMessage={setMessage} />
      <RosterImport onMessage={setMessage} />
      <Beginning onMessage={setMessage} />
      <Panel title="Season points for new players">
        <Help>Players with fewer than 7 rounds do not earn handicap points. This clears those points on both the public standings and the player-of-the-year record.</Help>
        <button type="button" className="btn-outline" onClick={() => setConfirm('eligibility')}>Clear points for players under 7 rounds</button>
      </Panel>
      {confirm && (
        <Confirm
          title={confirm === 'eligibility' ? 'Clear ineligible season points?' : `Remove ${confirm} from the roster?`}
          body={confirm === 'eligibility' ? 'Public standings and the points record are both updated.' : 'Their past results stay on published leaderboards.'}
          confirmLabel={confirm === 'eligibility' ? 'Clear points' : 'Remove'}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            try {
              if (confirm === 'eligibility') {
                const next = zeroIneligibleSeasonPoints(club.standings, club.poy, buildRoundsByName(club.members))
                await DB.saveStandings(next.standings)
                await DB.savePoy(next.poy)
                await note('Eligibility updated', 'Cleared season points under 7 rounds', club.actor)
                setMessage('Season points were updated on the standings and the points record.')
              } else {
                await DB.saveMembers(club.members.filter((member) => member.name !== confirm))
                const credits = { ...club.credits }
                delete credits[confirm]
                await DB.saveCredits(credits)
                await note('Roster', `Removed ${confirm}`, club.actor)
              }
              setConfirm(null)
            } catch (error) {
              setMessage(error.message)
              setConfirm(null)
            }
          }}
        />
      )}
    </div>
  )
}

function MemberRow({ member, credit, onMessage, onRemove }) {
  const club = useClub()
  const [form, setForm] = useState({
    name: member.name,
    tee: member.tee || 'Back',
    ptm: member.ptm ?? '',
    cell: member.cell || member.homePhone || '',
    active: member.active !== false,
    credit,
  })
  function set(key, value) { setForm({ ...form, [key]: value }) }
  return (
    <li className="bg-white border border-[#E5E0D4] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
      <input value={form.name} onChange={(input) => set('name', input.target.value)} className="rounded border border-[#E5E0D4] px-2 py-1" aria-label="Name" />
      <select value={form.tee} onChange={(input) => set('tee', input.target.value)} className="rounded border border-[#E5E0D4] px-2 py-1" aria-label="Tee">
        {TEES.map((tee) => <option key={tee}>{tee}</option>)}
      </select>
      <input value={form.ptm} onChange={(input) => set('ptm', input.target.value)} className="rounded border border-[#E5E0D4] px-2 py-1" aria-label="Points to make" placeholder="Points to make" />
      <input value={form.cell} onChange={(input) => set('cell', input.target.value)} className="rounded border border-[#E5E0D4] px-2 py-1" aria-label="Phone" placeholder="Phone" />
      <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(input) => set('active', input.target.checked)} /> Active</label>
      <input value={form.credit} onChange={(input) => set('credit', input.target.value)} className="rounded border border-[#E5E0D4] px-2 py-1" aria-label="Credit" placeholder="Credit" />
      <div className="flex gap-2">
        <button type="button" className="btn-primary" onClick={async () => {
          const name = form.name.trim()
          if (!name) return onMessage('A player needs a name.')
          const ptm = form.ptm === '' ? null : Number(form.ptm)
          if (ptm != null && (!Number.isFinite(ptm) || ptm < 0 || ptm > 500)) return onMessage('Points to make must be from 0 to 500.')
          const next = club.members.map((item) => item.name === member.name ? { ...item, name, tee: form.tee, ptm, cell: form.cell, active: form.active } : item)
          if (next.filter((item) => item.name === name).length > 1) return onMessage('That name is already on the roster.')
          await DB.saveMembers(next)
          const credits = { ...club.credits }
          if (member.name !== name) delete credits[member.name]
          const amount = Number(form.credit) || 0
          credits[name] = amount
          await DB.saveCredits(credits)
          if (amount !== credit) {
            await DB.appendCreditTransaction({ id: `${Date.now()}`, ts: Date.now(), name, amount: amount - credit, user: club.actor })
          }
          onMessage(`Saved ${name}.`)
        }}>Save</button>
        <button type="button" className="btn-outline" onClick={onRemove}>Remove</button>
      </div>
    </li>
  )
}

function AddMember({ onMessage }) {
  const club = useClub()
  const [name, setName] = useState('')
  return (
    <Panel title="Add a player">
      <div className="flex flex-wrap gap-2">
        <input value={name} onChange={(input) => setName(input.target.value)} placeholder="First Last" className="rounded border border-[#E5E0D4] px-3 py-2" />
        <button type="button" className="btn-primary" onClick={async () => {
          const trimmed = name.trim()
          if (!trimmed) return
          if (club.members.some((member) => member.name === trimmed)) return onMessage('That player is already on the roster.')
          await DB.saveMembers([...club.members, { name: trimmed, ptm: null, tee: 'Back', rounds: 0, history: [], active: true }])
          setName('')
          onMessage(`Added ${trimmed}.`)
        }}>Add</button>
      </div>
    </Panel>
  )
}

function RosterImport({ onMessage }) {
  const club = useClub()
  return (
    <Panel title="Import a roster spreadsheet">
      <Help>Use the roster sheet with a name column. Matched players update the roster. Unknown rows are listed and not invented as new members unless the roster is empty.</Help>
      <input type="file" accept=".xlsx" onChange={(input) => {
        const file = input.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = async () => {
          try {
            const parsed = parseRosterXlsx(reader.result, club.members)
            const byName = Object.fromEntries(club.members.map((member) => [member.name, member]))
            for (const row of parsed.matched || []) byName[row.name] = { ...byName[row.name], ...row }
            await DB.saveMembers(Object.values(byName))
            onMessage(`Imported ${parsed.matched?.length || 0} players. ${parsed.unmatched?.length || 0} rows did not match.`)
          } catch (error) {
            onMessage(error.message)
          }
        }
        reader.readAsArrayBuffer(file)
      }} />
    </Panel>
  )
}

function Beginning({ onMessage }) {
  const club = useClub()
  return (
    <Panel title="Beginning-of-year points">
      <Help>Most improved compares today’s points to this list. Save the current points, or upload a spreadsheet with a name column and a PTM column.</Help>
      <p className="text-sm mb-2">{club.beginning.length ? `${club.beginning.length} players are in the saved list.` : 'No beginning list is saved yet.'}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-outline" onClick={async () => {
          const list = club.members.filter((member) => member.ptm != null).map((member) => ({ name: member.name, ptm: member.ptm, tee: member.tee || null }))
          await DB.saveBeginningPtm(list)
          onMessage('Saved the current points as the start of the year.')
        }}>Use current points</button>
        <input type="file" accept=".xlsx" onChange={(input) => {
          const file = input.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = async () => {
            try {
              const list = parseBeginningPtmXlsx(reader.result)
              await DB.saveBeginningPtm(list)
              onMessage(`Saved ${list.length} beginning scores.`)
            } catch (error) {
              onMessage(error.message)
            }
          }
          reader.readAsArrayBuffer(file)
        }} />
      </div>
    </Panel>
  )
}
