/**
 * useFolders — Fetch Sortly folders
 *
 * Replaces fetchAllFolders() + cacheService. Paginates through all folder pages.
 * Folders change less frequently so we use a longer staleTime (5 min).
 */
import { useQuery } from '@tanstack/react-query'
import { sortlyClient } from '../../../lib/sortly'
import { sortlyKeys } from './sortlyKeys'
import type { SortlyItem } from '../../../types/sortly'

async function fetchAllFolders(): Promise<SortlyItem[]> {
  const allFolders: SortlyItem[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const response = await sortlyClient.listItems({
      type: 'folder',
      per_page: 100,
      page,
    })

    if (response.data && response.data.length > 0) {
      allFolders.push(...response.data)
      hasMore = response.data.length === 100
      page++
    } else {
      hasMore = false
    }
  }

  return allFolders
}

export async function fetchSubfolders(parentId: number): Promise<SortlyItem[]> {
  const allFolders: SortlyItem[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const response = await sortlyClient.listItems({
      folder_id: parentId,
      type: 'folder',
      per_page: 100,
      page,
    })

    if (response.data && response.data.length > 0) {
      allFolders.push(...response.data)
      hasMore = response.data.length === 100
      page++
    } else {
      hasMore = false
    }
  }

  return allFolders
}

export function useFolders() {
  return useQuery({
    queryKey: sortlyKeys.folders(),
    queryFn: fetchAllFolders,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSubfolders(parentId: number | null | undefined) {
  return useQuery({
    queryKey: sortlyKeys.folderChildren(parentId!),
    queryFn: () => fetchSubfolders(parentId!),
    enabled: !!parentId,
    staleTime: 5 * 60 * 1000,
  })
}
