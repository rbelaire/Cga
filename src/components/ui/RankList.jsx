import { formatName } from '../../utils/formatName'

export default function RankList({ title, note, rows, value }) {
  return (
    <section className="bg-white border border-[#E5E0D4] rounded-xl overflow-hidden">
      <div className="bg-forest px-4 py-3 flex items-center justify-between gap-3">
        <h3 className="text-white text-sm font-heading font-semibold uppercase tracking-widest">{title}</h3>
        {note && <span className="text-white/70 text-xs">{note}</span>}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">Nothing posted yet.</p>
      ) : (
        <ol className="divide-y divide-[#E5E0D4]">
          {rows.map((row, index) => (
            <li key={row.name} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="flex items-center gap-3 min-w-0">
                <span className={`stat-number w-5 text-right text-xs ${index < 3 ? 'text-gold font-bold' : 'text-gray-400'}`}>{index + 1}</span>
                <span className="truncate text-sm">{formatName(row.name)}</span>
              </span>
              <span className="stat-number text-sm font-semibold shrink-0">{value(row)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
