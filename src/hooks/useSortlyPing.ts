import { useQuery } from '@tanstack/react-query'
import { sortlyClient } from '../lib/sortly'
import { sortlyKeys } from '../features/inventory/hooks/sortlyKeys'

// Keeps a Sortly query warm in the cache so useSortlyStatus always reflects
// real connectivity (never "idle") on any manager page.
export function useSortlyPing() {
  useQuery({
    queryKey: sortlyKeys.customFields(),
    queryFn: () => sortlyClient.listCustomFields(),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
    retry: 1,
  })
}
