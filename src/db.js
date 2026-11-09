import { firebaseReady } from './lib/firebase/client'
import { createLiveDb } from './db/live'
import { createEmptyClub, createMemoryDb } from './db/memory'

export const practiceMode = import.meta.env.VITE_DATA_BACKEND === 'seed'

function createOfflineDb() {
  const memory = createMemoryDb(createEmptyClub())
  return new Proxy(memory, {
    get(target, prop) {
      const name = String(prop)
      if (name.startsWith('save') || name.startsWith('append') || name === 'batchPublish') {
        return async () => {
          throw new Error('Firebase is not configured, so nothing was saved.')
        }
      }
      const value = target[prop]
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

export const DB = practiceMode ? createMemoryDb() : (firebaseReady ? createLiveDb() : createOfflineDb())
