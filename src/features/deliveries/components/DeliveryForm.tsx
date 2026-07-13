import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { deliverySchema, type DeliveryFormValues, type DeliveryItemFormValues } from '../schemas/deliverySchema'
import { useDeliveryFormData } from '../hooks/useDeliveryFormData'
import { ItemSelectorModal } from './ItemSelectorModal'
import { DEFAULT_FROM_ADDRESS, EMPTY_ADDRESS } from '../../../types/address'
import { DeliveryHeaderCard } from './DeliveryHeaderCard'
import { DeliveryItemsCard } from './DeliveryItemsCard'
import { DeliveryFormFooter } from './DeliveryFormFooter'
import { FormField, AddressFields } from './_formHelpers'

interface DeliveryFormProps {
  defaultValues?: Partial<DeliveryFormValues>
  onSubmit: (data: DeliveryFormValues) => Promise<void>
  isEdit?: boolean
  isSaving?: boolean
  savingStatus?: string
  /** In edit mode: show delivery number for reference */
  deliveryNumber?: string
}

export function DeliveryForm({
  defaultValues,
  onSubmit,
  isEdit = false,
  isSaving = false,
  savingStatus = '',
  deliveryNumber,
}: DeliveryFormProps) {
  const [showItemSelector, setShowItemSelector] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DeliveryFormValues>({
    resolver: zodResolver(deliverySchema),
    defaultValues: {
      delivery_number: '',
      po_reference: '',
      project_id: undefined,
      truck_location_id: null,
      from_location_id: null,
      from_address: DEFAULT_FROM_ADDRESS,
      to_address: EMPTY_ADDRESS,
      items: [],
      driver_id: null,
      status: 'pending',
      delivery_type: 'commercial',
      ...defaultValues,
    } as DeliveryFormValues,
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const watchProjectId = watch('project_id')
  const watchFromLocationId = watch('from_location_id')

  const { projects, trucks, warehouseLocations } = useDeliveryFormData()

  // Auto-fill to_address from project
  useEffect(() => {
    if (watchProjectId && !isEdit) {
      const project = projects.find((p) => p.id === watchProjectId)
      if (project?.project_address) {
        setValue('to_address', {
          company_name: project.name,
          street_address: project.project_address.street_address || '',
          city: project.project_address.city || '',
          state: project.project_address.state || '',
          zip_code: project.project_address.zip_code || '',
          phone: project.project_address.phone || '',
        })
      }
    }
  }, [watchProjectId, projects, setValue, isEdit])

  const handleAddItems = (newItems: DeliveryItemFormValues[]) => {
    newItems.forEach((item) => append(item))
  }

  const existingItemIds = new Set(
    fields.map((f) => f.item_id).filter((id): id is number => id !== null && id !== undefined)
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {isSaving && (
        <div
          className="flex items-center gap-2.5 px-4 py-3 rounded-lg border text-sm"
          style={{
            background: 'color-mix(in oklab, var(--signal) 8%, var(--panel))',
            borderColor: 'color-mix(in oklab, var(--signal) 25%, var(--line))',
            color: 'var(--ink-2)',
          }}
        >
          <span className="loading loading-spinner loading-sm" />
          <span>{savingStatus || 'Saving...'}</span>
        </div>
      )}

      <DeliveryHeaderCard
        register={register}
        control={control}
        errors={errors}
        projects={projects}
        trucks={trucks}
        warehouseLocations={warehouseLocations}
        deliveryNumber={deliveryNumber}
      />

      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <div
          className="font-medium text-[var(--ink)] mb-4"
          style={{ fontFamily: 'var(--serif)', fontSize: 15 }}
        >
          Addresses
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AddressFields prefix="from_address" label="From" register={register} errors={errors} />
          <div>
            <AddressFields prefix="to_address" label="To" register={register} errors={errors} />
            {watchProjectId && projects.find((p) => p.id === watchProjectId)?.project_address && (
              <p className="text-xs text-[var(--muted)] mt-1.5">
                Auto-filled from project address
              </p>
            )}
          </div>
        </div>
      </div>

      <DeliveryItemsCard
        fields={fields}
        watch={watch}
        setValue={setValue}
        register={register}
        remove={remove}
        errors={errors}
        watchFromLocationId={watchFromLocationId}
        onOpenItemSelector={() => setShowItemSelector(true)}
      />

      {isEdit && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
          <FormField label="Status">
            <select {...register('status')} className="form-input">
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </FormField>
        </div>
      )}

      <DeliveryFormFooter
        fields={fields}
        watch={watch}
        setValue={setValue}
        isSaving={isSaving}
      />

      <ItemSelectorModal
        isOpen={showItemSelector}
        onClose={() => setShowItemSelector(false)}
        onAddItems={handleAddItems}
        sourceLocationId={watchFromLocationId}
        existingItemIds={existingItemIds}
      />
    </form>
  )
}
