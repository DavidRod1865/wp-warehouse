import { Navigate, Outlet } from 'react-router-dom'
import { useRequireRole } from '../hooks/useRequireRole'

export function ManagerRoute() {
  const { allowed, isLoading, redirectTo } = useRequireRole([
    'warehouse_manager',
    'admin',
    'apm',
  ])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  if (!allowed) {
    return <Navigate to={redirectTo ?? '/login'} replace />
  }

  return <Outlet />
}
