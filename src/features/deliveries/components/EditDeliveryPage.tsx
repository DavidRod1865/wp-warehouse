/**
 * EditDeliveryPage — Edit an existing delivery
 *
 * Loads delivery + items, populates the form, and handles
 * the update mutation (Sortly sync + Supabase update).
 */
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/hooks/useAuth'
import { useDelivery, useDeliveryItems } from '../hooks/useDelivery'
import { useUpdateDelivery } from '../hooks/useDeliveryMutations'
import { DeliveryForm } from './DeliveryForm'
import { StatusChip } from '../../../components/ui/StatusChip'
import type { DeliveryFormValues } from '../schemas/deliverySchema'

export default function EditDeliveryPage() {
  const { id } = useParams<{ id: string }>()
  const deliveryId = id ? parseInt(id, 10) : null
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [savingStatus, setSavingStatus] = useState('')

  const { data: delivery, isLoading: deliveryLoading } = useDelivery(deliveryId)
  const { data: items, isLoading: itemsLoading } = useDeliveryItems(deliveryId)
  const updateDelivery = useUpdateDelivery()

  const isLoading = deliveryLoading || itemsLoading

  const handleSubmit = async (data: DeliveryFormValues) => {
    if (!user || !deliveryId || !delivery) return

    try {
      setSavingStatus('Updating Sortly inventory...')
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

  // Map DB items to form values
  const formItems = (items || []).map((item) => ({
    sortly_item_id: item.sortly_item_id,
    item_name: item.item_name,
    quantity: item.quantity,
    delivered_quantity: item.delivered_quantity,
    remaining_quantity: item.remaining_quantity,
    available_quantity: item.quantity,
    location: item.notes || '',
    is_manual: !item.sortly_item_id,
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
      </div>

      <DeliveryForm
        defaultValues={{
          delivery_number: delivery.delivery_number,
          po_reference: delivery.po_reference || '',
          project_id: delivery.project_id,
          truck_folder_id: delivery.truck_sortly_folder_id,
          from_location_id: delivery.from_location_id,
          from_address: delivery.from_address,
          to_address: delivery.to_address,
          items: formItems,
          driver_id: delivery.driver_id,
          status: delivery.status,
        }}
        onSubmit={handleSubmit}
        isEdit
        isSaving={updateDelivery.isPending}
        savingStatus={savingStatus}
      />
    </div>
  )
}
