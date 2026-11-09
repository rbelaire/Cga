export function Help({ children }) {
  return <p className="text-sm text-gray-600 mb-4">{children}</p>
}

export function Notice({ children }) {
  return <p className="rounded-lg bg-amber-50 border border-amber-200 text-amber-950 text-sm px-3 py-2 mb-4">{children}</p>
}

export function Panel({ title, children }) {
  return (
    <section className="bg-white border border-[#E5E0D4] rounded-xl p-4 sm:p-5">
      {title && <h2 className="font-heading font-bold text-lg text-forest mb-3">{title}</h2>}
      {children}
    </section>
  )
}

export function Confirm({ title, body, confirmLabel, busy, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-5">
        <h2 className="font-heading font-bold text-xl text-forest">{title}</h2>
        <p className="text-sm text-gray-600 mt-2">{body}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={busy} onClick={onConfirm}>{busy ? 'Working…' : confirmLabel}</button>
          <button type="button" className="btn-outline" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
