/**
 * useRequireRole — Route guard hook
 *
 * Returns { allowed, redirectTo } based on the user's role.
 * Used by ManagerRoute and DriverRoute wrapper components.
 */
import { useAuth } from './useAuth'
import type { UserRole } from '../types'

interface RequireRoleResult {
  allowed: boolean
  isLoading: boolean
  redirectTo: string | null
}

export function useRequireRole(allowedRoles: UserRole[]): RequireRoleResult {
  const { user, profile, isLoading } = useAuth()

  if (isLoading) {
    return { allowed: false, isLoading: true, redirectTo: null }
  }

  if (!user || !profile) {
    // Not authenticated — redirect to appropriate login
    const isDriverRoute = allowedRoles.length === 1 && allowedRoles[0] === 'driver'
    return {
      allowed: false,
      isLoading: false,
      redirectTo: isDriverRoute ? '/driver/login' : '/login',
    }
  }

  if (!allowedRoles.includes(profile.role)) {
    // Authenticated but wrong role — redirect to their home
    return {
      allowed: false,
      isLoading: false,
      redirectTo: profile.role === 'driver' ? '/driver/deliveries' : '/',
    }
  }

  return { allowed: true, isLoading: false, redirectTo: null }
}
