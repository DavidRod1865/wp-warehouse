/**
 * StatusChip — Colored pill with dot indicator for delivery statuses.
 */
import type { ReactNode } from 'react'

type ChipVariant = 'pending' | 'packed' | 'enroute' | 'delivered' | 'draft' | 'cancelled' | 'in_transit' | 'info' | 'sync' | 'none'

const variantStyles: Record<ChipVariant, string> = {
  draft:      'bg-[color-mix(in_oklab,var(--muted)_14%,var(--panel))] text-[var(--ink-2)] border-[color-mix(in_oklab,var(--muted)_22%,var(--panel))]',
  pending:    'bg-[color-mix(in_oklab,var(--muted)_14%,var(--panel))] text-[var(--ink-2)] border-[color-mix(in_oklab,var(--muted)_22%,var(--panel))]',
  packed:     'bg-[color-mix(in_oklab,var(--signal)_12%,var(--panel))] text-[var(--signal)] border-[color-mix(in_oklab,var(--signal)_30%,transparent)]',
  enroute:    'bg-[var(--warn-soft)] text-[var(--warn)] border-[color-mix(in_oklab,var(--warn)_28%,transparent)]',
  in_transit: 'bg-[var(--warn-soft)] text-[var(--warn)] border-[color-mix(in_oklab,var(--warn)_28%,transparent)]',
  delivered:  'bg-[var(--ok-soft)] text-[var(--ok)] border-[color-mix(in_oklab,var(--ok)_28%,transparent)]',
  cancelled:  'bg-[var(--danger-soft)] text-[var(--danger)] border-[color-mix(in_oklab,var(--danger)_28%,transparent)]',
  info:       'bg-[color-mix(in_oklab,#4266aa_18%,var(--panel))] text-[#3d5d92] border-[color-mix(in_oklab,#4266aa_35%,transparent)]',
  sync:       'bg-[var(--ok-soft)] text-[var(--ok)] border-[color-mix(in_oklab,var(--ok)_28%,transparent)]',
  none:       'bg-transparent text-[var(--muted)] border-[var(--line)]',
}

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending: 'Pending',
  packed: 'Packed',
  enroute: 'En route',
  in_transit: 'In transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

interface StatusChipProps {
  status: ChipVariant
  label?: string
  children?: ReactNode
  showDot?: boolean
  className?: string
}

export function StatusChip({
  status,
  label,
  children,
  showDot = true,
  className = '',
}: StatusChipProps) {
  const displayLabel = label || statusLabels[status] || status
  const styles = variantStyles[status] || variantStyles.none

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11.5px] font-medium leading-snug border whitespace-nowrap ${styles} ${className}`}
    >
      {showDot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
      )}
      {children || displayLabel}
    </span>
  )
}
