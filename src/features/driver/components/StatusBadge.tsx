import type { DeliveryStatus } from '../../deliveries/types'

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const STATUS_CLASS: Record<DeliveryStatus, string> = {
  draft: 'badge-ghost',
  pending: 'badge-warning',
  in_transit: 'badge-info',
  delivered: 'badge-success',
  cancelled: 'badge-error',
}

interface Props {
  status: DeliveryStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const sizeClass = size === 'sm' ? 'badge-sm' : ''
  return (
    <span className={`badge ${STATUS_CLASS[status]} ${sizeClass} font-semibold`}>
      {STATUS_LABEL[status]}
    </span>
  )
}
