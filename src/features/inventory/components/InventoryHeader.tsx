/**
 * InventoryHeader — Page title, date, and view mode toggle
 */
import { Icon } from '../../../components/ui/Icon'

interface InventoryHeaderProps {
  activeLocationLabel: string
  viewMode: 'warehouse' | 'trucks'
  onSetViewMode: (mode: 'warehouse' | 'trucks') => void
  summaryStats: {
    totalSkus: number
    lowCount: number
    zeroCount: number
  }
  noData: boolean
}

export function InventoryHeader({
  activeLocationLabel,
  viewMode,
  onSetViewMode,
  summaryStats,
  noData,
}: InventoryHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <div
          className="text-[var(--muted)] uppercase"
          style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.06em' }}
        >
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
        <h1
          className="text-[var(--ink)] mt-1"
          style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 500, letterSpacing: '-0.5px' }}
        >
          {activeLocationLabel}
        </h1>
        <div className="text-[var(--ink-2)] mt-1" style={{ fontSize: 14 }}>
          {noData ? (
            <span className="text-[var(--muted)]">Select a location, project, or search to view items</span>
          ) : (
            <>
              <b>{summaryStats.totalSkus.toLocaleString()}</b> SKUs
              {summaryStats.lowCount > 0 && (
                <>
                  {' '}&middot;{' '}
                  <b style={{ color: 'var(--warn)' }}>{summaryStats.lowCount} below reorder</b>
                </>
              )}
              {summaryStats.zeroCount > 0 && (
                <>
                  {' '}&middot;{' '}
                  <b style={{ color: 'var(--danger)' }}>{summaryStats.zeroCount} at zero</b>
                </>
              )}
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] text-[var(--ink-2)] text-sm font-medium hover:bg-[var(--panel-2)]">
          <Icon name="download" className="w-3.5 h-3.5" />
          Export CSV
        </button>

        {/* View mode toggle: Warehouse | Trucks */}
        <div className="flex rounded-lg border border-[var(--line)] overflow-hidden">
          {([{ mode: 'warehouse' as const, icon: 'box' as const, title: 'Warehouse' }, { mode: 'trucks' as const, icon: 'truck' as const, title: 'Trucks' }]).map(({ mode, icon, title }) => (
            <button
              key={mode}
              onClick={() => onSetViewMode(mode)}
              title={title}
              className="px-2.5 py-2 transition-colors grid place-items-center"
              style={{
                background: viewMode === mode ? 'var(--signal)' : 'var(--panel)',
                color: viewMode === mode ? '#fff' : 'var(--ink-2)',
                borderRight: mode === 'warehouse' ? '1px solid var(--line)' : 'none',
              }}
            >
              <Icon name={icon} className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
