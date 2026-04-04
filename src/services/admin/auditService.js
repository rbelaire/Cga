export function createAdminAuditEntry({ action, details = '', tournamentId = null, user = 'Admin' }) {
  const ts = Date.now()
  return {
    id: `${ts}-${Math.random().toString(16).slice(2, 8)}`,
    ts,
    action,
    details,
    tid: tournamentId,
    user,
  }
}
