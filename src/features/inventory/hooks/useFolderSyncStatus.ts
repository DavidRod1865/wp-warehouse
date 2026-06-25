/**
 * useFolderSyncStatus — Folder-scoped Sortly sync freshness
 *
 * Reads TanStack Query state for a specific folder's item query
 * to show when its data was last fetched and whether a refresh is in progress.
 */
import { useCallback } from 'react'
import { useQueryClient, useIsFetching } from '@tanstack/react-query'
import { sortlyKeys } from './sortlyKeys'

export function useFolderSyncStatus(folderId: number | null) {
  const queryClient = useQueryClient()
  const queryKey = folderId ? sortlyKeys.itemList(folderId) : sortlyKeys.items()

  const isSyncing = useIsFetching({ queryKey }) > 0

  const state = folderId ? queryClient.getQueryState(queryKey) : null
  const lastSyncedAt = state?.dataUpdatedAt || null
  const hasError = state?.status === 'error'

  const refresh = useCallback(() => {
    if (folderId) {
      queryClient.invalidateQueries({ queryKey: sortlyKeys.itemList(folderId) })
    }
    queryClient.invalidateQueries({ queryKey: sortlyKeys.folders() })
  }, [queryClient, folderId])

  return { lastSyncedAt, isSyncing, hasError, refresh }
}
