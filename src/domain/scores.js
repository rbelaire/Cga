export function parseScoreImport(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return []
  const delim = lines[0].includes('\t') ? '\t' : ','
  const first = lines[0].split(delim).map((cell) => cell.trim().toLowerCase().replace(/\s+/g, ''))
  const nameAt = first.findIndex((cell) => ['name', 'player', 'member', 'membername'].includes(cell))
  const scoreAt = first.findIndex((cell) => cell === 'score')
  const hasHeader = nameAt !== -1 || scoreAt !== -1
  const nameIdx = hasHeader ? (nameAt === -1 ? 0 : nameAt) : 0
  const scoreIdx = hasHeader ? (scoreAt === -1 ? 1 : scoreAt) : 1
  return (hasHeader ? lines.slice(1) : lines).flatMap((line) => {
    const cols = line.split(delim).map((cell) => cell.trim())
    const name = cols[nameIdx] || ''
    const raw = cols[scoreIdx] || ''
    if (!name) return []
    const wd = raw.toLowerCase() === 'wd'
    return [{ name, score: wd ? '' : raw, wd }]
  })
}
