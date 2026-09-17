import { fmtLogTime } from '../../utils/adminFormat'

const ACTION_LABELS = {
  'Scores saved':      { color: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400'   },
  'Pairings saved':    { color: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-400' },
  'Payments saved':    { color: 'bg-green-100 text-green-700',  dot: 'bg-green-400'  },
  'Credits saved':     { color: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400'  },
  'Members saved':     { color: 'bg-teal-100 text-teal-700',    dot: 'bg-teal-400'   },
  'Results published': { color: 'bg-red-100 text-red-700',      dot: 'bg-red-500'    },
  'Snapshot restored': { color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
}

export function ChangelogPanel({ changelog }) {
  const sorted = [...changelog].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-forest px-4 py-2.5 flex items-center justify-between">
        <span className="text-white font-sans text-sm font-semibold">Changelog / Audit Log</span>
        <span className="text-white/50 font-sans text-xs">{sorted.length} entries</span>
      </div>
      {sorted.length === 0 ? (
        <p className="px-4 py-10 text-center text-gray-400 font-sans text-sm">
          No changes recorded yet. Actions will appear here after saving.
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          {sorted.map(entry => {
            const style = ACTION_LABELS[entry.action] ?? { color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' }
            return (
              <div key={entry.id} className="flex items-start gap-3 px-4 py-3">
                <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[11px] font-sans font-semibold px-1.5 py-0.5 rounded ${style.color}`}>
                      {entry.action}
                    </span>
                    {entry.details && (
                      <span className="text-xs font-sans text-gray-600 truncate">{entry.details}</span>
                    )}
                  </div>
                  <p className="text-[11px] font-sans text-gray-400 mt-0.5">
                    {fmtLogTime(entry.ts)}
                    {entry.user && <span className="ml-2 text-gray-400">— {entry.user}</span>}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


