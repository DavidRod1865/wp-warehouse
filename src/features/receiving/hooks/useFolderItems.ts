/**
 * useFolderItems (Phase 4 — inventory-backed)
 *
 * Replaces the Sortly-backed version. Now fetches items from the `items` table
 * (optionally stock-at-location filtered) and provides the same fuzzy-match
 * interface the ReceiptLineItems component expects.
 *
 * The `folderId` parameter is intentionally ignored (Sortly concept); the hook
 * returns ALL inventory items and lets the caller match by name/part_number.
 * This keeps the call-site API stable so ReceiptLineItems needs minimal changes.
 */
import { useMemo } from 'react'
import { useInventoryItems } from '../../inventory/hooks/useInventoryItems'
import type { InventoryItem } from '../../inventory/types'

// ── Fuzzy matching helpers ────────────────────────────────────────────────────

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

  // Try matching against part_number too
  if (partNumber) {
    const pn = normalize(partNumber)
    if (pn === q) return 0.75
    if (q.includes(pn) || pn.includes(q)) return 0.5
  }

  return 0
}

export interface ItemMatch {
  item: InventoryItem
  score: number
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @param _folderId   Unused (legacy Sortly parameter — kept for API compat)
 * @param _recursive  Unused (legacy parameter — kept for API compat)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useFolderItems(_folderId?: number | null, _recursive = false) {
  const { data: allItems = [], isLoading, error } = useInventoryItems()

  const findMatches = useMemo(() => {
    return (itemName: string, threshold = 0.5): ItemMatch[] => {
      return allItems
        .map((item) => ({ item, score: matchScore(itemName, item.name, item.part_number) }))
        .filter((r) => r.score >= threshold)
        .sort((a, b) => b.score - a.score)
    }
  }, [allItems])

  return {
    items: allItems,
    isLoading,
    error,
    findMatches,
  }
}
