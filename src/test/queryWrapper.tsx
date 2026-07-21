/**
 * queryWrapper.tsx — TanStack Query test harness
 *
 * Provides a fresh QueryClient (retries disabled so failing mutations/queries
 * reject immediately instead of retrying and timing out the test) plus a
 * wrapper component for `renderHook`/`render`.
 */
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

export function createQueryWrapper(queryClient: QueryClient = createTestQueryClient()) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return Wrapper
}
