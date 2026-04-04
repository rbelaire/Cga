export function createSnapshotEntry({ type, data, user = 'Admin', tournamentId = null, details = '' }) {
  const ts = Date.now()
  return {
    id: `${type}-${ts}-${Math.random().toString(16).slice(2, 8)}`,
    type,
    ts,
    user,
    tid: tournamentId,
    details,
    data,
  }
}

export function getSnapshotLabel(entry) {
  const type = entry?.type ?? 'unknown'
  const date = entry?.ts ? new Date(entry.ts).toLocaleString() : 'unknown time'
  return `${type} @ ${date}`
}
