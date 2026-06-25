/**
 * queryClient.ts — TanStack Query configuration
 *
 * Central QueryClient with defaults tuned for this app:
 * - staleTime: 2 min (matches old cache TTL)
 * - retry: 1 attempt for failed queries
 * - refetchOnWindowFocus: true (fresh data when user returns)
 *
 * Mutation defaults:
 * - No automatic retries (inventory operations shouldn't auto-retry)
 */
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false,
    },
  },
})
