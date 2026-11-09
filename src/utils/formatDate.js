/** Parse YYYY-MM-DD as a local calendar date. Date-only strings are not UTC. */
export function parseLocalDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  return Number.isNaN(date.getTime()) ? null : date
}

export function startOfToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Format "2026-03-21" → "Sat, Mar 21, 2026"
 */
export function formatDate(dateStr) {
  const date = parseLocalDate(dateStr)
  if (!date) return '—'
  const day = DAYS[date.getDay()].slice(0, 3)
  const month = MONTHS[date.getMonth()]
  return `${day}, ${month} ${date.getDate()}, ${date.getFullYear()}`
}

/**
 * Format "2026-03-21" → "March 21, 2026"
 */
export function formatDateLong(dateStr) {
  const date = parseLocalDate(dateStr)
  if (!date) return '—'
  return `${MONTHS_LONG[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

/**
 * Format "2026-03-21" → "Saturday, March 21, 2026"
 */
export function formatDateFull(dateStr) {
  const date = parseLocalDate(dateStr)
  if (!date) return '—'
  return `${DAYS[date.getDay()]}, ${MONTHS_LONG[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

/** Countdown parts until local midnight at the start of the event day. */
export function timeUntil(dateStr, now = new Date()) {
  const target = parseLocalDate(dateStr)
  if (!target) return null
  const diff = target.getTime() - now.getTime()
  if (diff <= 0) return null
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  return { days, hours, minutes }
}
