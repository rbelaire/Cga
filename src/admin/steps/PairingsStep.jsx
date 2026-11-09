import { useState } from 'react'
import { DB } from '../../db'
import { generatePairings, parsePairingsCsv } from '../../domain/pairings'
import { useClub } from '../useClub'
import { playersIn } from '../roster'
import { note, stamp } from '../note'
import { Help, Notice, Panel } from '../ui'

export default function PairingsStep({ event }) {
  const club = useClub()
  const [selected, setSelected] = useState('')
  const [message, setMessage] = useState('')
  const [blankCount, setBlankCount] = useState(4)
  const tid = event.id
  const field = playersIn(club.scores[tid])
  const groups = club.pairings[tid] || []
  const seated = new Set(groups.flatMap((group) => (group.players || []).map((player) => player.name)))
  const waiting = field.filter((player) => !seated.has(player.name))

  async function save(next) {
    setMessage('')
    await DB.savePairings(tid, next, { tournament: event.name, source: 'CGA admin' })
    await DB.saveLifecycle(tid, {
      ...(club.lifecycle[tid] || {}),
      pairingsState: next.length ? 'published' : 'none',
      pairingsPublishedAt: next.length ? stamp() : null,
    })
  }

  function relocate(name, target) {
    const player = field.find((row) => row.name === name) || groups.flatMap((group) => group.players).find((row) => row?.name === name)
    if (!player) return groups
    const cleared = groups.map((group) => ({ ...group, players: (group.players || []).filter((row) => row.name !== name) }))
    if (target == null) return cleared.filter((group) => group.players.length || group.pairing)
    const next = cleared.map((group, index) => index === target && group.players.length < 4
      ? { ...group, players: [...group.players, { name: player.name, flight: player.flight || '' }] }
      : group)
    return next
  }

  if (!club.ready) return <Notice>Loading pairings…</Notice>
  if (!field.length) return <Notice>Enter the field before building pairings. Scores do not have to be in yet.</Notice>

  return (
    <div className="space-y-4">
      <Help>Build groups of up to four. Tap a player, then tap a group. You can also drag a name onto a group. Saving posts the groups on the public pairings page.</Help>
      {message && <Notice>{message}</Notice>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={() => save(generatePairings(field, club.rules)).then(() => note('Pairings posted', event.name, club.actor)).catch((error) => setMessage(error.message))}>Build groups</button>
        <label className="text-sm flex items-center gap-2">Blank groups
          <input type="number" min="1" max="40" value={blankCount} onChange={(input) => setBlankCount(Number(input.target.value) || 1)} className="w-16 rounded-md border border-[#E5E0D4] px-2 py-1" />
        </label>
        <button type="button" className="btn-outline" onClick={() => save(Array.from({ length: blankCount }, (_, index) => ({ pairing: `Pairing ${index + 1}`, players: [] }))).catch((error) => setMessage(error.message))}>Start from blank groups</button>
      </div>
      {waiting.length > 0 && (
        <Panel title="Not in a group yet">
          <div className="flex flex-wrap gap-2">
            {waiting.map((player) => (
              <button key={player.name} type="button" draggable onDragStart={(drag) => drag.dataTransfer.setData('text/plain', player.name)} className={`rounded-full border px-3 py-1 text-sm ${selected === player.name ? 'bg-gold/30 border-gold' : 'border-[#E5E0D4]'}`} onClick={() => setSelected(player.name)}>{player.name}</button>
            ))}
          </div>
        </Panel>
      )}
      {groups.length === 0 ? <Notice>No groups yet. Build them, start from blank groups, or import a spreadsheet.</Notice> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groups.map((group, index) => (
            <div key={`${group.pairing}-${index}`} onDragOver={(drag) => drag.preventDefault()} onDrop={(drag) => {
              const name = drag.dataTransfer.getData('text/plain')
              if (name) save(relocate(name, index)).catch((error) => setMessage(error.message))
            }}>
              <Panel title={group.pairing || `Pairing ${index + 1}`}>
                {(group.players || []).length === 0 && <p className="text-sm text-gray-500">Empty group.</p>}
                <ul>
                  {(group.players || []).map((player) => (
                    <li key={player.name} className="flex items-center justify-between gap-2 text-sm py-1">
                      <button type="button" draggable onDragStart={(drag) => drag.dataTransfer.setData('text/plain', player.name)} className={selected === player.name ? 'font-semibold' : ''} onClick={() => setSelected(player.name)}>{player.name}</button>
                      <button type="button" aria-label={`Remove ${player.name}`} onClick={() => save(relocate(player.name, null)).catch((error) => setMessage(error.message))}>×</button>
                    </li>
                  ))}
                </ul>
                {selected && (group.players || []).length < 4 && <button type="button" className="btn-outline mt-2" onClick={() => save(relocate(selected, index)).then(() => setSelected('')).catch((error) => setMessage(error.message))}>Place {selected} here</button>}
              </Panel>
            </div>
          ))}
        </div>
      )}
      <Rules event={event} />
      <CsvImport field={field} onImport={(next) => save(next).catch((error) => setMessage(error.message))} />
    </div>
  )
}

