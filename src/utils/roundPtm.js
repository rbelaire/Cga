/**
 * Rounds a PTM value to the nearest whole number.
 * Returns null for null/undefined inputs.
 */
export function roundPtm(val) {
  if (val == null) return null
  return Math.round(val)
}

/**
 * Calculates PTM from a player's last ≤7 round scores.
 *
 * n=1 → score
 * n=2 → MAX of both scores
 * n=3–6 → (sum − lowest) / (n−1)
 * n=7 → (sum − two lowest) / 5
 * Minimum PTM is 6 (floors any result below 6 up to 6).
 *
 * Mirrors the Excel formula:
 * =MAX(6, IF(n=1, C, IF(n=2, MAX(...),
 *   IF(n=7, (SUM-SMALL1-SMALL2)/5, (SUM-MIN)/(n-1)))))
 */
export function calcPtmFromHistory(history) {
  const scores = (history ?? []).filter(v => typeof v === 'number' && Number.isFinite(v))
  const n = scores.length
  if (n === 0) return null
  const sum = scores.reduce((s, v) => s + v, 0)
  let raw
  if (n === 1) {
    raw = scores[0]
  } else if (n === 2) {
    raw = Math.max(scores[0], scores[1])
  } else if (n === 7) {
    const sorted = [...scores].sort((a, b) => a - b)
    raw = (sum - sorted[0] - sorted[1]) / 5
  } else {
    // n = 3, 4, 5, or 6
    raw = (sum - Math.min(...scores)) / (n - 1)
  }
  return Math.max(6, Math.round(raw))
}
