/**
 * RowStockBar — Stock visualization bar with reorder line
 */
interface RowStockBarProps {
  pct: number
  reorderPct: number
  color: string
  reorder: number
}

export function RowStockBar({ pct, reorderPct, color, reorder }: RowStockBarProps) {
  return (
    <div className="relative" style={{ width: 90, height: 5 }}>
      <div
        className="absolute inset-0 rounded-sm"
        style={{ background: 'var(--panel-2)' }}
      />
      <div
        className="absolute top-0 left-0 h-full rounded-sm"
        style={{ width: `${pct * 100}%`, background: color }}
      />
      {reorder > 0 && (
        <div
          className="absolute"
          style={{
            left: `${reorderPct * 100}%`,
            top: -3,
            bottom: -3,
            width: 1,
            background: 'var(--line-2)',
          }}
        />
      )}
    </div>
  )
}
