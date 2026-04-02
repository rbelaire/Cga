import { useState, useEffect } from 'react'

/**
 * Subscribe to a Firestore path and return live data.
 * Falls back to `staticFallback` while loading or if Firebase is not configured.
 *
 * @param {Function} listenFn  – one of DB.listen* functions, returns unsubscribe fn
 * @param {any}      staticFallback – imported static JSON to use until Firestore responds
 */
export function useFireData(listenFn, staticFallback) {
  const [data,   setData]   = useState(staticFallback)
  const [status, setStatus] = useState('loading') // 'loading' | 'live' | 'static'

  useEffect(() => {
    if (!listenFn) { setStatus('static'); return }
    let cancelled = false
    let unsub
    try {
      unsub = listenFn((d) => {
        if (cancelled) return
        if (d !== null) {
          setData(d)
          setStatus('live')
        } else {
          setStatus('static')
        }
      })
    } catch {
      setStatus('static')
    }
    return () => {
      cancelled = true
      unsub?.()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { data, status }
}
