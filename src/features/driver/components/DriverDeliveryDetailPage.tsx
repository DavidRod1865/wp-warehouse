/**
 * DriverDeliveryDetailPage — /driver/deliveries/:id
 *
 * Shows delivery header, items list, and action buttons.
 *
 * Actions:
 *  - status 'pending'    → "Start Delivery" → UPDATE status = 'in_transit'
 *  - status 'in_transit' → "Complete Delivery" → opens SignatureModal
 *  - status 'delivered'  → read-only confirmation view
 */
import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { useDriverDelivery, useDriverDeliveryItems } from '../hooks/useDriverDeliveries'
import { driverKeys } from '../hooks/driverKeys'
import { deliveryKeys } from '../../deliveries/hooks/deliveryKeys'
import { StatusBadge } from './StatusBadge'
import { SignatureModal } from './SignatureModal'
import type { DeliveryItem } from '../../deliveries/types'
import type { Address } from '../../../types/address'

function mapsLink(addr: Address | null | undefined): string {
  if (!addr) return ''
  const parts = [addr.street_address, addr.city, addr.state, addr.zip_code].filter(Boolean)
  const q = encodeURIComponent(parts.join(', '))
  // Apple Maps on iOS, fallback to Google Maps everywhere else
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  return isIOS ? `https://maps.apple.com/?q=${q}` : `https://maps.google.com/?q=${q}`
}

function formatAddress(addr: Address | null | undefined): string {
  if (!addr) return 'No address'
  return [addr.street_address, addr.city, addr.state, addr.zip_code].filter(Boolean).join(', ')
}

interface ItemRowProps {
  item: DeliveryItem
  editable: boolean
  deliveredQty: number
  onQtyChange: (itemId: number, qty: number) => void
}

function ItemRow({ item, editable, deliveredQty, onQtyChange }: ItemRowProps) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-base-200 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm leading-tight truncate">{item.item_name}</p>
        {item.notes && (
          <p className="text-xs text-base-content/50 mt-0.5 truncate">{item.notes}</p>
        )}
      </div>

      {editable ? (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-base-content/50">of {item.quantity}</span>
          <input
            type="number"
            min={0}
            max={item.quantity}
            value={deliveredQty}
            onChange={(e) => {
              const v = Math.min(item.quantity, Math.max(0, Number(e.target.value)))
              if (item.id != null) onQtyChange(item.id, v)
            }}
            className="input input-bordered input-sm w-20 text-center"
          />
        </div>
      ) : (
        <span className="badge badge-ghost shrink-0">
          {item.delivered_quantity ?? item.quantity} / {item.quantity}
        </span>
      )}
    </div>
  )
}

