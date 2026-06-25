/**
 * InventorySummaryStrip — Summary stats and folder sync status
 */
import { useState, useEffect } from 'react'
import { Icon } from '../../../components/ui/Icon'

interface InventorySummaryStripProps {
  summaryStats: {
    totalSkus: number
    lowCount: number
    zeroCount: number
  }
  noData: boolean
  folderSync: {
    lastSyncedAt: number | null
    isSyncing: boolean
    hasError: boolean
  }
  hasFolder: boolean
  onRefresh: () => void
}

function formatSyncTime(ts: number | null): string {
  if (!ts) return '—'
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function FolderSyncCard({
  lastSyncedAt,
  isSyncing,
  hasError,
  hasFolder,
  onRefresh,
}: {
  lastSyncedAt: number | null
  isSyncing: boolean
  hasError: boolean
  hasFolder: boolean
  onRefresh: () => void
}) {
  // Tick every 30s so the relative time stays fresh
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!lastSyncedAt) return
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [lastSyncedAt])

  const dotColor = !hasFolder
    ? 'var(--muted)'
    : hasError
      ? 'var(--danger, #ef4444)'
      : isSyncing
        ? 'var(--ok)'
        : 'var(--ok)'

  const stale = lastSyncedAt ? Date.now() - lastSyncedAt > 5 * 60_000 : false
  const effectiveColor = stale && !hasError && !isSyncing ? 'var(--warn, #eab308)' : dotColor

  const sub = !hasFolder
    ? 'select a filter'
    : hasError
      ? 'refresh failed'
      : isSyncing
        ? 'refreshing…'
        : 'last refresh'

  return (
    <div className="py-3.5 px-4.5 relative">
      <div className="flex items-center gap-1.5">
        <div
          className="text-[var(--muted)]"
          style={{ fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase' }}
        >
          Inventory Sync
        </div>
        <span
          className={`w-[6px] h-[6px] rounded-full shrink-0${isSyncing ? ' animate-pulse' : ''}`}
          style={{
            backgroundColor: effectiveColor,
            boxShadow: `0 0 0 2.5px color-mix(in oklab, ${effectiveColor} 18%, transparent)`,
          }}
        />
      </div>
      <div
        className="mt-1"
        style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 500, letterSpacing: '-.5px', color: hasError ? 'var(--danger)' : 'var(--ink)' }}
      >
        {formatSyncTime(lastSyncedAt)}
      </div>
      <div className="text-[var(--muted)] mt-0.5" style={{ fontSize: 11.5 }}>
        {sub}
      </div>

      {hasFolder && (
        <button
          onClick={onRefresh}
          disabled={isSyncing}
          className="absolute top-3.5 right-4 p-1.5 rounded-md hover:bg-[var(--panel-2)] text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Refresh folder data"
        >
          <Icon name="refresh" className={`w-3.5 h-3.5${isSyncing ? ' animate-spin' : ''}`} />
        </button>
      )}
    </div>
  )
}

export function InventorySummaryStrip({
  summaryStats,
  noData,
  folderSync,
  hasFolder,
  onRefresh,
}: InventorySummaryStripProps) {
  const summaryItems = [
    { label: 'Total SKUs', value: noData ? '—' : summaryStats.totalSkus.toLocaleString(), sub: noData ? 'select a filter' : 'in view', color: 'var(--ink)' },
    { label: 'Low stock', value: noData ? '—' : String(summaryStats.lowCount), sub: 'below reorder point', color: 'var(--warn)' },
    { label: 'Zero stock', value: noData ? '—' : String(summaryStats.zeroCount), sub: 'out of stock', color: 'var(--danger)' },
  ]

  return (
    <div
      className="grid border border-[var(--line)] rounded-xl bg-[var(--panel)] overflow-hidden mb-5"
      style={{ gridTemplateColumns: 'repeat(4, 1fr)', boxShadow: 'var(--shadow-sm)' }}
    >
      {summaryItems.map((s, i) => (
        <div
          key={i}
          className="py-3.5 px-4.5"
          style={{ borderRight: '1px solid var(--line)' }}
        >
          <div
            className="text-[var(--muted)]"
            style={{ fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase' }}
          >
            {s.label}
          </div>
          <div
            className="mt-1"
            style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 500, letterSpacing: '-.5px', color: s.color }}
          >
            {s.value}
          </div>
          <div className="text-[var(--muted)] mt-0.5" style={{ fontSize: 11.5 }}>
            {s.sub}
          </div>
        </div>
      ))}

      {/* Folder sync card */}
      <FolderSyncCard
        lastSyncedAt={folderSync.lastSyncedAt}
        isSyncing={folderSync.isSyncing}
        hasError={folderSync.hasError}
        hasFolder={hasFolder}
        onRefresh={onRefresh}
      />
    </div>
  )
}
