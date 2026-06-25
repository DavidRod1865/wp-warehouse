/**
 * useProjectItems — Fetch items in a project's warehouse subfolder
 *
 * Used for auto-matching parsed packing list items against existing
 * Sortly items in a project. Returns items + a fuzzy matcher.
 */
import { useMemo } from 'react'
import { useItems } from '../../inventory/hooks/useItems'
import type { SortlyItem } from '../../../types/sortly'

/**
 * Normalize a string for fuzzy matching: lowercase, trim, collapse whitespace.
 */
function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Simple fuzzy match: checks if all words in the query appear in the target.
 * Returns a score (0-1) based on character overlap.
 */
function matchScore(query: string, target: string): number {
  const q = normalize(query)
  const t = normalize(target)

  // Exact match
  if (q === t) return 1

  // Check if all query words appear in target
  const queryWords = q.split(' ')
  const allWordsMatch = queryWords.every((w) => t.includes(w))
  if (allWordsMatch) return 0.8

  // Partial: check how many words match
  const matchedWords = queryWords.filter((w) => t.includes(w))
  if (matchedWords.length > 0) {
    return (matchedWords.length / queryWords.length) * 0.6
  }

  return 0
}

export interface ItemMatch {
  item: SortlyItem
  score: number
}

export function useProjectItems(folderId: number | null | undefined) {
  const { data: items, isLoading, error } = useItems(folderId)

  const findMatches = useMemo(() => {
    if (!items) return (_name: string) => [] as ItemMatch[]

    return (itemName: string, threshold = 0.5): ItemMatch[] => {
      const matches: ItemMatch[] = []

      for (const item of items) {
        const score = matchScore(itemName, item.name)
        if (score >= threshold) {
          matches.push({ item, score })
        }
      }

      return matches.sort((a, b) => b.score - a.score)
    }
  }, [items])

  return {
    items: items || [],
    isLoading,
    error,
    findMatches,
  }
}
