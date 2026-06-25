/**
 * ProgressBar — Thin horizontal progress bar for tables.
 */
interface ProgressBarProps {
  value: number // 0-1
  color?: string
  width?: number
  className?: string
}

export function ProgressBar({
  value,
  color,
  width = 64,
  className = '',
}: ProgressBarProps) {
  const pct = Math.min(1, Math.max(0, value))
  const barColor = color || (pct >= 1 ? 'var(--ok)' : 'var(--signal)')

  return (
    <div
      className={`h-1 rounded-sm bg-[var(--panel-2)] overflow-hidden inline-block align-middle ${className}`}
      style={{ width }}
    >
      <div
        className="h-full rounded-sm transition-all"
        style={{ width: `${pct * 100}%`, background: barColor }}
      />
    </div>
  )
}
