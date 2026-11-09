import { DB } from '../db'

export function stamp() {
  return Date.now()
}

export async function note(action, details, user) {
  try {
    await DB.appendChangelog({
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      ts: Date.now(),
      action,
      details,
      user: user || 'Board member',
    })
  } catch (error) {
    console.warn('[CGA] The change was saved, but the log entry was not.', error)
  }
}
