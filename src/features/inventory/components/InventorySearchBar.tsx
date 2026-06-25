/**
 * InventorySearchBar — Search input and stock filter buttons
 */
import { Icon } from '../../../components/ui/Icon'
import { type StockFilter } from '../hooks/useInventoryData'

interface InventorySearchBarProps {
  searchQuery: string
  onSetSearchQuery: (query: string) => void
  stockFilter: StockFilter
  onSetStockFilter: (filter: StockFilter) => void
  summaryStats: {
    totalSkus: number
    lowCount: number
    zeroCount: number
  }
  hasActiveFolderId: boolean
  onAddItem: () => void
}

export function InventorySearchBar({
  searchQuery,
  onSetSearchQuery,
  stockFilter,
  onSetStockFilter,
  summaryStats,
  hasActiveFolderId,
  onAddItem,
}: InventorySearchBarProps) {
  const savedViews: { label: string; filter: StockFilter; count?: number }[] = [
    { label: 'All items', filter: 'all', count: summaryStats.totalSkus },
    { label: 'Low stock', filter: 'low', count: summaryStats.lowCount },
    { label: 'Zero stock', filter: 'zero', count: summaryStats.zeroCount },
  ]

  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] min-w-[220px]">
        <Icon name="search" className="w-3.5 h-3.5 text-[var(--muted)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSetSearchQuery(e.target.value)}
          placeholder="Search items, SKUs..."
          className="bg-transparent outline-none text-sm text-[var(--ink)] placeholder:text-[var(--faint)] flex-1"
        />
      </div>

      {savedViews.map((v) => (
        <button
          key={v.filter}
          onClick={() => onSetStockFilter(v.filter)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            border: `1px solid ${stockFilter === v.filter ? 'var(--signal)' : 'var(--line)'}`,
            background: stockFilter === v.filter ? 'var(--signal)' : 'var(--panel)',
            color: stockFilter === v.filter ? '#fff' : 'var(--ink-2)',
          }}
        >
          {v.label}
          {v.count != null && (
            <span className="ml-1.5 opacity-65" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
              {v.count}
            </span>
          )}
        </button>
      ))}

      {hasActiveFolderId && (
        <button
          onClick={onAddItem}
          className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-white text-sm font-medium hover:opacity-90"
          style={{ background: 'var(--signal)' }}
        >
          <Icon name="plus" className="w-3.5 h-3.5" />
          Add Item
        </button>
      )}
    </div>
  )
}
