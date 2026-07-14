/**
 * Topbar — Sticky top bar with breadcrumbs, theme toggle, notifications.
 */
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useTheme } from '../../hooks/useTheme'

interface Crumb {
  label: string
  to?: string
}

const SEGMENT_LABELS: Record<string, string> = {
  receiving: 'Receiving',
  inventory: 'Inventory',
  locations: 'Locations',
  deliveries: 'Deliveries',
  clients: 'Clients',
  vendors: 'Vendors',
  projects: 'Projects',
  'purchase-orders': 'Purchase Orders',
  batches: 'Batching',
  'packing-lists': 'Packing Lists',
  analytics: 'Reports',
  users: 'Users',
  activity: 'Activity',
  audit: 'Audit',
}

/** Exact path overrides (leaf labels for known nested pages). */
const PATH_CRUMBS: Record<string, Crumb[]> = {
  '/': [{ label: 'Dashboard' }],
  '/deliveries/new': [
    { label: 'Deliveries', to: '/deliveries' },
    { label: 'New Delivery' },
  ],
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function buildCrumbs(pathname: string): Crumb[] {
  const exact = PATH_CRUMBS[pathname]
  if (exact) return exact

  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) return [{ label: 'Dashboard' }]

  const crumbs: Crumb[] = []
  let acc = ''

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    acc += `/${part}`
    const isLast = i === parts.length - 1
    const isId = /^\d+$/.test(part)

    let label: string
    if (isId) {
      const parent = parts[i - 1]
      if (parent === 'deliveries') label = 'Edit Delivery'
      else if (parent === 'purchase-orders') label = 'PO Detail'
      else if (parent === 'clients') label = 'Client Detail'
      else if (parent === 'vendors') label = 'Vendor Detail'
      else label = 'Detail'
    } else if (part === 'new') {
      label = 'New'
    } else {
      label = SEGMENT_LABELS[part] ?? titleCase(part)
    }

    crumbs.push(isLast ? { label } : { label, to: acc })
  }

  return crumbs
}

export function Topbar() {
  const { pathname } = useLocation()
  const { isDark, toggleTheme } = useTheme()
  const crumbs = buildCrumbs(pathname)

  return (
    <div
      className="flex items-center gap-3.5 px-6 py-3 border-b border-[var(--line)] sticky top-0 z-10"
      style={{
        background: 'color-mix(in oklab, var(--bg) 70%, transparent)',
        backdropFilter: 'saturate(140%) blur(8px)',
      }}
    >
      {/* Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className="text-[var(--muted)] uppercase"
        style={{ fontFamily: 'var(--mono)', fontSize: '11px', letterSpacing: '.04em' }}
      >
        <ol className="flex items-center gap-1.5 list-none m-0 p-0">
          <li>
            <Link to="/" className="hover:text-[var(--ink-2)] no-underline text-[var(--muted)]">
              Warehouse
            </Link>
          </li>
          {crumbs.map((crumb, i) => (
            <li key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
              <span aria-hidden>/</span>
              {crumb.to ? (
                <Link to={crumb.to} className="hover:text-[var(--ink-2)] no-underline text-[var(--muted)]">
                  {crumb.label}
                </Link>
              ) : (
                <b className="text-[var(--ink-2)] font-medium" aria-current="page">
                  {crumb.label}
                </b>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="ml-auto w-[34px] h-[34px] rounded-lg grid place-items-center border border-[var(--line)] bg-[var(--panel)] text-[var(--ink-2)] cursor-pointer hover:bg-[var(--panel-2)]"
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
