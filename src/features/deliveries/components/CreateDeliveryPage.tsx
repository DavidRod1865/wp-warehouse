/**
 * CreateDeliveryPage — New delivery creation
 *
 * Phase 5+: Delivery number is generated server-side by the create_delivery RPC.
 * No client-side number generation, no Sortly.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/hooks/useAuth'
import { useCreateDelivery } from '../hooks/useDeliveryMutations'
import { DeliveryForm } from './DeliveryForm'
import type { DeliveryFormValues } from '../schemas/deliverySchema'

export default function CreateDeliveryPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const createDelivery = useCreateDelivery()
  const [savingStatus, setSavingStatus] = useState('')

  const handleSubmit = async (data: DeliveryFormValues) => {
    if (!user) return

    try {
      setSavingStatus('Creating delivery and loading truck…')
      const result = await createDelivery.mutateAsync({
        formValues: data,
        userId: user.id,
        userEmail: user.email || '',
        userName: profile?.name || undefined,
      })
      navigate(`/deliveries/${result.delivery_id}`)
    } catch (err) {
      console.error('Failed to create delivery:', err)
      setSavingStatus('')
      throw err
    }
  }

  return (
    <div className="p-6 max-w-[1100px]">
      <div className="mb-6">
        <h1
          className="text-[var(--ink)]"
          style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 500, letterSpacing: '-0.3px' }}
        >
          New delivery order
        </h1>
        <div
          className="text-[var(--muted)] mt-1"
          style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
        >
          Number generated on save &middot; draft
        </div>
      </div>

      <DeliveryForm
        onSubmit={handleSubmit}
        isSaving={createDelivery.isPending}
        savingStatus={savingStatus}
      />
    </div>
  )
}