function Rules() {
  const club = useClub()
  const [type, setType] = useState('always')
  const [picked, setPicked] = useState([])
  const [message, setMessage] = useState('')

  async function addRule() {
    if (picked.length < 2) {
      setMessage('Pick at least two players.')
      return
    }
    await DB.savePairingRules([...(club.rules || []), { id: `${Date.now()}`, type, players: picked }])
    setPicked([])
    setMessage('Rule saved for every event.')
  }

  return (
    <Panel title="Pairing rules">
      <Help>Always-together puts those players in the same group. Never-together keeps them apart when there is room. A rule with fewer than two names is removed.</Help>
      {message && <Notice>{message}</Notice>}
      <ul className="text-sm mb-3 space-y-1">
        {(club.rules || []).map((rule) => (
          <li key={rule.id} className="flex justify-between gap-2">
            <span>{rule.type === 'never' ? 'Never' : 'Always'} together: {(rule.players || []).join(', ')}</span>
            <button type="button" onClick={() => DB.savePairingRules(club.rules.filter((item) => item.id !== rule.id))}>Remove</button>
          </li>
        ))}
        {(club.rules || []).length === 0 && <li className="text-gray-500">No rules yet.</li>}
      </ul>
      <label className="text-sm mr-2">
        <select value={type} onChange={(input) => setType(input.target.value)} className="rounded-md border border-[#E5E0D4] px-2 py-1">
          <option value="always">Always together</option>
          <option value="never">Never together</option>
        </select>
      </label>
      <div className="flex flex-wrap gap-2 my-2">
        {club.members.map((member) => (
          <label key={member.name} className="text-xs flex items-center gap-1">
            <input type="checkbox" checked={picked.includes(member.name)} onChange={(input) => setPicked(input.target.checked ? [...picked, member.name] : picked.filter((name) => name !== member.name))} />
            {member.name}
          </label>
        ))}
      </div>
      <button type="button" className="btn-outline" onClick={() => addRule().catch((error) => setMessage(error.message))}>Save rule</button>
    </Panel>
  )
}

function CsvImport({ field, onImport }) {
  const [message, setMessage] = useState('')
  return (
    <Panel title="Import a spreadsheet">
      <Help>Use a CSV with columns named group and player. Importing replaces the groups on this page. You can still move people afterward.</Help>
      {message && <Notice>{message}</Notice>}
      <input type="file" accept=".csv,.txt" onChange={(input) => {
        const file = input.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
          const known = new Set(field.map((player) => player.name))
          const parsed = parsePairingsCsv(String(reader.result || ''), known)
          if (parsed.error) setMessage(parsed.error)
          else {
            const byName = Object.fromEntries(field.map((player) => [player.name, player]))
            onImport(parsed.pairings.map((group) => ({
              ...group,
              players: group.players.map((player) => ({ name: player.name, flight: byName[player.name]?.flight || '' })),
            })))
            setMessage(parsed.unknown.length ? `${parsed.unknown.length} names are not in this field.` : 'Groups imported.')
          }
        }
        reader.readAsText(file)
      }} />
    </Panel>
  )
}
