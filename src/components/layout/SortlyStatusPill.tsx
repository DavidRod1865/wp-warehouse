import { useSortlyStatus } from '../../hooks/useSortlyStatus'
import type { SortlyConnectionStatus } from '../../hooks/useSortlyStatus'
import { Icon } from '../ui/Icon'

const statusConfig: Record<SortlyConnectionStatus, { color: string; label: string; sub: string }> = {
  connected: { color: 'var(--ok)', label: 'Sortly synced', sub: 'connected' },
  syncing:   { color: 'var(--ok)', label: 'Syncing...', sub: 'refreshing' },
  warning:   { color: 'var(--warn, #eab308)', label: 'Partial sync', sub: 'some errors' },
  error:     { color: 'var(--danger, #ef4444)', label: 'Sync failed', sub: 'connection issue' },
  idle:      { color: 'var(--muted)', label: 'Not synced', sub: 'no data yet' },
}

interface SortlyStatusPillProps {
  /** Show sublabel + sync button (Sidebar). Default: compact dot + label only (Topbar). */
  showDetail?: boolean
}

export function SortlyStatusPill({ showDetail = false }: SortlyStatusPillProps) {
  const { status, sync } = useSortlyStatus()
  const cfg = statusConfig[status]

  const dot = (
    <span
      className={`w-[7px] h-[7px] rounded-full shrink-0${status === 'syncing' ? ' animate-pulse' : ''}`}
      style={{
        backgroundColor: cfg.color,
        boxShadow: `0 0 0 3px color-mix(in oklab, ${cfg.color} 20%, transparent)`,
      }}
    />
  )

  if (showDetail) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[var(--panel-2)] text-xs">
        {dot}
        <div className="leading-tight flex-1 min-w-0">
          <div className="text-[var(--ink-2)] font-medium">{cfg.label}</div>
          <div
            className="text-[var(--muted)]"
            style={{ fontFamily: 'var(--mono)', fontSize: '10px', letterSpacing: '.02em' }}
          >
            {cfg.sub}
          </div>
        </div>
        <button
          onClick={sync}
          disabled={status === 'syncing'}
          className="p-1 rounded-md hover:bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Refresh Sortly data"
        >
          <Icon name="refresh" className={`w-3.5 h-3.5${status === 'syncing' ? ' animate-spin' : ''}`} />
        </button>
      </div>
    )
  }

  // Compact: dot + label, no sync button — for Topbar
  return (
    <div
      className="flex items-center gap-1.5 h-[34px] px-2.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] text-xs cursor-default"
      title={`Sortly: ${cfg.sub}`}
    >
      {dot}
      <span className="text-[var(--ink-2)]" style={{ fontFamily: 'var(--mono)', fontSize: '10px', letterSpacing: '.03em' }}>
        {cfg.sub}
      </span>
    </div>
  )
}
