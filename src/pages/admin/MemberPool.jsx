import { formatName } from '../../utils/formatName'
import { roundPtm } from '../../utils/roundPtm'

// ── Member Pool (multi-select) ────────────────────────────────────────────────
export function MemberPool({
  poolMembersGrouped, poolTotalCount, poolSearch,
  selectedPool, onToggle, onToggleGroup, onAddSelected
}) {
  const selectedCount = selectedPool.size

  return (
    <div>
      {/* Sticky add bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-3 py-2">
        <button
          onClick={onAddSelected}
          disabled={selectedCount === 0}
          className={`w-full py-2 rounded text-xs font-sans font-semibold transition-colors ${
            selectedCount > 0
              ? 'bg-gold text-forest hover:bg-amber-400'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {selectedCount > 0
            ? `Add ${selectedCount} Selected to Assigned Flights`
            : 'Select players below'}
        </button>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: '440px' }}>
        {poolTotalCount === 0 && !poolSearch.trim() ? (
          <p className="text-gray-400 text-xs font-sans text-center py-6">All members added.</p>
        ) : poolTotalCount === 0 && poolSearch.trim() ? (
          <p className="text-gray-400 text-xs font-sans text-center py-6">No matches.</p>
        ) : (
          <div className="p-2">
            {[...Object.entries(poolMembersGrouped)].map(([key, group]) => {
              if (!group.length) return null
              const label = key === '__unassigned__' ? 'Unassigned' : key
              const allInGroupSelected = group.every(m => selectedPool.has(m.name))
              return (
                <div key={key} className="mb-2">
                  <button
                    type="button"
                    onClick={() => onToggleGroup(group)}
                    className={`w-full flex items-center justify-between px-1 pt-1 pb-0.5 text-[10px] font-heading font-semibold uppercase tracking-widest transition-colors ${
                      allInGroupSelected ? 'text-forest' : 'text-gray-400 hover:text-forest'
                    }`}
                  >
                    <span>{label}</span>
                    <span className="normal-case tracking-normal text-[10px]">{allInGroupSelected ? 'Clear' : 'Select all'}</span>
                  </button>
                  <ul className="space-y-0.5">
                    {group.map(m => (
                      <li
                        key={m.name}
                        onClick={() => onToggle(m.name)}
                        className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded cursor-pointer border transition-colors select-none ${
                          selectedPool.has(m.name)
                            ? 'bg-gold/20 border-gold text-forest'
                            : 'bg-gray-50 hover:bg-blue-50 hover:border-blue-200 border-transparent'
                        }`}
                      >
                        <span className="font-sans text-xs text-darktext truncate">{formatName(m.name)}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {m.isPaid && (
                            <span
                              className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-100 text-green-700 border border-green-200 text-[10px] font-bold"
                              title="Paid"
                              aria-label={`${formatName(m.name)} paid`}
                            >
                              $
                            </span>
                          )}
                          {m.ptm != null && (
                            <span className="text-[10px] font-mono text-gray-400">PTM {roundPtm(m.ptm)}</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
