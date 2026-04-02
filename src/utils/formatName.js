/**
 * Converts "First Last" → "Last, First"
 * Handles suffixes like Jr, Sr, II, III, IV
 */
const SUFFIXES = new Set(['Jr', 'Jr.', 'Sr', 'Sr.', 'II', 'III', 'IV', 'V'])

export function formatName(fullName) {
  if (!fullName) return ''
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 1) return fullName

  // Check if the last token is a generational suffix
  const lastPart = parts[parts.length - 1]
  if (SUFFIXES.has(lastPart) && parts.length >= 3) {
    const suffix   = lastPart
    const lastName = parts[parts.length - 2]
    const firstName = parts.slice(0, parts.length - 2).join(' ')
    return `${lastName} ${suffix}, ${firstName}`
  }

  const lastName  = parts[parts.length - 1]
  const firstName = parts.slice(0, parts.length - 1).join(' ')
  return `${lastName}, ${firstName}`
}

/**
 * Sort comparator that sorts by last name (for "First Last" stored names).
 * Accepts either plain name strings or objects with a .name property.
 */
export function compareByLastName(a, b) {
  const nameA = typeof a === 'string' ? a : (a?.name ?? '')
  const nameB = typeof b === 'string' ? b : (b?.name ?? '')
  return formatName(nameA).localeCompare(formatName(nameB))
}
