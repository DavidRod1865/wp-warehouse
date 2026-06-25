/**
 * DriverLayout — Shell layout for driver routes
 *
 * Simplified top-bar navigation for the mobile-first driver experience.
 */
import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../../features/auth/hooks/useAuth'

export function DriverLayout() {
  const { profile, signOut } = useAuth()

  return (
    <div className="flex flex-col min-h-screen bg-base-100">
      {/* Top bar */}
      <header className="navbar bg-base-200 border-b border-base-300 px-4">
        <div className="flex-1">
          <span className="text-lg font-bold font-[Barlow_Semi_Condensed]">
            WP Driver
          </span>
        </div>
        <div className="flex-none gap-2">
          <span className="text-sm text-base-content/60">
            {profile?.name || profile?.username || 'Driver'}
          </span>
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
              </svg>
            </div>
            <ul tabIndex={0} className="dropdown-content menu p-2 shadow-lg bg-base-200 rounded-box w-52 z-50">
              <li><NavLink to="/driver/settings">Settings</NavLink></li>
              <li><button onClick={signOut}>Sign Out</button></li>
            </ul>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        <Outlet />
      </main>

      {/* Bottom navigation (mobile) */}
      <nav className="btm-nav btm-nav-sm lg:hidden">
        <NavLink to="/driver/deliveries" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="text-xs">Deliveries</span>
        </NavLink>
        <NavLink to="/driver/settings" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="text-xs">Settings</span>
        </NavLink>
      </nav>
    </div>
  )
}
