import { useState } from 'react'
import { DB } from '../../db'
import { autoAssignFlights } from '../../domain/flights'
import { FLIGHT_ORDER, NEW_PLAYERS_FLIGHT } from '../../utils/flightOrder'
import { useClub } from '../useClub'
import { playerRow, playersIn } from '../roster'
import { Help, Notice, Panel } from '../ui'

export default function FlightsStep({ event }) {
  const club = useClub()
  const [extraName, setExtraName] = useState('')
  const [selected, setSelected] = useState('')
  const [message, setMessage] = useState('')
  const tid = event.id
  const extra = club.lifecycle[tid]?.extraFlights || []
  const flights = [...FLIGHT_ORDER, ...extra, NEW_PLAYERS_FLIGHT]
  const rows = playersIn(club.scores[tid])

  async function save(nextScores, nextExtra = extra) {
    setMessage('')
    await DB.saveScores(tid, nextScores)
    await DB.saveLifecycle(tid, { ...(club.lifecycle[tid] || {}), extraFlights: nextExtra })
  }

  async function sortFlights() {
    const members = Object.fromEntries(club.members.map((member) => [member.name, member]))
    const players = rows.map((row) => ({ ...row, ptm: members[row.name]?.ptm ?? row.ptm, rounds: members[row.name]?.rounds ?? row.rounds }))
    const groups = autoAssignFlights(players, extra)
    const next = {}
    for (const [flight, list] of Object.entries(groups)) {
      if (!list.length) continue
      next[flight] = list.map((player) => {
        const prev = rows.find((row) => row.name === player.name) || {}
        return { ...playerRow(player), score: prev.score || '', wd: Boolean(prev.wd), eligible: prev.eligible !== false }
      })
    }
    await save(next)
    setMessage('Flights were sorted by points to make. New players stay in their own group.')
  }

  async function moveTo(flight) {
    const player = rows.find((row) => row.name === selected)
    if (!player) return
    const next = {}
    for (const row of rows) {
      const dest = row.name === selected ? flight : row.flight
      const { flight: _flight, ...rest } = row
      next[dest] = [...(next[dest] || []), rest]
    }
    await save(next)
    setSelected('')
  }

  if (!club.ready) return <Notice>Loading flights…</Notice>
  if (!rows.length) return <Notice>Enter the field first. Flights are built from the players you checked.</Notice>

  return (
    <div className="space-y-4">
      <Help>Sort the field by points to make, or move a player: tap their name, then tap the flight. A player with no points to make stays with the new players.</Help>
      {message && <Notice>{message}</Notice>}
      <button type="button" className="btn-primary" onClick={() => sortFlights().catch((error) => setMessage(error.message))}>Sort by points to make</button>
      <div className="flex gap-2">
        <input value={extraName} onChange={(input) => setExtraName(input.target.value)} placeholder="Extra flight name" className="rounded-md border border-[#E5E0D4] px-3 py-2" />
        <button type="button" className="btn-outline" onClick={() => {
          const name = extraName.trim()
          if (!name || flights.includes(name)) return
          setExtraName('')
          save(club.scores[tid] || {}, [...extra, name]).catch((error) => setMessage(error.message))
        }}>Add a flight</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {flights.map((flight) => {
          const list = rows.filter((row) => row.flight === flight)
          return (
            <Panel key={flight} title={`${flight} · ${list.length}`}>
              {list.length === 0 && <p className="text-sm text-gray-500">No players in this flight.</p>}
              <ul className="space-y-1">
                {list.map((row) => (
                  <li key={row.name}>
                    <button type="button" className={`text-sm text-left w-full rounded px-2 py-1 ${selected === row.name ? 'bg-gold/30' : 'hover:bg-cream'}`} onClick={() => setSelected(row.name)}>{row.name}</button>
                  </li>
                ))}
              </ul>
              {selected && <button type="button" className="btn-outline mt-3" onClick={() => moveTo(flight).catch((error) => setMessage(error.message))}>Move {selected} here</button>}
            </Panel>
          )
        })}
      </div>
    </div>
  )
}
