import { Controller } from 'react-hook-form'
import type { Control, UseFormRegister, FieldErrors } from 'react-hook-form'
import type { DeliveryFormValues } from '../schemas/deliverySchema'
import type { Project } from '../../../types/project'
import { FormField } from './_formHelpers'

interface DeliveryHeaderCardProps {
  register: UseFormRegister<DeliveryFormValues>
  control: Control<DeliveryFormValues>
  errors: FieldErrors<DeliveryFormValues>
  projects: Project[]
  trucks: { id: number; name: string }[]
}

export function DeliveryHeaderCard({
  register,
  control,
  errors,
  projects,
  trucks,
}: DeliveryHeaderCardProps) {
  return (
    <div
      className="rounded-xl border border-[var(--line)] overflow-hidden"
      style={{ background: 'color-mix(in oklab, var(--panel-2) 40%, var(--panel))' }}
    >
      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FormField label="Delivery #">
            <input
              {...register('delivery_number')}
              className="form-input"
              readOnly
              style={{ opacity: 0.7 }}
            />
          </FormField>

          <FormField label="PO Reference">
            <input
              {...register('po_reference')}
              className="form-input"
              placeholder="Optional"
            />
          </FormField>

          <FormField label="Project">
            <Controller
              name="project_id"
              control={control}
              render={({ field }) => (
                <select
                  className="form-input"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">No Project (Residential)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            />
          </FormField>

          <FormField label="Truck" error={errors.truck_folder_id?.message}>
            <Controller
              name="truck_folder_id"
              control={control}
              render={({ field }) => (
                <select
                  className={`form-input ${errors.truck_folder_id ? 'border-[var(--danger)]' : ''}`}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Select a truck...</option>
                  {trucks.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            />
          </FormField>
        </div>
      </div>
    </div>
  )
}
