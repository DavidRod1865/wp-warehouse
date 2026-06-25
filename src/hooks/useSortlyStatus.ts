/**
 * useSortlyStatus — Monitor Sortly connection health
 *
 * Inspects all TanStack Query entries under the ['sortly'] key prefix
 * to derive sync status without any additional API calls.
 *
 * Returns:
 *   - lastSyncedAt: timestamp of most recent successful Sortly fetch
 *   - status: 'connected' | 'error' | 'idle' | 'syncing'
 *   - errorCount: number of queries currently in error state
 *   - sync(): force-refresh all Sortly data
 */
import { useCallback, useMemo } from 'react'
import { useQueryClient, useIsFetching } from '@tanstack/react-query'
import { sortlyKeys } from '../features/inventory/hooks/sortlyKeys'

export type SortlyConnectionStatus = 'connected' | 'error' | 'warning' | 'idle' | 'syncing'

export function useSortlyStatus() {
  const queryClient = useQueryClient()
  const isFetchingSortly = useIsFetching({ queryKey: sortlyKeys.all })

  const { lastSyncedAt, errorCount, totalQueries } = useMemo(() => {
    const cache = queryClient.getQueryCache()
    const sortlyQueries = cache.findAll({ queryKey: sortlyKeys.all })

    let latest = 0
    let errors = 0

    for (const query of sortlyQueries) {
      if (query.state.dataUpdatedAt > latest) {
        latest = query.state.dataUpdatedAt
      }
      if (query.state.status === 'error') {
        errors++
      }
    }

    return {
      lastSyncedAt: latest || null,
      errorCount: errors,
      totalQueries: sortlyQueries.length,
    }
    // Re-evaluate when fetching state changes (proxy for cache updates)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, isFetchingSortly])

  const status: SortlyConnectionStatus = useMemo(() => {
    if (isFetchingSortly > 0) return 'syncing'
    if (totalQueries === 0) return 'idle'
    if (errorCount > 0 && errorCount === totalQueries) return 'error'
    if (errorCount > 0) return 'warning'
    return 'connected'
  }, [isFetchingSortly, totalQueries, errorCount])

  const sync = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: sortlyKeys.all })
  }, [queryClient])

  return { lastSyncedAt, status, errorCount, sync }
}
