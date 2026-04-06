/**
 * Rounds a PTM value to the nearest whole number.
 * Returns null for null/undefined inputs.
 */
export function roundPtm(val) {
  if (val == null) return null
  return Math.round(val)
}
