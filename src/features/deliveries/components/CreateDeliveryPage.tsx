/**
 * CreateDeliveryPage — New delivery creation
 *
 * Generates a delivery number, renders the form, and handles
 * the create mutation (Sortly copy + Supabase insert).
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/hooks/useAuth'
import { useCreateDelivery } from '../hooks/useDeliveryMutations'
import { generateDeliveryNumber } from '../utils/deliveryNumber'
import { DeliveryForm } from './DeliveryForm'
import type { DeliveryFormValues } from '../schemas/deliverySchema'

export default function CreateDeliveryPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const createDelivery = useCreateDelivery()
  const [deliveryNumber, setDeliveryNumber] = useState<string>('')
  const [savingStatus, setSavingStatus] = useState('')

  useEffect(() => {
    generateDeliveryNumber().then(setDeliveryNumber)
  }, [])

  const handleSubmit = async (data: DeliveryFormValues) => {
    if (!user) return

    try {
      setSavingStatus('Copying items to truck in Sortly...')
      const delivery = await createDelivery.mutateAsync({
        formValues: data,
        userId: user.id,
        userEmail: user.email || '',
        userName: profile?.name || undefined,
      })
      navigate(`/deliveries/${delivery.id}`)
    } catch (err) {
      console.error('Failed to create delivery:', err)
      setSavingStatus('')
      throw err
    }
  }

  if (!deliveryNumber) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
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
          {deliveryNumber} &middot; draft
        </div>
      </div>

      <DeliveryForm
        defaultValues={{ delivery_number: deliveryNumber }}
        onSubmit={handleSubmit}
        isSaving={createDelivery.isPending}
        savingStatus={savingStatus}
      />
    </div>
  )
}
