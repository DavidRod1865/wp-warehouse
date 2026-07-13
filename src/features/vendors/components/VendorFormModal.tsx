/**
 * VendorFormModal — Form for creating/editing vendors
 */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { vendorFormSchema, type VendorFormValues } from '../schemas/vendorSchema'
import { useCreateVendor, useUpdateVendor, type Vendor } from '../hooks/useVendorMutations'
import { Icon } from '../../../components/ui/Icon'
import { useToast } from '../../../components/ui/Toast'

interface VendorFormModalProps {
  vendor?: Vendor
  onClose: () => void
}

function FormField({
  label,
  error,
  required,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <div
        className="mb-1.5 text-[var(--muted)]"
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 10.5,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
        }}
      >
        {label} {required && <span className="text-[var(--danger)]">*</span>}
      </div>
      {children}
      {error && (
        <div className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      )}
    </div>
  )
}

export function VendorFormModal({ vendor, onClose }: VendorFormModalProps) {
  const isEdit = !!vendor
  const [saving, setSaving] = useState(false)
  const createVendor = useCreateVendor()
  const updateVendor = useUpdateVendor()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      name: vendor?.name ?? '',
      contact_name: vendor?.contact_name ?? null,
      phone: vendor?.phone ?? null,
      email: vendor?.email ?? null,
      address: vendor?.address ?? null,
      notes: vendor?.notes ?? null,
    } as VendorFormValues,
  })

  async function onSubmit(values: any) {
    setSaving(true)
    try {
      if (isEdit && vendor) {
        await updateVendor.mutateAsync({
          id: Number(vendor.id),
          values: values as VendorFormValues,
        })
        toast('Vendor updated', 'success')
      } else {
        await createVendor.mutateAsync(values as VendorFormValues)
        toast('Vendor created', 'success')
      }
      onClose()
    } catch (err) {
      console.error('Save failed:', err)
      toast(err instanceof Error ? err.message : 'Failed to save vendor', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{
        background: 'color-mix(in oklab, var(--ink) 35%, transparent)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--panel)] rounded-xl w-full max-w-md overflow-hidden"
        style={{ boxShadow: '0 20px 60px -20px rgba(15,23,41,.35), 0 0 0 1px var(--line)' }}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--line)]">
          <h3 className="text-lg font-semibold">{isEdit ? 'Edit Vendor' : 'New Vendor'}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--panel-2)] text-[var(--muted)]"
            disabled={saving}
          >
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="px-6 py-5 space-y-4">
            <FormField label="Vendor Name" required error={errors.name?.message}>
              <input
                {...register('name')}
                className="form-input w-full"
                placeholder="ABC Equipment Rental"
                autoFocus
                disabled={saving}
              />
            </FormField>

            <FormField label="Contact Name" error={errors.contact_name?.message}>
              <input
                {...register('contact_name')}
                className="form-input w-full"
                placeholder="John Smith"
                disabled={saving}
              />
            </FormField>

            <FormField label="Phone" error={errors.phone?.message}>
              <input
                {...register('phone')}
                className="form-input w-full"
                placeholder="(555) 123-4567"
                disabled={saving}
              />
            </FormField>

            <FormField label="Email" error={errors.email?.message}>
              <input
                {...register('email')}
                type="email"
                className="form-input w-full"
                placeholder="contact@example.com"
                disabled={saving}
              />
            </FormField>

            <div>
              <div
                className="mb-3 text-[var(--muted)]"
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 10.5,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                }}
              >
                Address
              </div>
              <div className="space-y-2">
                <input
                  {...register('address.street')}
                  className="form-input w-full"
                  placeholder="Street"
                  disabled={saving}
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    {...register('address.city')}
                    className="form-input"
                    placeholder="City"
                    disabled={saving}
                  />
                  <input
                    {...register('address.state')}
                    className="form-input"
                    placeholder="State"
                    disabled={saving}
                  />
                  <input
                    {...register('address.zip')}
                    className="form-input"
                    placeholder="Zip"
                    disabled={saving}
                  />
                </div>
                <input
                  {...register('address.notes')}
                  className="form-input w-full"
                  placeholder="Address notes"
                  disabled={saving}
                />
              </div>
            </div>

            <FormField label="Notes" error={errors.notes?.message}>
              <textarea
                {...register('notes')}
                className="form-input w-full"
                placeholder="Additional notes..."
                rows={3}
                disabled={saving}
              />
            </FormField>
          </div>

          <div
            className="flex justify-end gap-2 px-6 py-3.5 border-t border-[var(--line)]"
            style={{ background: 'color-mix(in oklab, var(--panel-2) 50%, var(--panel))' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg text-sm text-[var(--muted)] hover:bg-[var(--panel-2)]"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-2 rounded-lg text-sm text-white hover:opacity-90"
              style={{ background: 'var(--signal)' }}
              disabled={saving}
            >
              {saving ? <span className="loading loading-spinner loading-sm inline" /> : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
