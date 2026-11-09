import { useEffect, useMemo, useState } from 'react'
import { DB } from '../db'
import { useSubscription } from '../hooks/useSubscription'
import { buildMostImproved } from '../domain/improved'
import { computeScratch } from '../utils/computeScratch'
import { FLIGHT_ORDER } from '../utils/flightOrder'
import { formatName } from '../utils/formatName'
import PageWrapper from '../components/layout/PageWrapper'
import Empty from '../components/ui/Empty'

const TABS = [
  ['hdcp', 'Handicap'],
  ['scratch', 'Scratch'],
  ['ptm', 'Points to make'],
  ['improved', 'Most improved'],
]

function Delta({ value }) {
  if (value == null || value === 0) return null
  const up = value > 0
  return <span className={`stat-number text-xs ${up ? 'text-red-700' : 'text-green-700'}`}>{up ? '↑' : '↓'} {Math.abs(Math.round(value))}</span>
}

export default function Standings() {
  useEffect(() => { document.title = 'Standings | CGA 2026' }, [])
  const [tab, setTab] = useState('hdcp')
  const standings = useSubscription(DB.listenStandings, [])
  const ptm = useSubscription(DB.listenPtm, [])
  const beginning = useSubscription(DB.listenBeginningPtm, [])
  const results = useSubscription(DB.listenResults, [])
  const scratch = useMemo(() => computeScratch(results || {}), [results])
  const improved = useMemo(() => buildMostImproved(ptm || [], beginning || [], results || {}), [ptm, beginning, results])
  const qualified = improved.filter((row) => row.qualified && row.delta != null)
  const leader = [...qualified].sort((a, b) => b.delta - a.delta)[0]

  return (
    <PageWrapper>
      <h1 className="section-title">Standings</h1>
      <div className="gold-divider" />
      <div className="flex gap-2 overflow-x-auto mb-6">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`px-3 py-2 rounded-md text-sm font-heading font-semibold whitespace-nowrap ${tab === key ? 'bg-forest text-white' : 'bg-white border border-[#E5E0D4]'}`}>{label}</button>
        ))}
      </div>

      {tab === 'hdcp' && (
        <div className="space-y-6">
          {FLIGHT_ORDER.every((flight) => !(standings?.flights?.[flight] || []).length) && <Empty title="Handicap standings are not posted yet." />}
          {FLIGHT_ORDER.map((flight) => {
            const rows = standings?.flights?.[flight] || []
            if (!rows.length) return null
            return (
              <section key={flight}>
                <h2 className="font-heading font-bold text-forest mb-2">{flight}</h2>
                <div className="overflow-x-auto bg-white border border-[#E5E0D4] rounded-xl">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="px-3 py-2">#</th><th className="px-3 py-2">Player</th><th className="px-3 py-2">Points</th><th className="px-3 py-2">Events</th><th className="px-3 py-2">PTM</th></tr></thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.name} className="border-t border-[#E5E0D4]">
                          <td className="px-3 py-2 stat-number">{row.rank}</td>
                          <td className="px-3 py-2">{formatName(row.name)}</td>
                          <td className="px-3 py-2 stat-number">{row.poy}</td>
                          <td className="px-3 py-2 stat-number">{row.events}</td>
                          <td className="px-3 py-2"><span className="stat-number">{row.ptm ?? '—'}</span> <Delta value={row.ptmDelta} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })}
        </div>
      )}

      {tab === 'scratch' && (
        scratch.length === 0 ? <Empty title="Scratch standings appear after a result is published." /> : (
          <div className="overflow-x-auto bg-white border border-[#E5E0D4] rounded-xl">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="px-3 py-2">#</th><th className="px-3 py-2">Player</th><th className="px-3 py-2">Points</th><th className="px-3 py-2">Events</th></tr></thead>
              <tbody>
                {scratch.map((row) => (
                  <tr key={row.name} className="border-t border-[#E5E0D4]">
                    <td className="px-3 py-2 stat-number">{row.rank}</td>
                    <td className="px-3 py-2">{formatName(row.name)}</td>
                    <td className="px-3 py-2 stat-number">{row.scratchPts}</td>
                    <td className="px-3 py-2 stat-number">{row.events}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'ptm' && (
        !(ptm || []).length ? <Empty title="The points-to-make list is empty." /> : (
          <div>
            <p className="text-sm text-gray-500 mb-3">Showing {(ptm || []).length} players. The last seven scores are the ones that count.</p>
            <div className="overflow-x-auto bg-white border border-[#E5E0D4] rounded-xl">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="px-3 py-2">Player</th><th className="px-3 py-2">Tee</th><th className="px-3 py-2">PTM</th><th className="px-3 py-2">Recent scores</th></tr></thead>
                <tbody>
                  {(ptm || []).map((row) => (
                    <tr key={row.name} className="border-t border-[#E5E0D4]">
                      <td className="px-3 py-2">{formatName(row.name)}</td>
                      <td className="px-3 py-2">{row.tee || '—'}</td>
                      <td className="px-3 py-2 stat-number">{row.ptm ?? '—'}</td>
                      <td className="px-3 py-2 stat-number text-gray-600">{(row.history || []).slice(0, 7).join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {tab === 'improved' && (
        <div className="space-y-6">
          <p className="text-sm text-gray-600">A player qualifies with 7 rounds overall and 3 rounds this year. A higher points-to-make number is an improvement. Players who do not qualify are marked NQ.</p>
          {!improved.length ? <Empty title="Most improved needs a beginning-of-year points list.">A board member can save that list from the roster page.</Empty> : (
            <>
              <ImprovedTable title="Most improved" rows={[...improved].sort((a, b) => (b.delta ?? -999) - (a.delta ?? -999))} leader={leader?.name} />
              <ImprovedTable title="Least improved" rows={[...improved].sort((a, b) => (a.delta ?? 999) - (b.delta ?? 999))} leader={null} />
            </>
          )}
        </div>
      )}
    </PageWrapper>
  )
}

function ImprovedTable({ title, rows, leader }) {
  return (
    <section>
      <h2 className="font-heading font-bold text-forest mb-2">{title}</h2>
      <div className="overflow-x-auto bg-white border border-[#E5E0D4] rounded-xl">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="px-3 py-2">Player</th><th className="px-3 py-2">Start</th><th className="px-3 py-2">Now</th><th className="px-3 py-2">Change</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className={`border-t border-[#E5E0D4] ${row.qualified ? '' : 'bg-amber-50'}`}>
                <td className="px-3 py-2">{formatName(row.name)} {row.name === leader && <span className="ml-2 text-xs font-heading font-semibold text-gold">Leader</span>} {!row.qualified && <span className="ml-2 text-xs font-heading font-semibold text-amber-800">NQ</span>}</td>
                <td className="px-3 py-2 stat-number">{row.start ?? '—'}</td>
                <td className="px-3 py-2 stat-number">{row.current ?? '—'}</td>
                <td className="px-3 py-2 stat-number">{row.delta == null ? '—' : row.delta > 0 ? `+${row.delta}` : row.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
