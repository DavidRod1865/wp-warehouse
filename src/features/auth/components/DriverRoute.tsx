import { Navigate, Outlet } from 'react-router-dom'
import { useRequireRole } from '../hooks/useRequireRole'

export function DriverRoute() {
  const { allowed, isLoading, redirectTo } = useRequireRole(['driver'])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  if (!allowed) {
    return <Navigate to={redirectTo ?? '/driver/login'} replace />
  }

  return <Outlet />
}