export default function DriverDeliveryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const deliveryId = id ? Number(id) : null
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: delivery, isLoading: loadingDelivery, error: deliveryError } = useDriverDelivery(deliveryId)
  const { data: items = [], isLoading: loadingItems } = useDriverDeliveryItems(deliveryId)

  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [startingDelivery, setStartingDelivery] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  // Per-item delivered quantities (defaults to full quantity)
  const [deliveredQtys, setDeliveredQtys] = useState<Record<number, number>>({})

  const getDeliveredQty = (item: DeliveryItem) => {
    if (item.id == null) return item.quantity
    return deliveredQtys[item.id] ?? item.quantity
  }

  const handleQtyChange = useCallback((itemId: number, qty: number) => {
    setDeliveredQtys((prev) => ({ ...prev, [itemId]: qty }))
  }, [])

  const handleStartDelivery = async () => {
    if (!deliveryId) return
    setStartError(null)
    setStartingDelivery(true)
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({ status: 'in_transit', started_at: new Date().toISOString() })
        .eq('id', deliveryId)

      if (error) throw error

      // Optimistic invalidation
      queryClient.invalidateQueries({ queryKey: driverKeys.delivery(deliveryId) })
      queryClient.invalidateQueries({ queryKey: deliveryKeys.all })
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Failed to start delivery')
    } finally {
      setStartingDelivery(false)
    }
  }

  const handleSignatureSuccess = () => {
    setShowSignatureModal(false)
    // Invalidate all delivery caches
    if (deliveryId) {
      queryClient.invalidateQueries({ queryKey: driverKeys.all })
      queryClient.invalidateQueries({ queryKey: deliveryKeys.all })
    }
    navigate('/driver/deliveries')
  }

  const deliveredQtyList = items
    .filter((item) => item.id != null)
    .map((item) => ({
      delivery_item_id: item.id!,
      delivered_quantity: getDeliveredQty(item),
    }))

  if (loadingDelivery || loadingItems) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  if (deliveryError || !delivery) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center px-4">
        <p className="text-error font-semibold">Delivery not found</p>
        <button className="btn btn-ghost" onClick={() => navigate('/driver/deliveries')}>
          Back
        </button>
      </div>
    )
  }

  const isEditable = delivery.status === 'in_transit'
  const isDelivered = delivery.status === 'delivered'
  const projectName = delivery.projects?.name ?? 'No project'
  const mapsUrl = mapsLink(delivery.to_address)

  return (
    <>
      <div className="flex flex-col gap-5 max-w-lg mx-auto pb-28">
        {/* Back link */}
        <button
          type="button"
          className="btn btn-ghost btn-sm self-start -ml-2 mt-1"
          onClick={() => navigate('/driver/deliveries')}
        >
          ← Back
        </button>

        {/* Header card */}
        <div className="card bg-base-200">
          <div className="card-body p-4 gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="text-xl font-bold font-[Barlow_Semi_Condensed]">
                  {delivery.delivery_number}
                </h1>
                <p className="text-sm text-base-content/70">{projectName}</p>
              </div>
              <StatusBadge status={delivery.status} />
            </div>

            {/* To address — tappable maps link */}
            {delivery.to_address && (
              <div>
                <p className="text-xs text-base-content/40 uppercase tracking-wide font-semibold mb-0.5">
                  Deliver to
                </p>
                {mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary underline underline-offset-2 break-words"
                  >
                    {formatAddress(delivery.to_address)}
                  </a>
                ) : (
                  <p className="text-sm text-base-content/80 break-words">
                    {formatAddress(delivery.to_address)}
                  </p>
                )}
              </div>
            )}

            {/* From address */}
            {delivery.from_address && (
              <div>
                <p className="text-xs text-base-content/40 uppercase tracking-wide font-semibold mb-0.5">
                  Pickup from
                </p>
                <p className="text-sm text-base-content/70">
                  {formatAddress(delivery.from_address)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <h2 className="font-semibold text-base mb-1">
              Items {isEditable && <span className="text-xs font-normal text-base-content/50">(adjust quantities if needed)</span>}
            </h2>

            {items.length === 0 ? (
              <p className="text-sm text-base-content/50">No items on this delivery.</p>
            ) : (
              <div>
                {items.map((item) => (
                  <ItemRow
                    key={item.id ?? item.item_name}
                    item={item}
                    editable={isEditable}
                    deliveredQty={getDeliveredQty(item)}
                    onQtyChange={handleQtyChange}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Completed state details */}
        {isDelivered && delivery.signature_name && (
          <div className="card bg-success/10 border border-success/30">
            <div className="card-body p-4">
              <p className="text-sm font-semibold text-success">Delivery confirmed</p>
              <p className="text-sm text-base-content/70">
                Signed by: <strong>{delivery.signature_name}</strong>
              </p>
            </div>
          </div>
        )}

        {/* Start error */}
        {startError && (
          <div className="alert alert-error text-sm py-2">
            <span>{startError}</span>
          </div>
        )}
      </div>

      {/* Fixed bottom action bar */}
      {!isDelivered && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-base-100 border-t border-base-300 safe-area-bottom">
          {delivery.status === 'pending' && (
            <button
              type="button"
              className="btn btn-primary btn-lg w-full"
              onClick={handleStartDelivery}
              disabled={startingDelivery}
            >
              {startingDelivery ? <span className="loading loading-spinner" /> : 'Start Delivery'}
            </button>
          )}

          {delivery.status === 'in_transit' && (
            <button
              type="button"
              className="btn btn-success btn-lg w-full"
              onClick={() => setShowSignatureModal(true)}
            >
              Complete Delivery
            </button>
          )}
        </div>
      )}

      {/* Signature modal */}
      {showSignatureModal && deliveryId && (
        <SignatureModal
          deliveryId={deliveryId}
          deliveredQtys={deliveredQtyList}
          onSuccess={handleSignatureSuccess}
          onClose={() => setShowSignatureModal(false)}
        />
      )}
    </>
  )
}
