/**
 * Topbar — Sticky top bar with breadcrumbs, search, theme toggle, notifications.
 */
import { useLocation } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useTheme } from '../../hooks/useTheme'
import { SortlyStatusPill } from './SortlyStatusPill'

const routeLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/receiving': 'Receiving',
  '/inventory': 'Inventory',
  '/deliveries': 'Deliveries',
  '/deliveries/new': 'New Delivery',
  '/analytics': 'Reports',
  '/users': 'Users',
  '/activity': 'Activity',
  '/batches': 'Batching',
  '/packing-lists': 'Packing Lists',
}

export function Topbar() {
  const { pathname } = useLocation()
  const { isDark, toggleTheme } = useTheme()

  // Derive breadcrumb label
  const pageLabel = routeLabels[pathname]
    || (pathname.startsWith('/deliveries/') ? 'Edit Delivery' : 'Page')

  return (
    <div
      className="flex items-center gap-3.5 px-6 py-3 border-b border-[var(--line)] sticky top-0 z-10"
      style={{
        background: 'color-mix(in oklab, var(--bg) 70%, transparent)',
        backdropFilter: 'saturate(140%) blur(8px)',
      }}
    >
      {/* Breadcrumbs */}
      <div
        className="text-[var(--muted)] uppercase"
        style={{ fontFamily: 'var(--mono)', fontSize: '11px', letterSpacing: '.04em' }}
      >
        Warehouse / <b className="text-[var(--ink-2)] font-medium">{pageLabel}</b>
      </div>

      {/* Search */}
      <div className="ml-auto flex items-center gap-2.5 px-3 py-[7px] border border-[var(--line)] rounded-lg min-w-[340px] bg-[var(--panel)] text-[var(--muted)] text-[13px]">
        <Icon name="search" className="w-3.5 h-3.5" />
        <span>Search jobs, SKUs, techs…</span>
        <kbd
          className="ml-auto border border-[var(--line)] px-1.5 py-px rounded text-[var(--faint)]"
          style={{ fontFamily: 'var(--mono)', fontSize: '10px' }}
        >
          ⌘K
        </kbd>
      </div>

      {/* Sortly status */}
      <SortlyStatusPill />

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="w-[34px] h-[34px] rounded-lg grid place-items-center border border-[var(--line)] bg-[var(--panel)] text-[var(--ink-2)] cursor-pointer hover:bg-[var(--panel-2)]"
        title="Toggle theme"
      >
        <Icon name={isDark ? 'sun' : 'moon'} className="w-4 h-4" />
      </button>

      {/* Notifications */}
      <div
        className="w-[34px] h-[34px] rounded-lg grid place-items-center border border-[var(--line)] bg-[var(--panel)] text-[var(--ink-2)] relative cursor-default"
        title="Notifications"
      >
        <Icon name="bell" className="w-4 h-4" />
        <span
          className="absolute top-1.5 right-1.5 w-[7px] h-[7px] rounded-full bg-[var(--signal)]"
          style={{ border: '1.5px solid var(--panel)' }}
        />
      </div>
    </div>
  )
}
