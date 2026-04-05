const DASH = '—'

function isMissing(value) {
  return value == null || value === '' || (typeof value === 'number' && Number.isNaN(value))
}

export function formatValue(value, type = 'text') {
  if (type === 'number') return isMissing(value) ? DASH : String(Number(value))
  if (type === 'text') return formatText(value)
  if (type === 'score') return formatScore(value)
  if (type === 'ptm') return formatPTM(value)
  return formatText(value)
}

export function formatCurrency(value) {
  if (isMissing(value)) return DASH
  const n = Number(String(value).replace(/[^\d.-]/g, ''))
  if (Number.isNaN(n)) return DASH
  return `$${n.toFixed(n % 1 === 0 ? 0 : 2)}`
}

export function formatDate(value) {
  if (isMissing(value)) return DASH
  const date = value instanceof Date ? value : new Date(String(value).includes('T') ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return DASH
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function formatScore(value) {
  if (isMissing(value)) return 'Pending'
  const n = Number(value)
  if (Number.isNaN(n)) return 'Pending'
  return String(Math.round(n * 100) / 100)
}

export function formatPTM(value) {
  if (isMissing(value)) return 'Unrated'
  const n = Number(value)
  if (Number.isNaN(n)) return 'Unrated'
  return String(Math.round(n))
}

export function formatText(value, fallback = '') {
  if (isMissing(value)) return fallback
  const withoutControl = Array.from(String(value))
    .map((char) => {
      const code = char.charCodeAt(0)
      return (code < 32 || code === 127) ? ' ' : char
    })
    .join('')
  const text = withoutControl
    .replace(/[\uFFFD]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text || fallback
}

export function formatTrend(value) {
  if (isMissing(value)) return DASH
  const n = Number(value)
  if (Number.isNaN(n)) return DASH
  if (n > 0) return `+${n}`
  return String(n)
}
