// Shared presentational primitives used across the admin panels.
import { CheckIcon, ErrorIcon } from './icons'

export const flightTagStyles = {
  Championship: 'bg-amber-50 text-amber-700 border-amber-200',
  '1st Flight': 'bg-blue-50 text-blue-700 border-blue-200',
  '2nd Flight': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  '3rd Flight': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '4th Flight': 'bg-purple-50 text-purple-700 border-purple-200',
  '5th Flight': 'bg-pink-50 text-pink-700 border-pink-200',
  Unassigned:    'bg-gray-100 text-gray-600 border-gray-200',
  'New Players': 'bg-teal-50 text-teal-700 border-teal-200',
}

// ── Excel download button ────────────────────────────────────────────────────
export function XlsxBtn({ onClick, children, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-semibold rounded border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
      {children}
    </button>
  )
}

// ── PDF download button ──────────────────────────────────────────────────────
export function PdfBtn({ onClick, children, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-semibold rounded border border-red-300 text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
      </svg>
      {children}
    </button>
  )
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
export function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-sm w-full p-5">
        <p className="text-sm font-sans text-gray-800 mb-5 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-sans font-semibold rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            autoFocus
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-sans font-semibold rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Save-to-cloud button (spinner / saved / error states) ─────────────────────
export function SaveBtn({ onClick, saving, status, label = 'Save to Cloud', className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className={`flex items-center gap-1.5 px-4 py-2 text-xs font-sans font-semibold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
        status === 'ok'  ? 'bg-green-600 text-white' :
        status === 'err' ? 'bg-red-500   text-white' :
                           'bg-forest    text-white hover:bg-forest/90'
      } ${className}`}
    >
      {saving ? (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
      ) : status === 'ok' ? (
        <>
          <CheckIcon />
          <span>Saved</span>
        </>
      ) : status === 'err' ? (
        <>
          <ErrorIcon />
          <span>Error</span>
        </>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      )}
      {!saving && status !== 'ok' && status !== 'err' && label}
    </button>
  )
}
