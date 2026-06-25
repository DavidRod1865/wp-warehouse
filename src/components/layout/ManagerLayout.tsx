/**
 * ManagerLayout — Shell layout matching the hi-fi design.
 *
 * 248px sidebar + main column with sticky topbar.
 */
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useSortlyPing } from '../../hooks/useSortlyPing'

export function ManagerLayout() {
  useSortlyPing()
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 flex flex-col h-screen overflow-y-auto">
        <Topbar />
        <div className="flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
