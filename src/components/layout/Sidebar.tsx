/**
 * Sidebar — Manager navigation matching the hi-fi design.
 *
 * Brand mark, grouped nav sections, Sortly sync status, user avatar.
 * Collapses to hamburger on mobile.
 */
import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../features/auth/hooks/useAuth'
import { Icon } from '../ui/Icon'
import { SortlyStatusPill } from './SortlyStatusPill'
import type { IconName } from '../ui/Icon'
import warehouseIcon from '../../assets/warehouse-icon.png'

interface NavItem {
  to: string
  label: string
  icon: IconName
  end?: boolean
}

const operationsNav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'home', end: true },
  { to: '/receiving', label: 'Receiving', icon: 'clipboard' },
  { to: '/purchase-orders', label: 'Purchase Orders', icon: 'file' },
  { to: '/inventory', label: 'Inventory', icon: 'box' },
  { to: '/locations', label: 'Locations', icon: 'box' },
  { to: '/deliveries', label: 'Deliveries', icon: 'truck' },
]

const directoryNav: NavItem[] = [
  { to: '/projects', label: 'Projects', icon: 'briefcase' },
  { to: '/clients', label: 'Clients', icon: 'building' },
  { to: '/vendors', label: 'Vendors', icon: 'shopping-cart' },
]

const fieldNav: NavItem[] = [
  { to: '/users', label: 'Users', icon: 'users' },
]

const dataNav: NavItem[] = [
  { to: '/analytics', label: 'Reports', icon: 'chart' },
  { to: '/activity', label: 'Activity', icon: 'settings' },
]

function NavSection({ title, items, onClose }: { title: string; items: NavItem[]; onClose: () => void }) {
  return (
    <>
      <div
        className="px-3 pt-3.5 pb-1.5 text-[var(--faint)] tracking-widest uppercase"
        style={{ fontFamily: 'var(--mono)', fontSize: '10px', letterSpacing: '.12em' }}
      >
        {title}
      </div>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onClose}
          className={({ isActive }) =>
            `group flex items-center gap-2.5 px-2.5 py-2 rounded-[7px] text-sm no-underline relative
            ${isActive
              ? 'bg-[var(--panel-2)] text-[var(--ink)] font-medium'
              : 'text-[var(--ink-2)] hover:bg-[var(--panel-2)]'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute -left-2.5 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[var(--ink)]" />
              )}
              <Icon
                name={item.icon}
                className={`w-4 h-4 shrink-0 ${isActive ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}
              />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </>
  )
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { profile, signOut } = useAuth()
  const close = () => setMobileOpen(false)

  const initials = profile?.name
    ? profile.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '??'

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="lg:hidden fixed top-3 left-3 z-50 w-9 h-9 rounded-lg grid place-items-center border border-[var(--line)] bg-[var(--panel)] text-[var(--ink-2)]"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle navigation"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="w-5 h-5">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 lg:sticky lg:top-0
          w-[248px] shrink-0 border-r border-[var(--line)] bg-[var(--panel)]
          flex flex-col h-screen
          transform transition-transform duration-200 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
          <img
            src={warehouseIcon}
            alt="WP Warehouse"
            className="w-8 h-8 shrink-0 warehouse-icon"
          />
          <div className="flex flex-col">
            <div
              className="font-semibold leading-none"
              style={{ fontFamily: 'var(--serif)', fontSize: '17px', letterSpacing: '-0.3px' }}
            >
              With Pride
            </div>
            <div
              className="text-[var(--muted)] uppercase mt-0.5"
              style={{ fontFamily: 'var(--mono)', fontSize: '10px', letterSpacing: '.08em' }}
            >
              HVAC · Ops
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2.5 flex flex-col gap-px">
          <NavSection title="Operations" items={operationsNav} onClose={close} />
          <NavSection title="Directory" items={directoryNav} onClose={close} />
          <NavSection title="Field" items={fieldNav} onClose={close} />
          <NavSection title="Data" items={dataNav} onClose={close} />
        </nav>

        {/* Footer */}
        <div className="mt-auto px-4 pb-3.5 pt-3.5 border-t border-[var(--line)]">
          {/* Sortly sync */}
          <SortlyStatusPill showDetail />

          {/* User */}
          <div className="flex items-center gap-2.5 mt-2.5 px-1 py-1.5">
            <div className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-[#4a5578] to-[#1a2338] text-white grid place-items-center font-semibold text-xs shrink-0">
              {initials}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="text-[13px] font-medium leading-tight truncate">
                {profile?.name || 'User'}
              </div>
              <div
                className="text-[var(--muted)] truncate"
                style={{ fontFamily: 'var(--mono)', fontSize: '11px', letterSpacing: '.02em' }}
              >
                {profile?.role?.replace('_', ' ') || 'manager'}
              </div>
            </div>
            <button
              onClick={signOut}
              className="ml-auto p-1.5 rounded-md hover:bg-[var(--panel-2)] text-[var(--muted)] hover:text-[var(--ink)]"
              title="Sign out"
            >
              <Icon name="logout" className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={close}
        />
      )}
    </>
  )
}
