import { useEffect, useState } from 'react'

export function useSubscription(listen, deps) {
  const [data, setData] = useState(undefined)
  useEffect(() => {
    let alive = true
    const unsubscribe = listen((value) => {
      queueMicrotask(() => {
        if (alive) setData(value ?? null)
      })
    })
    return () => {
      alive = false
      unsubscribe?.()
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  return data
}
