/**
 * useItems — Fetch items in a Sortly folder
 *
 * Replaces the old fetchAllItems() + cacheService pattern.
 * TanStack Query handles caching (staleTime: 2min), dedup, and background refetch.
 *
 * Automatically paginates through all pages to get the complete item list.
 */
import { useQuery } from '@tanstack/react-query'
import { sortlyClient } from '../../../lib/sortly'
import { sortlyKeys } from './sortlyKeys'
import type { SortlyItem } from '../../../types/sortly'

export async function fetchAllItemsInFolder(folderId: number): Promise<SortlyItem[]> {
  const allItems: SortlyItem[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const response = await sortlyClient.listItems({
      folder_id: folderId,
      type: 'item',
      per_page: 100,
      page,
      include: 'custom_attributes',
    })

    if (response.data && response.data.length > 0) {
      allItems.push(...response.data)
      hasMore = response.data.length === 100
      page++
    } else {
      hasMore = false
    }
  }

  return allItems
}

export function useItems(folderId: number | null | undefined) {
  return useQuery({
    queryKey: sortlyKeys.itemList(folderId!),
    queryFn: () => fetchAllItemsInFolder(folderId!),
    enabled: !!folderId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useItem(itemId: number | null | undefined) {
  return useQuery({
    queryKey: sortlyKeys.itemDetail(itemId!),
    queryFn: async () => {
      const response = await sortlyClient.getItem(itemId!)
      return response.data
    },
    enabled: !!itemId,
    staleTime: 2 * 60 * 1000,
  })
}
