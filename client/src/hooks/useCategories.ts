import { useEffect, useState } from 'react'
import { categoryApi } from '@/services'
import type { Category } from '@/types'

/**
 * Shell navigation categories (Gate B1): the full category list for the
 * header/footer navigation. The promise is memoized per session so Navbar
 * and Footer share ONE request per page load; a failed fetch drops the
 * cache so the next mount retries. Components degrade to [] (no category
 * entries) instead of crashing.
 */
let cache: Promise<Category[]> | null = null

export function useCategories(): Category[] {
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    let cancelled = false
    if (!cache) {
      cache = categoryApi.all().catch((error: unknown) => {
        cache = null
        throw error
      })
    }
    cache
      .then((data) => {
        if (!cancelled) setCategories(data)
      })
      .catch(() => {
        /* shell degrades to no-category navigation */
      })
    return () => {
      cancelled = true
    }
  }, [])

  return categories
}
