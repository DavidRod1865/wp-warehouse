/**
 * useSearchItems — Search Sortly inventory by name
 *
 * Debounced search with automatic caching of results.
 * Only fires when query is at least 2 characters.
 */
import { useQuery } from '@tanstack/react-query'
import { sortlyClient } from '../../../lib/sortly'
import { sortlyKeys } from './sortlyKeys'

export function useSearchItems(query: string, folderIds?: number[]) {
  return useQuery({
    queryKey: [...sortlyKeys.search(query), ...(folderIds ?? [])],
    queryFn: () =>
      sortlyClient.searchItems({
        name: query,
        per_page: 50,
        include: 'custom_attributes',
        ...(folderIds?.length ? { folder_ids: folderIds } : {}),
      }),
    enabled: query.length >= 2,
    staleTime: 60 * 1000,
  })
}
