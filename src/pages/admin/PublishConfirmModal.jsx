import { formatName } from '../../utils/formatName'
import { formatDateLong } from '../../utils/formatDate'
import { fmtPM } from '../../utils/adminFormat'

export function PublishConfirmModal({ preview, publishSaving, publishSaveStatus, onCancel, onConfirm }) {
  const { targetTournament, preview: previewData } = preview

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-3xl bg-white rounded-xl border border-gray-200 shadow-2xl max-h-[90vh] overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-darktext font-heading text-2xl">Confirm Publish Results</h2>
          <p className="text-gray-500 font-sans text-sm mt-1">
            This will overwrite live standings and POY with the results below.
          </p>
        </div>

        <div className="px-5 py-4 overflow-y-auto max-h-[58vh]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
              <p className="text-[11px] uppercase tracking-widest font-semibold text-forest font-sans">Tournament</p>
              <p className="text-darktext font-sans font-semibold mt-1">{targetTournament.name}</p>
              <p className="text-gray-500 text-xs font-sans mt-1">{formatDateLong(targetTournament.date)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
              <p className="text-[11px] uppercase tracking-widest font-semibold text-forest font-sans">Players Affected</p>
              <p className="text-darktext font-sans font-semibold mt-1">
                {previewData.totalPlayersAffected} player{previewData.totalPlayersAffected !== 1 ? 's' : ''}
              </p>
              <p className="text-gray-500 text-xs font-sans mt-1">Based on publishable flights only.</p>
            </div>
          </div>

          <div className="space-y-3">
            {previewData.flightSummaries.map(summary => (
              <div key={summary.flight} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-100 px-3 py-2 flex items-center justify-between">
                  <p className="text-sm font-sans font-semibold text-darktext">{summary.flight}</p>
                  <p className="text-xs font-sans text-gray-500">
                    Winner:{' '}
                    <span className="text-forest font-semibold">
                      {summary.winner ? formatName(summary.winner.winner) : 'No scored winner'}
                    </span>
                  </p>
                </div>
                {summary.topRows.length > 0 ? (
                  <table className="w-full text-xs font-sans">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400">
                        <th className="text-left px-3 py-2">Rank</th>
                        <th className="text-left px-3 py-2">Player</th>
                        <th className="text-center px-3 py-2">+/-</th>
                        <th className="text-center px-3 py-2">POY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.topRows.map(row => (
                        <tr key={`${summary.flight}-${row.rank}-${row.name}`} className="border-b border-gray-50 last:border-b-0">
                          <td className="px-3 py-2 font-semibold text-darktext">{row.rank}</td>
                          <td className="px-3 py-2 text-darktext">{formatName(row.name)}</td>
                          <td className="px-3 py-2 text-center text-gray-500">{fmtPM(row.plusMinus)}</td>
                          <td className="px-3 py-2 text-center text-gray-500">{row.poy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="px-3 py-3 text-xs font-sans text-gray-400">No scored results available for preview.</p>
                )}
              </div>
            ))}
          </div>

          {publishSaveStatus === 'err' && (
            <p className="mt-4 text-sm font-sans text-red-600">Publish failed. Nothing was written. Fix issues and retry.</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={publishSaving}
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-600 text-sm font-sans font-semibold disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={publishSaving}
            className="px-4 py-2 rounded-md bg-gold text-forest text-sm font-sans font-semibold disabled:opacity-60"
          >
            {publishSaving ? 'Publishing…' : 'Confirm & Publish Live Results'}
          </button>
        </div>
      </div>
    </div>
  )
}

