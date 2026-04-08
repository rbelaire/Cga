/**
 * Merges the static schedule.json tournament list with dynamic completion
 * overrides stored in Firestore at cga/tournamentStatus.
 *
 * A tournament is 'completed' if either:
 *   - Its status is 'completed' in the static schedule, OR
 *   - It appears in tournamentStatus.completed (set by the admin at runtime)
 *
 * This allows advancing the site to the next tournament without a code deploy.
 */
export function mergeScheduleStatus(staticSchedule, tournamentStatus) {
  const overrides = tournamentStatus?.completed ?? {}
  return staticSchedule.map(t => ({
    ...t,
    status: overrides[t.id] ? 'completed' : t.status,
  }))
}
