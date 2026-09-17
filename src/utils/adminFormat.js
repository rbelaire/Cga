// Formatting helpers shared across the admin panels.
export const fmtPM  = pm => pm == null ? '—' : pm > 0 ? `+${pm}` : `${pm}`
export const fmtPOY = p  => p.wd ? 'WD' : p.poy == null ? '—' : p.eligible === false ? 'X' : p.poy % 1 === 0 ? String(p.poy) : p.poy.toFixed(1)
export const fmtCurrency = value => {
  const amount = Number.isFinite(Number(value)) ? Number(value) : 0
  return `$${amount.toFixed(2)}`
}
export const fmtPtmValue = value => {
  const ptm = Number(value)
  return Number.isFinite(ptm) ? Math.round(ptm) : null
}

export function fmtLogTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
