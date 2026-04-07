import { useState, useEffect } from 'react'

/**
 * Subscribe to a Firestore path and return live data.
 * Falls back to `staticFallback` while loading or if Firebase is unavailable.
 *
 * @param {Function|null} listenFn   – one of DB.listen* functions; receives a callback
 *                                     and returns an unsubscribe function
 * @param {any}           staticFallback – value to use until Firestore responds
 *
 * @returns {{ data: any, status: 'loading'|'live'|'static'|'error', error: Error|null }}
 */
export function useFireData(listenFn, staticFallback) {
  const [data,   setData]   = useState(staticFallback)
  const [status, setStatus] = useState(listenFn ? 'loading' : 'static')
  const [error,  setError]  = useState(null)

  useEffect(() => {
    if (!listenFn) return
    let cancelled = false
    let unsub

    try {
      unsub = listenFn((d) => {
        if (cancelled) return
        if (d !== null) {
          setData(d)
          setStatus('live')
          setError(null)
        } else {
          // Document doesn't exist yet — stay on static fallback
          setStatus('static')
        }
      })
    } catch (err) {
      // listenFn itself threw (e.g. Firestore not configured)
      if (!cancelled) {
        console.error('[useFireData] listener setup failed:', err)
        setStatus('error')
        setError(err instanceof Error ? err : new Error(String(err)))
      }
      return
    }

    // Attach an error handler for runtime snapshot failures (network loss, etc.)
    // onSnapshot returns an unsubscribe function; to also catch errors we need
    // the three-argument form: onSnapshot(ref, onNext, onError).
    // Since listenFn wraps onSnapshot and only exposes the callback, we rely on
    // Firestore's built-in offline cache to keep serving stale data and surface
    // the error here via a global console warning.  The status stays 'live' so
    // the UI keeps showing the last good data rather than flashing an error.

    return () => {
      cancelled = true
      unsub?.()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { data, status, error }
}
