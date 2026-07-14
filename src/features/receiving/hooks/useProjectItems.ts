/**
 * useProjectItems (Phase 4 — inventory-backed)
 *
 * Replaces the Sortly-backed version. Returns all inventory items with
 * the same fuzzy-match interface as the previous implementation.
 *
 * The `folderId` parameter is kept for API compat but is no longer used.
 */
import { useMemo } from 'react'
import { useInventoryItems } from '../../inventory/hooks/useInventoryItems'
import type { InventoryItem } from '../../inventory/types'

export interface ItemMatch {
  item: InventoryItem
  score: number
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

function matchScore(query: string, target: string, partNumber?: string | null): number {
  const q = normalize(query)
  const t = normalize(target)

  if (q === t) return 1.0

  const queryWords = q.split(' ')
  if (queryWords.every((w) => t.includes(w))) return 0.8

  const matchedWords = queryWords.filter((w) => t.includes(w))
  if (matchedWords.length > 0) {
    return (matchedWords.length / queryWords.length) * 0.6
  }

  if (partNumber) {
    const pn = normalize(partNumber)
    if (pn === q) return 0.75
    if (q.includes(pn) || pn.includes(q)) return 0.5
  }

  return 0
}

/** @param _folderId Unused — kept for API compat with previous Sortly version */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useProjectItems(_folderId?: number | null) {
  const { data: items = [], isLoading, error } = useInventoryItems()

  const findMatches = useMemo(() => {
    return (itemName: string, threshold = 0.5): ItemMatch[] => {
      return items
        .map((item) => ({ item, score: matchScore(itemName, item.name, item.part_number) }))
        .filter((r) => r.score >= threshold)
        .sort((a, b) => b.score - a.score)
    }
  }, [items])

  return {
    items,
    isLoading,
    error,
    findMatches,
  }
}
