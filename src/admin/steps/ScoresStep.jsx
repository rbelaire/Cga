import { useState } from 'react'
import { DB } from '../../db'
import { parseScoreImport } from '../../domain/scores'
import { SCORE_FLIGHTS } from '../../utils/flightOrder'
import { calcFlightPOY } from '../../utils/poy'
import { useClub } from '../useClub'
import { playerRow, playersIn, withPlayer } from '../roster'
import { Help, Notice, Panel } from '../ui'

export default function ScoresStep({ event }) {
  const club = useClub()
  const [message, setMessage] = useState('')
  const tid = event.id
  const stamp = JSON.stringify(club.scores[tid] || {})
  if (!club.ready) return <Notice>Loading scores…</Notice>
  if (!playersIn(club.scores[tid]).length) return <Notice>Enter the field first. You can score players before pairings are posted.</Notice>
  return (
    <>
      {message && <Notice>{message}</Notice>}
      <ScoreForm key={stamp} event={event} initial={club.scores[tid] || {}} onMessage={setMessage} />
    </>
  )
}

function ScoreForm({ event, initial, onMessage }) {
  const club = useClub()
  const [flights, setFlights] = useState(initial)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const present = new Set(playersIn(flights).map((row) => row.name))
  const pool = club.members.filter((member) => member?.name && !present.has(member.name))

  function update(flight, name, patch) {
    setFlights({
      ...flights,
      [flight]: (flights[flight] || []).map((row) => row.name === name ? { ...row, ...patch } : row),
    })
  }

  async function save(next = flights) {
    setBusy(true)
    onMessage('')
    try {
      await DB.saveScores(event.id, next)
      onMessage('Scores saved.')
    } catch (error) {
      onMessage(error.message || 'Scores were not saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Help>Type the Stableford score for each player. WD withdraws them from the results. Save when the card is ready. A player on their 2nd or 3rd round shows at most +2, but the real score is what counts for points.</Help>
      {SCORE_FLIGHTS.map((flight) => {
        const rows = flights[flight] || []
        if (!rows.length) return null
        const ranked = calcFlightPOY(rows.map((row) => ({ ...row, eligible: (row.rounds ?? 0) >= 7 && row.eligible !== false })))
        return (
          <Panel key={flight} title={flight}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="py-1">Player</th><th>PTM</th><th>Score</th><th>+/-</th><th>POY</th><th>WD</th></tr></thead>
                <tbody>
                  {ranked.map((row) => (
                    <tr key={row.name} className="border-t border-[#E5E0D4]">
                      <td className="py-2 pr-2">{row.name}</td>
                      <td className="stat-number">{row.ptm}</td>
                      <td><input inputMode="decimal" value={row.score ?? ''} onChange={(input) => update(flight, row.name, { score: input.target.value })} className="w-20 rounded border border-[#E5E0D4] px-2 py-1" /></td>
                      <td className="stat-number">{row.plusMinus ?? '—'}</td>
                      <td className="stat-number">{row.poy ?? '—'}</td>
                      <td><input type="checkbox" checked={Boolean(row.wd)} onChange={(input) => update(flight, row.name, { wd: input.target.checked })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )
      })}
      <button type="button" className="btn-primary" disabled={busy} onClick={() => save()}>{busy ? 'Saving…' : 'Save scores'}</button>
      {pool.length > 0 && (
        <Panel title="Add a player who was missed">
          <div className="flex flex-wrap gap-2">
            {pool.map((member) => (
              <button key={member.name} type="button" className="btn-outline" onClick={() => {
                const flight = member.ptm ? 'Championship' : 'New Players'
                const next = withPlayer(flights, flight, playerRow(member))
                setFlights(next)
              }}>{member.name}</button>
            ))}
          </div>
        </Panel>
      )}
      <Panel title="Paste scores">
        <Help>Paste rows of name and score, separated by a comma or a tab. Use WD for a withdrawal.</Help>
        <textarea value={text} onChange={(input) => setText(input.target.value)} rows={4} className="w-full rounded-md border border-[#E5E0D4] px-3 py-2" />
        <button type="button" className="btn-outline mt-2" onClick={() => {
          const imported = parseScoreImport(text)
          if (!imported.length) {
            onMessage('No scores were found in that paste.')
            return
          }
          const next = { ...flights }
          for (const row of imported) {
            for (const flight of Object.keys(next)) {
              next[flight] = (next[flight] || []).map((player) => player.name.toLowerCase() === row.name.toLowerCase() ? { ...player, score: row.score, wd: row.wd } : player)
            }
          }
          setFlights(next)
          onMessage('Pasted scores are in the table. Save them to keep them.')
        }}>Apply pasted scores</button>
      </Panel>
    </div>
  )
}
