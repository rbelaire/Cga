import { fmtLogTime } from '../../utils/adminFormat'

export function SnapshotsPanel({ snapshots, onRestore }) {
  const sorted = [...snapshots].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0)).slice(0, 50)
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-purple-700 px-4 py-2.5 flex items-center justify-between">
        <span className="text-white font-sans text-sm font-semibold">Snapshots / Restore</span>
        <span className="text-white/70 font-sans text-xs">{sorted.length} recent</span>
      </div>
      {sorted.length === 0 ? (
        <p className="px-4 py-10 text-center text-gray-400 font-sans text-sm">No snapshots yet.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {sorted.map(entry => (
            <div key={entry.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-sans font-semibold text-darktext">{entry.type}{entry.tid ? ` · ${entry.tid}` : ''}</p>
                <p className="text-xs font-sans text-gray-500">{fmtLogTime(entry.ts)}{entry.details ? ` — ${entry.details}` : ''}</p>
              </div>
              <button
                type="button"
                onClick={() => onRestore(entry)}
                className="px-3 py-1.5 text-xs font-sans font-semibold rounded border border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
