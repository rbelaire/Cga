import { formatName } from '../../utils/formatName'

export function AdminCreditsPanel({
  creditSearch,
  setCreditSearch,
  creditNonZero,
  creditTotal,
  saveCredits,
  creditsSaving,
  creditsSaveStatus,
  onExportCreditsPDF,
  onClearAllCredits,
  credits,
  creditRoster,
  creditInputs,
  setCreditInputs,
  applyCredit,
  clearCredit,
  SaveBtn,
  PdfBtn,
  CheckIcon,
}) {
  return (
    <section>
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4">
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={creditSearch}
            onChange={e => setCreditSearch(e.target.value)}
            placeholder="Search members…"
            className="flex-1 min-w-[140px] border border-gray-200 rounded px-3 py-2 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-forest"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-sans text-gray-500 whitespace-nowrap">
              <span className="font-semibold text-forest">{creditNonZero}</span> with balance ·{' '}
              <span className={`font-semibold stat-number ${creditTotal > 0 ? 'text-green-600' : creditTotal < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                {creditTotal < 0 ? '−' : ''}${Math.abs(creditTotal).toFixed(2)}
              </span>{' total'}
            </span>
            <SaveBtn onClick={saveCredits} saving={creditsSaving} status={creditsSaveStatus} />
            <PdfBtn onClick={onExportCreditsPDF}>
              Credits PDF
            </PdfBtn>
            {Object.keys(credits).length > 0 && (
              <button
                onClick={onClearAllCredits}
                className="px-3 py-1.5 text-xs font-sans rounded border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors whitespace-nowrap"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-forest px-4 py-2.5 flex items-center justify-between">
          <span className="text-white font-sans text-sm font-semibold">Member Credit Balances</span>
          <span className="text-white/50 font-sans text-xs">{creditRoster.length} members</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[440px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="table-header text-gray-400 text-left">Player</th>
                <th className="table-header text-gray-400 text-right">Balance</th>
                <th className="table-header text-gray-400 text-center">Add / Subtract</th>
                <th className="table-header text-gray-400 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {creditRoster.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-gray-400 font-sans text-sm">
                    No members match your search.
                  </td>
                </tr>
              ) : (
                creditRoster.map((m, idx) => {
                  const balance = credits[m.name] ?? 0
                  const input   = creditInputs[m.name] ?? ''
                  return (
                    <tr
                      key={m.name}
                      className={`border-b border-gray-100 last:border-0 transition-colors ${
                        balance !== 0 ? 'hover:bg-amber-50/30' : 'hover:bg-gray-50'
                      } ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                    >
                      <td className="px-4 py-2.5 font-sans text-sm text-darktext whitespace-nowrap">
                        {formatName(m.name)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`stat-number text-sm font-bold ${
                          balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-500' : 'text-gray-300'
                        }`}>
                          {balance < 0 ? '−' : ''}${Math.abs(balance).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="number"
                            step="0.01"
                            value={input}
                            onChange={e => setCreditInputs(prev => ({ ...prev, [m.name]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && applyCredit(m.name, input)}
                            placeholder="+/− $"
                            className="w-24 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                          />
                          <button
                            onClick={() => applyCredit(m.name, input)}
                            disabled={!input}
                            title="Apply adjustment"
                            className="w-7 h-7 flex items-center justify-center bg-forest text-white rounded text-sm font-bold disabled:opacity-30 hover:bg-forest/80 transition-colors"
                          >
                            <CheckIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        {balance !== 0 && (
                          <button
                            onClick={() => clearCredit(m.name)}
                            title="Clear balance"
                            className="text-gray-300 hover:text-red-400 text-xl leading-none transition-colors"
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {creditNonZero > 0 && (
              <tfoot>
                <tr className="bg-forest/5 border-t-2 border-forest/20">
                  <td colSpan={2} className="px-4 py-2.5 font-sans text-xs font-semibold uppercase tracking-widest text-forest">
                    Total on Books
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`stat-number text-sm font-bold ${
                      creditTotal > 0 ? 'text-green-600' : creditTotal < 0 ? 'text-red-500' : 'text-gray-400'
                    }`}>
                      {creditTotal < 0 ? '−' : ''}${Math.abs(creditTotal).toFixed(2)}
                    </span>
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </section>
  )
}
