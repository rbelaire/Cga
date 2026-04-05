import { formatName } from './formatName'

function isNetFormat(format) {
  return /net|handicap/i.test(format || '')
}

function hasNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function formatRelativeValue(plusMinus, { net }) {
  if (!hasNumber(plusMinus)) return null
  const base = plusMinus === 0 ? 'E' : `${plusMinus > 0 ? '+' : ''}${plusMinus}`
  return net ? `${base} (Net)` : base
}

function formatScore(points) {
  if (!hasNumber(points)) return null
  return Number.isInteger(points) ? String(points) : points.toFixed(1)
}

export function buildFlightWinnerCards(result, tournamentFormat) {
  const leaderboard = result?.leaderboard
  if (!leaderboard || typeof leaderboard !== 'object') return []

  const net = isNetFormat(tournamentFormat || result?.format)

  return Object.entries(leaderboard)
    .filter(([flight]) => flight !== 'New Players')
    .map(([flight, rows]) => {
      const winnerRows = (Array.isArray(rows) ? rows : []).filter((row) => row?.rank === 1 && row?.name)

      if (!winnerRows.length) {
        return {
          flight,
          players: [{ name: 'Results pending', score: null, relative: null, pending: true }],
        }
      }

      return {
        flight,
        players: winnerRows.map((row) => {
          const score = formatScore(row?.points)
          const relative = formatRelativeValue(row?.plusMinus, { net })
          return {
            name: formatName(row.name),
            score,
            relative,
            pending: !score,
          }
        }),
      }
    })
}
