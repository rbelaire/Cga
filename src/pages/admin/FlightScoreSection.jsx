import { useRef } from 'react'
import { formatName } from '../../utils/formatName'

export function FlightScoreSection({ flightName, players, rawPlayers, onRemove, onUpdate, onClear, onRemoveFlight, fmtPM, fmtPOY }) {
  const scoreInputRefs = useRef({ mobile: [], desktop: [] })

  const setScoreInputRef = (layout, idx, el) => {
    scoreInputRefs.current[layout][idx] = el
  }

  const focusScoreAt = (idx) => {
    const mobileTarget = scoreInputRefs.current.mobile[idx]
    const desktopTarget = scoreInputRefs.current.desktop[idx]
    const target = [mobileTarget, desktopTarget].find(el => el && el.offsetParent !== null) || mobileTarget || desktopTarget
    if (!target) return
    target.focus()
    target.select?.()
  }

  const handleScoreInputKeyDown = (e, idx) => {
    const { key, shiftKey } = e
    if (key === 'ArrowDown' || key === 'Enter') { e.preventDefault(); focusScoreAt(idx + 1); return }
    if (key === 'ArrowUp') { e.preventDefault(); focusScoreAt(Math.max(0, idx - 1)); return }
    if (key === 'Tab') { e.preventDefault(); focusScoreAt(shiftKey ? Math.max(0, idx - 1) : idx + 1) }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-forest px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white font-sans text-sm font-semibold">{flightName}</span>
          {flightName === 'New Players' && (
            <span className="text-xs font-sans px-2 py-0.5 rounded bg-teal-400/30 text-teal-200 border border-teal-400/40">
              scores logged — not published to standings
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gold font-mono text-xs">{rawPlayers.length} players</span>
          {rawPlayers.length > 0 && (
            <button onClick={onClear} className="text-gray-300 hover:text-red-300 text-xs font-sans transition-colors">
              Clear All
            </button>
          )}
          {onRemoveFlight && (
            <button onClick={onRemoveFlight} className="text-gray-300 hover:text-red-300 text-xs font-sans transition-colors">
              Remove Flight
            </button>
          )}
        </div>
      </div>

      {players.length > 0 ? (
        <div>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-2 p-2">
            {players.map((p, idx) => (
              <div key={p.name} className={`border rounded-lg p-3 ${p.wd ? 'border-orange-200 bg-orange-50/40 opacity-60' : `border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-sans text-sm font-semibold text-darktext truncate">{formatName(p.name)}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`stat-number text-xs font-semibold ${p.rank != null && p.rank <= 3 ? 'text-gold' : 'text-gray-400'}`}>
                        {p.wd ? 'WD' : `Rank ${p.rank ?? '—'}`}
                      </span>
                      {!p.wd && (
                        <span className={`stat-number text-xs font-semibold ${
                          p.plusMinus == null ? 'text-gray-300' : p.plusMinus > 0 ? 'text-green-600' : p.plusMinus < 0 ? 'text-red-500' : 'text-gray-400'
                        }`}>
                          {fmtPM(p.plusMinus)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdate(idx, 'wd', !p.wd)}
                      title={p.wd ? 'Undo withdrawal' : 'Mark as withdrew'}
                      className={`text-xs font-sans font-semibold px-1.5 py-0.5 rounded border transition-colors ${
                        p.wd
                          ? 'text-orange-600 border-orange-300 bg-orange-100'
                          : 'text-gray-300 border-gray-200 hover:text-orange-500 hover:border-orange-300'
                      }`}
                    >
                      WD
                    </button>
                    <button onClick={() => onRemove(idx)} title="Remove player"
                      className="text-gray-300 hover:text-red-400 text-xl leading-none transition-colors px-1">×</button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[11px] font-sans text-gray-400">PTM</span>
                    <input type="number" inputMode="numeric" value={p.ptm}
                      onChange={e => onUpdate(idx, 'ptm', e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded px-2 py-2 text-sm font-mono text-center focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-sans text-gray-400">Score</span>
                    {p.wd ? (
                      <div className="mt-1 w-full border border-orange-200 rounded px-2 py-2 text-sm font-mono text-center bg-orange-50 text-orange-500 font-semibold">WD</div>
                    ) : (
                      <input
                        ref={el => setScoreInputRef('mobile', idx, el)}
                        type="number" inputMode="numeric" value={p.score}
                        onChange={e => onUpdate(idx, 'score', e.target.value)}
                        onKeyDown={e => handleScoreInputKeyDown(e, idx)}
                        aria-label={`Score for ${formatName(p.name)}`}
                        className="mt-1 w-full border border-gray-200 rounded px-2 py-2 text-sm font-mono text-center focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                      />
                    )}
                  </label>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className={`stat-number text-xs font-semibold ${
                    p.wd ? 'text-orange-400' : p.eligible === false ? 'text-red-400' : p.poy == null ? 'text-gray-300' : 'text-darktext'
                  }`}>
                    POY: {fmtPOY(p)}
                  </span>
                  <span className={`text-xs font-sans ${p.wd || p.eligible === false ? 'text-gray-300' : 'text-gray-400'}`}>
                    <input type="checkbox" checked={!p.wd && p.eligible !== false}
                      readOnly
                      className="accent-forest w-4 h-4 mr-1 pointer-events-none"
                    />
                    Elig.
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="table-header text-gray-400 text-left">Rank</th>
                  <th className="table-header text-gray-400 text-left">Player</th>
                  <th className="table-header text-gray-400 text-center">PTM</th>
                  <th className="table-header text-gray-400 text-center">Score</th>
                  <th className="table-header text-gray-400 text-center">+/-</th>
                  <th className="table-header text-gray-400 text-center">POY</th>
                  <th className="table-header text-gray-400 text-center">Elig.</th>
                  <th className="table-header text-gray-400 text-center">WD</th>
                  <th className="table-header text-gray-400 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, idx) => (
                  <tr key={p.name} className={`border-b border-gray-100 last:border-0 transition-colors ${p.wd ? 'bg-orange-50/40 opacity-60' : `hover:bg-blue-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}`}>
                    <td className="px-3 py-2">
                      <span className={`stat-number text-xs font-semibold ${p.rank != null && p.rank <= 3 ? 'text-gold' : 'text-gray-400'}`}>
                        {p.wd ? '—' : (p.rank ?? '—')}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-sans text-sm text-darktext whitespace-nowrap">{formatName(p.name)}</td>
                    <td className="px-2 py-1.5 text-center">
                      <input type="number" value={p.ptm} onChange={e => onUpdate(idx, 'ptm', e.target.value)}
                        className="w-14 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {p.wd ? (
                        <span className="inline-block w-14 px-2 py-1 text-xs font-mono font-semibold text-orange-600 bg-orange-100 border border-orange-200 rounded text-center">WD</span>
                      ) : (
                        <input
                          ref={el => setScoreInputRef('desktop', idx, el)}
                          type="number" inputMode="numeric" value={p.score}
                          onChange={e => onUpdate(idx, 'score', e.target.value)}
                          onKeyDown={e => handleScoreInputKeyDown(e, idx)}
                          aria-label={`Score for ${formatName(p.name)}`}
                          className="w-14 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`stat-number text-xs font-semibold ${
                        p.plusMinus == null ? 'text-gray-300' : p.plusMinus > 0 ? 'text-green-600' : p.plusMinus < 0 ? 'text-red-500' : 'text-gray-400'
                      }`}>
                        {p.wd ? '—' : fmtPM(p.plusMinus)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`stat-number text-xs font-semibold ${
                        p.wd ? 'text-orange-400' : p.eligible === false ? 'text-red-400' : p.poy == null ? 'text-gray-300' : 'text-darktext'
                      }`}>
                        {fmtPOY(p)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={!p.wd && p.eligible !== false}
                        readOnly
                        className="accent-forest w-4 h-4 pointer-events-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => onUpdate(idx, 'wd', !p.wd)}
                        title={p.wd ? 'Undo withdrawal' : 'Mark as withdrew'}
                        className={`text-xs font-sans font-semibold px-1.5 py-0.5 rounded border transition-colors ${
                          p.wd
                            ? 'text-orange-600 border-orange-300 bg-orange-100 hover:bg-orange-200'
                            : 'text-gray-300 border-gray-200 hover:text-orange-500 hover:border-orange-300'
                        }`}
                      >
                        WD
                      </button>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => onRemove(idx)} title="Remove player"
                        className="text-gray-300 hover:text-red-400 text-xl leading-none transition-colors">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed m-3 rounded-lg border-gray-100">
          <p className="text-gray-300 font-sans text-xs">No players in {flightName} yet.</p>
        </div>
      )}
    </div>
  )
}
