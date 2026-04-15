import { formatName } from '../../utils/formatName'

function toMoney(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function AdminPaymentsPanel({
  paymentSearch,
  setPaymentSearch,
  paymentPaidCount,
  activeMemberCount,
  savePayments,
  paymentsSaving,
  paymentsSaveStatus,
  onExportPaymentsPDF,
  onExportPaymentsXLSX,
  onClearAllPayments,
  tournament,
  paymentRoster,
  paymentMap,
  credits,
  paymentMeta,
  tid,
  paymentCreditInputs,
  setPaymentCreditInputs,
  onMarkAllPaid,
  onTogglePayment,
  onMarkPaidWithCredit,
  SaveBtn,
  PdfBtn,
  XlsxBtn,
}) {
  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4">
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={paymentSearch}
            onChange={e => setPaymentSearch(e.target.value)}
            placeholder="Search members…"
            className="flex-1 min-w-[140px] border border-gray-200 rounded px-3 py-2 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-forest"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-sans text-gray-500 whitespace-nowrap">
              <span className="font-semibold text-green-600">{paymentPaidCount}</span>
              {' / '}
              <span className="font-semibold text-forest">{activeMemberCount}</span>
              {' paid'}
            </span>
            <SaveBtn onClick={savePayments} saving={paymentsSaving} status={paymentsSaveStatus} />
            <PdfBtn onClick={onExportPaymentsPDF} disabled={!tournament || paymentPaidCount === 0}>
              PDF
            </PdfBtn>
            <XlsxBtn onClick={onExportPaymentsXLSX} disabled={!tournament || paymentPaidCount === 0}>
              Excel
            </XlsxBtn>
            {paymentPaidCount > 0 && (
              <button
                onClick={onClearAllPayments}
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
          <span className="text-white font-sans text-sm font-semibold">
            Payment Status — {tournament?.name ?? 'Select Tournament'}
          </span>
          <span className="text-white/50 font-sans text-xs">{paymentRoster.length} members</span>
        </div>

        {/* Bulk actions */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center gap-2">
          <button
            onClick={() => onMarkAllPaid(paymentRoster.filter(m => !paymentMap[m.name]).map(m => m.name))}
            disabled={paymentRoster.every(m => paymentMap[m.name])}
            className="px-3 py-1 text-xs font-sans font-medium rounded border border-green-200 text-green-600 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Mark All Shown as Paid
          </button>
          <span className="text-xs font-sans text-gray-400">
            {paymentRoster.filter(m => paymentMap[m.name]).length} of {paymentRoster.length} shown are paid
          </span>
          <span className="text-xs font-sans text-gray-500">
            Paid players are considered entered in the field.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[380px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="table-header text-gray-400 w-24 text-center">Paid</th>
                <th className="table-header text-gray-400 text-left">Player</th>
                <th className="table-header text-gray-400 text-right">Credit Available</th>
                <th className="table-header text-gray-400 text-right">Credit Applied</th>
              </tr>
            </thead>
            <tbody>
              {paymentRoster.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-gray-400 font-sans text-sm">
                    No members match your search.
                  </td>
                </tr>
              ) : (
                paymentRoster.map((m, idx) => {
                  const isPaid = !!paymentMap[m.name]
                  const balance = toMoney(credits[m.name] ?? 0)
                  const creditApplied = toMoney(paymentMeta?.[tid]?.[m.name]?.creditUsed ?? 0)
                  const creditInput = paymentCreditInputs[m.name] ?? ''
                  return (
                    <tr
                      key={m.name}
                      className={`border-b border-gray-100 last:border-0 transition-colors cursor-pointer ${
                        isPaid ? 'bg-green-50/60 hover:bg-green-100/60' : 'hover:bg-gray-50'
                      } ${!isPaid && idx % 2 === 0 ? 'bg-white' : ''} ${!isPaid && idx % 2 !== 0 ? 'bg-gray-50/40' : ''}`}
                    >
                      <td className="px-4 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (isPaid) onTogglePayment(m.name)
                            else onMarkPaidWithCredit(m.name, creditInput || 0)
                            setPaymentCreditInputs(prev => ({ ...prev, [m.name]: '' }))
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-sans font-semibold ${
                            isPaid
                              ? 'bg-green-600 text-white'
                              : 'border border-gray-300 text-gray-700 hover:border-forest hover:text-forest'
                          }`}
                        >
                          {isPaid ? 'Paid' : 'Mark Paid'}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 font-sans text-sm text-darktext whitespace-nowrap">
                        {formatName(m.name)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-600">
                        ${balance.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {isPaid ? (
                          <span className="font-mono text-xs text-green-700">${creditApplied.toFixed(2)}</span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            max={balance}
                            value={creditInput}
                            onChange={e => setPaymentCreditInputs(prev => ({ ...prev, [m.name]: e.target.value }))}
                            placeholder="$0.00"
                            className="w-20 border border-gray-200 rounded px-2 py-1 text-xs text-right font-mono"
                          />
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {paymentPaidCount > 0 && (
              <tfoot>
                <tr className="bg-green-50/80 border-t-2 border-green-200">
                  <td className="px-4 py-2.5 text-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  </td>
                  <td colSpan={3} className="px-4 py-2.5 font-sans text-xs font-semibold uppercase tracking-widest text-green-700">
                    {paymentPaidCount} member{paymentPaidCount !== 1 ? 's' : ''} paid
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
