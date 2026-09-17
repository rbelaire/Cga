import { useState, useMemo } from 'react'
import { DB } from '../../db'

export function RetroEligibilityPanel({ currentPoy, roundsLookup, openConfirm, logChange }) {
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)

  const affected = useMemo(() => {
    const list = []
    for (const fl of Object.keys(currentPoy?.flights ?? {})) {
      for (const p of (currentPoy.flights[fl] ?? [])) {
        const rounds = roundsLookup[p.name] ?? 0
        if (rounds < 7 && (p.points ?? 0) > 0) {
          list.push({ name: p.name, flight: fl, points: p.points, rounds })
        }
      }
    }
    return list
  }, [currentPoy, roundsLookup])

  async function handleApply() {
    const confirmed = await openConfirm(
      `Zero out Handicap POY points for ${affected.length} player(s) with fewer than 7 rounds? This will update the live standings in Firestore.`
    )
    if (!confirmed) return
    setSaving(true)
    setStatus(null)
    try {
      const newFlights = {}
      for (const fl of Object.keys(currentPoy?.flights ?? {})) {
        const rows = (currentPoy.flights[fl] ?? []).map(p => {
          const rounds = roundsLookup[p.name] ?? 0
          return rounds < 7 ? { ...p, points: 0 } : p
        })
        const sorted = [...rows].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
        newFlights[fl] = sorted.map((p, i) => ({ ...p, rank: i + 1 }))
      }
      await DB.savePoy({ flights: newFlights })
      logChange('Retroactive Handicap POY eligibility fix', `${affected.length} players zeroed`)
      setStatus('ok')
    } catch {
      setStatus('err')
    }
    setSaving(false)
    setTimeout(() => setStatus(null), 4000)
  }

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs font-heading font-semibold uppercase tracking-widest text-forest mb-1">Handicap POY Eligibility Fix</p>
      <p className="text-xs font-sans text-gray-500 mb-3">
        Zeros out Handicap POY points for players with fewer than 7 rounds in their PTM history and re-ranks each flight.
        {affected.length > 0
          ? <span className="ml-1 text-amber-600 font-medium">{affected.length} player(s) have points but fewer than 7 rounds.</span>
          : <span className="ml-1 text-green-600 font-medium">All players with points have 7+ rounds.</span>}
      </p>
      {affected.length > 0 && (
        <ul className="mb-3 text-xs font-sans text-gray-600 space-y-0.5 max-h-40 overflow-y-auto border border-gray-100 rounded p-2">
          {affected.map(p => (
            <li key={p.name + p.flight} className="flex gap-2">
              <span className="font-medium text-darktext">{p.name}</span>
              <span className="text-gray-400">{p.flight}</span>
              <span className="ml-auto text-amber-600">{p.points} pts · {p.rounds} rounds</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={handleApply}
          disabled={saving || affected.length === 0}
          className="px-4 py-2 text-sm font-sans font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Applying…' : `Apply Fix (${affected.length} players)`}
        </button>
        {status === 'ok' && <span className="text-xs font-sans text-green-600 font-semibold">Saved</span>}
        {status === 'err' && <span className="text-xs font-sans text-red-500 font-semibold">Save failed</span>}
      </div>
    </section>
  )
}

