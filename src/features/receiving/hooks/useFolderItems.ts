/**
 * useFolderItems — Fetch items in a Sortly folder for auto-matching
 *
 * Used during receiving to match parsed packing list items against existing
 * Sortly inventory. Returns items + a fuzzy matcher.
 *
 * recursive=false (project mode): items in the given folder only
 * recursive=true  (warehouse mode): items in the folder AND all direct subfolders
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useItems } from '../../inventory/hooks/useItems'
import { fetchAllItemsInFolder } from '../../inventory/hooks/useItems'
import { fetchSubfolders } from '../../inventory/hooks/useFolders'
import { sortlyKeys } from '../../inventory/hooks/sortlyKeys'
import type { SortlyItem } from '../../../types/sortly'

// ── Fuzzy matching helpers ────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

function matchScore(query: string, target: string): number {
  const q = normalize(query)
  const t = normalize(target)

  if (q === t) return 1

  const queryWords = q.split(' ')
  if (queryWords.every((w) => t.includes(w))) return 0.8

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

// ── Recursive fetch ───────────────────────────────────────────────────────────

async function fetchAllItemsRecursive(rootFolderId: number): Promise<SortlyItem[]> {
  // 1. Get direct subfolders of root
  const subfolders = await fetchSubfolders(rootFolderId)

  // 2. All folder IDs: root itself + all subfolders
  const folderIds = [rootFolderId, ...subfolders.map((f) => f.id)]

  // 3. Fetch items from all folders in parallel
  const results = await Promise.all(folderIds.map((id) => fetchAllItemsInFolder(id)))

  // 4. Flatten and deduplicate by item id
  const seen = new Set<number>()
  return results.flat().filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useFolderItems(folderId: number | null | undefined, recursive = false) {
  // Non-recursive: delegate to the standard useItems hook (cached per folder)
  const flatQuery = useItems(recursive ? null : folderId)

  // Recursive: custom query that fetches subfolders then all items
  const recursiveQuery = useQuery({
    queryKey: sortlyKeys.itemListRecursive(folderId!),
    queryFn: () => fetchAllItemsRecursive(folderId!),
    enabled: recursive && !!folderId,
    staleTime: 2 * 60 * 1000,
  })

  const activeQuery = recursive ? recursiveQuery : flatQuery
  const rawItems = activeQuery.data ?? ([] as SortlyItem[])
  const items = useMemo(() => rawItems.filter((i) => i.type !== 'folder'), [rawItems])

  const findMatches = useMemo(() => {
    return (itemName: string, threshold = 0.5): ItemMatch[] => {
      return items
        .map((item) => ({ item, score: matchScore(itemName, item.name) }))
        .filter((r) => r.score >= threshold)
        .sort((a, b) => b.score - a.score)
    }
  }, [items])

  return {
    items,
    isLoading: activeQuery.isLoading,
    error: activeQuery.error,
    findMatches,
  }
}
