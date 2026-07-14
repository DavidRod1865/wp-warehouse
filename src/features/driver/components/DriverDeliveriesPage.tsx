/**
 * DriverDeliveriesPage — /driver/deliveries
 *
 * Lists deliveries assigned to the current driver.
 * Active (pending / in_transit) are shown prominently; completed (delivered)
 * appear in a collapsible section below.
 */
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/hooks/useAuth'
import { useDriverDeliveries } from '../hooks/useDriverDeliveries'
import { StatusBadge } from './StatusBadge'
import type { Delivery } from '../../deliveries/types'

function getStreet(addr: Delivery['to_address']): string {
  if (!addr) return ''
  return [addr.street_address, addr.city].filter(Boolean).join(', ')
}

function DeliveryCard({ delivery, onClick }: { delivery: Delivery; onClick: () => void }) {
  const itemCount = (delivery as unknown as { items_count?: number }).items_count
  const projectName = delivery.projects?.name ?? 'No project'
  const address = getStreet(delivery.to_address)

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left card bg-base-200 active:scale-[0.98] transition-transform"
    >
      <div className="card-body p-4 gap-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold text-base leading-tight">{delivery.delivery_number}</p>
            <p className="text-sm text-base-content/70 mt-0.5">{projectName}</p>
          </div>
          <StatusBadge status={delivery.status} size="sm" />
        </div>

        {address && (
          <p className="text-sm text-base-content/60 truncate">{address}</p>
        )}

        {itemCount != null && (
          <p className="text-xs text-base-content/50">
            {itemCount} item{itemCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </button>
  )
}

export default function DriverDeliveriesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useDriverDeliveries(user?.id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center px-4">
        <p className="text-error font-semibold">Failed to load deliveries</p>
        <p className="text-sm text-base-content/60">{(error as Error).message}</p>
        <button className="btn btn-primary" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    )
  }

  const active = data?.active ?? []
  const completed = data?.completed ?? []

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto pb-8">
      <h1 className="text-2xl font-bold font-[Barlow_Semi_Condensed] pt-2">My Deliveries</h1>

      {/* Active deliveries */}
      <section>
        <h2 className="text-sm font-semibold text-base-content/50 uppercase tracking-wider mb-3">
          Active
        </h2>

        {active.length === 0 ? (
          <div className="card bg-base-200">
            <div className="card-body p-6 items-center text-center">
              <p className="text-base-content/60">No active deliveries</p>
              <p className="text-sm text-base-content/40">
                Deliveries assigned to you will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {active.map((d) => (
              <DeliveryCard
                key={d.id}
                delivery={d}
                onClick={() => navigate(`/driver/deliveries/${d.id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Completed deliveries */}
      {completed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-base-content/50 uppercase tracking-wider mb-3">
            Completed (recent)
          </h2>
          <div className="flex flex-col gap-2 opacity-70">
            {completed.map((d) => (
              <DeliveryCard
                key={d.id}
                delivery={d}
                onClick={() => navigate(`/driver/deliveries/${d.id}`)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
