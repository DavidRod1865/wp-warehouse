/**
 * EditDeliveryPage — Edit an existing delivery
 *
 * Phase 5+: Uses update_delivery_items RPC via useUpdateDelivery.
 * Cancel button calls cancel_delivery RPC via useCancelDelivery.
 * No Sortly.
 */
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/hooks/useAuth'
import { useDelivery, useDeliveryItems } from '../hooks/useDelivery'
import { useUpdateDelivery, useCancelDelivery } from '../hooks/useDeliveryMutations'
import { DeliveryForm } from './DeliveryForm'
import { StatusChip } from '../../../components/ui/StatusChip'
import type { DeliveryFormValues } from '../schemas/deliverySchema'

export default function EditDeliveryPage() {
  const { id } = useParams<{ id: string }>()
  const deliveryId = id ? parseInt(id, 10) : null
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [savingStatus, setSavingStatus] = useState('')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const { data: delivery, isLoading: deliveryLoading } = useDelivery(deliveryId)
  const { data: items, isLoading: itemsLoading } = useDeliveryItems(deliveryId)
  const updateDelivery = useUpdateDelivery()
  const cancelDelivery = useCancelDelivery()

  const isLoading = deliveryLoading || itemsLoading

  const handleSubmit = async (data: DeliveryFormValues) => {
    if (!user || !deliveryId || !delivery) return

    try {
      setSavingStatus('Saving delivery…')
      await updateDelivery.mutateAsync({
        deliveryId,
        formValues: data,
        previousItems: items || [],
        activityLog: delivery.activity_log || [],
        userId: user.id,
        userEmail: user.email || '',
        userName: profile?.name || undefined,
      })
      navigate('/')
    } catch (err) {
      console.error('Failed to update delivery:', err)
      setSavingStatus('')
      throw err
    }
  }

  const handleCancel = async () => {
    if (!deliveryId) return
    try {
      await cancelDelivery.mutateAsync({
        deliveryId,
        userId: user?.id,
        userEmail: user?.email || '',
        userName: profile?.name || undefined,
      })
      setShowCancelConfirm(false)
      navigate('/')
    } catch (err) {
      console.error('Failed to cancel delivery:', err)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  if (!delivery) {
    return (
      <div className="m-6 px-4 py-3 rounded-lg text-sm" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
        Delivery not found
      </div>
    )
  }

  const canCancel = delivery.status === 'draft' || delivery.status === 'pending'

  // Map DB items to form values
  const formItems = (items || []).map((item) => ({
    item_id: item.item_id ?? null,
    sortly_item_id: item.sortly_item_id ?? null,
    item_name: item.item_name,
    quantity: item.quantity,
    delivered_quantity: item.delivered_quantity,
    remaining_quantity: item.remaining_quantity,
    available_quantity: item.quantity,
    location: item.notes || '',
    is_manual: !item.item_id && !item.sortly_item_id,
    notes: item.notes,
    custom_attribute_values: item.custom_attribute_values || null,
  }))

  return (
    <div className="p-6 max-w-[1100px]">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1
            className="text-[var(--ink)]"
            style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 500, letterSpacing: '-0.3px' }}
          >
            Edit delivery
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-[var(--muted)]"
              style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
            >
              {delivery.delivery_number}
            </span>
            <StatusChip status={delivery.status} />
          </div>
        </div>
        {canCancel && (
          <button
            type="button"
            onClick={() => setShowCancelConfirm(true)}
            className="px-3.5 py-2 rounded-lg border border-[var(--danger)] text-[var(--danger)] text-sm font-medium hover:bg-[var(--danger-soft)]"
          >
            Cancel delivery
          </button>
        )}
      </div>

      <DeliveryForm
        defaultValues={{
          delivery_number: delivery.delivery_number,
          po_reference: delivery.po_reference || '',
          project_id: delivery.project_id ?? undefined,
          truck_location_id: delivery.truck_location_id ?? null,
          from_location_id: delivery.from_location_ref ?? null,
          from_address: delivery.from_address,
          to_address: delivery.to_address,
          items: formItems,
          driver_id: delivery.driver_id,
          status: delivery.status,
          delivery_type: 'commercial',
        }}
        onSubmit={handleSubmit}
        isEdit
        isSaving={updateDelivery.isPending}
        savingStatus={savingStatus}
        deliveryNumber={delivery.delivery_number}
      />

      {/* Cancel confirmation modal */}
      {showCancelConfirm && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-10"
          style={{
            background: 'color-mix(in oklab, var(--ink) 35%, transparent)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowCancelConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--panel)] rounded-xl w-full max-w-md overflow-hidden"
            style={{ boxShadow: '0 20px 60px -20px rgba(15,23,41,.35), 0 0 0 1px var(--line)' }}
          >
            <div className="px-6 pt-5 pb-4">
              <h3 className="text-lg font-semibold">Cancel Delivery?</h3>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Cancelling <strong className="text-[var(--ink)]">{delivery.delivery_number}</strong> will
                return all truck stock back to the source location. This cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-3.5 border-t border-[var(--line)]" style={{ background: 'color-mix(in oklab, var(--panel-2) 50%, var(--panel))' }}>
              <button
                className="px-3.5 py-2 rounded-lg border border-transparent bg-transparent text-[var(--ink-2)] text-sm font-medium hover:bg-[var(--panel-2)]"
                onClick={() => setShowCancelConfirm(false)}
              >
                Keep it
              </button>
              <button
                className="px-3.5 py-2 rounded-lg bg-[var(--danger)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                onClick={handleCancel}
                disabled={cancelDelivery.isPending}
              >
                {cancelDelivery.isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  'Yes, cancel'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
