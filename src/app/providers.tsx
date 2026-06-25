/**
 * providers.tsx — App-wide provider composition
 *
 * Wraps the app in:
 * 1. QueryClientProvider (TanStack Query — server state)
 * 2. AuthProvider (Supabase auth + realtime subscriptions)
 *
 * Order matters: QueryClient must be available before AuthProvider,
 * since AuthProvider uses useQuery/useMutation internally.
 */
import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../lib/queryClient'
import { AuthProvider } from '../features/auth/hooks/useAuth'
import { ToastProvider } from '../components/ui/Toast'
import { useTheme } from '../hooks/useTheme'

export function Providers({ children }: { children: ReactNode }) {
  // Ensure the theme is applied on ALL routes (including /login).
  useTheme()

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
