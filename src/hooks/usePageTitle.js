import { useEffect } from 'react'

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | CGA 2026` : 'Carencro Golf Association'
    return () => {
      document.title = 'Carencro Golf Association'
    }
  }, [title])
}
