import { useEffect, useState } from 'react'
import { categoryApi } from '@/services'
import type { Category } from '@/types'

/**
 * Shell navigation categories (Gate B1): the full category list, fetched once
 * for the header/footer navigation. Returns [] on any failure so the shell
 * simply renders without the category entries instead of crashing.
 */
export function useCategories(): Category[] {
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    let cancelled = false
    categoryApi
      .all()
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
