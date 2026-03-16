import { useState, useMemo } from 'react'

/**
 * @param {Array} items - Array of objects to filter
 * @param {string[]} keys - Object keys to search within
 */
export function useSearch(items, keys) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) =>
      keys.some((key) => String(item[key] ?? '').toLowerCase().includes(q))
    )
  }, [items, keys, query])

  return { query, setQuery, filtered }
}
