const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Format "2026-03-21" → "Sat, Mar 21, 2026"
 */
export function formatDate(dateStr) {
  // Parse as local date to avoid timezone shift
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = DAYS[date.getDay()].slice(0, 3)
  const month = MONTHS[m - 1]
  return `${day}, ${month} ${d}, ${y}`
}

/**
 * Format "2026-03-21" → "March 21, 2026"
 */
export function formatDateLong(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${MONTHS_LONG[m - 1]} ${d}, ${y}`
}
